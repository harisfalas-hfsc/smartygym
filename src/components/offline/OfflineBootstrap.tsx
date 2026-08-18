import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  saveOffline,
  trimCache,
  flushMutationQueue,
  cacheSessionForOffline,
  setCurrentUserId,
  initOfflineSessionTracking,
} from "@/lib/offline";
import { getCyprusTodayStr } from "@/lib/cyprusDate";
import { fetchFreeAccessMode, subscribeFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";

/**
 * Downloads the signed-in member's entire world in the background so every
 * page works with zero internet — without the member visiting any page first.
 */
/** Fields that hold the paid body of a workout / program. */
const BODY_FIELDS = [
  "warm_up",
  "activation",
  "main_workout",
  "finisher",
  "cool_down",
  "instructions",
  "tips",
  "notes",
  "overview",
  "program_structure",
  "weekly_schedule",
  "progression_plan",
  "nutrition_tips",
  "expected_results",
  "target_audience",
];

/** Listing-safe copy: keeps title/image/description, drops the paid content. */
const stripBody = <T extends Record<string, unknown>>(row: T): T => {
  const copy: Record<string, unknown> = { ...row };
  for (const field of BODY_FIELDS) {
    if (field in copy) copy[field] = null;
  }
  copy.offline_locked = true;
  return copy as T;
};

const MEDIA_FIELDS = [
  "image_url",
  "video_url",
  "gif_url",
  "thumbnail_url",
  "avatar_url",
  "cover_url",
];

const collectMediaUrls = (rows: unknown[]): string[] => {
  const urls = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const field of MEDIA_FIELDS) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.add(value);
    }
  }
  return [...urls];
};

const cacheMedia = async (urls: string[]) => {
  if (!("caches" in window) || !navigator.onLine || urls.length === 0) return;
  const mediaCache = await caches.open("smartygym-member-media-v1");
  const workers = Array.from({ length: Math.min(6, urls.length) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < urls.length; index += 6) {
      const url = urls[index];
      try {
        if (await mediaCache.match(url)) continue;
        const response = await fetch(url, { mode: "no-cors", credentials: "omit" });
        await mediaCache.put(url, response);
      } catch {
        // A media host may reject offline caching; the data record remains safe.
      }
    }
  });
  await Promise.allSettled(workers);
};

export const OfflineBootstrap = () => {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const lastRunAt = useRef(0);
  const premiumAtLastSync = useRef<boolean | null>(null);

  useEffect(() => {
    initOfflineSessionTracking();

    const run = async (userId: string) => {
      if (running.current) return;
      if (Date.now() - lastRunAt.current < 60_000) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      running.current = true;
      lastRunAt.current = Date.now();

      const save = (key: string, data: unknown) => saveOffline(key, data, userId);
      const table = (name: string) => (supabase as never as { from: (n: string) => any }).from(name);

      try {
        await flushMutationQueue(userId);

        // ---- entitlement first: it decides WHAT may be stored offline --------
        const [
          { data: roleRows },
          { data: subRow },
          { data: purchaseRows },
          { data: corpAdmin },
          { data: corpMember },
          freeAccessMode,
        ] =
          await Promise.all([
            table("user_roles").select("role").eq("user_id", userId),
            table("user_subscriptions")
              .select("plan_type, status")
              .eq("user_id", userId)
              .maybeSingle(),
            table("user_purchases")
              .select("content_id, content_type")
              .eq("user_id", userId)
              .eq("content_deleted", false),
            table("corporate_subscriptions")
              .select("id")
              .eq("admin_user_id", userId)
              .eq("status", "active")
              .maybeSingle(),
            table("corporate_members")
              .select("corporate_subscription_id, corporate_subscriptions!inner(status)")
              .eq("user_id", userId)
              .eq("corporate_subscriptions.status", "active")
              .maybeSingle(),
            fetchFreeAccessMode(true),
          ]);

        const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
        const isPersonalPremium =
          subRow?.status === "active" &&
          ["lifetime", "premium", "legacy_premium"].includes(subRow?.plan_type ?? "");
        const isCorporatePremium = Boolean(corpAdmin || corpMember);
        const isPremium = isAdmin || isPersonalPremium || isCorporatePremium || freeAccessMode;
        const purchased = new Set(
          (purchaseRows ?? []).map((p: any) => `${p.content_type}:${p.content_id}`),
        );

        const entitledTo = (row: any, kind: "workout" | "program") => {
          if (isPremium) return true;
          if (row?.is_free === true || row?.is_premium === false) return true;
          return purchased.has(`${kind}:${row?.id}`);
        };

        const tasks: Promise<unknown>[] = [];

        // ---- account, access, profile, settings -------------------------------
        tasks.push(
          (async () => {
            const [profile, roles, subscription, purchases, settings] = await Promise.all([
              table("profiles").select("*").eq("user_id", userId).maybeSingle(),
              table("user_roles").select("*").eq("user_id", userId),
              table("user_subscriptions").select("*").eq("user_id", userId).maybeSingle(),
              table("user_purchases").select("*").eq("user_id", userId),
              table("system_settings").select("*"),
            ]);
            await Promise.all([
              save("profile", profile.data),
              save("account:roles", roles.data ?? []),
              save("subscription", subscription.data),
              save("purchases:list", purchases.data ?? []),
              save("settings:system", settings.data ?? []),
            ]);
          })(),
        );

        // ---- content library: workouts + programs (list + every detail) -------
        tasks.push(
          (async () => {
            const [{ data: workoutMeta }, { data: programMeta }] = await Promise.all([
              table("admin_workouts").select("*").neq("is_visible", false),
              table("admin_training_programs").select("*").neq("is_visible", false),
            ]);

            const workouts = workoutMeta ?? [];
            const programs = programMeta ?? [];
            const workoutSlugs = buildUniqueContentSlugs(workouts);
            const programSlugs = buildUniqueContentSlugs(programs);

            // List caches must never become a back door to paid body fields.
            // Detail caches below retain full bodies only for entitled content.
            const safeWorkoutList = workouts.map((w: any) => stripBody(w));
            const safeProgramList = programs.map((p: any) => stripBody(p));
            await save("workouts:list:all", safeWorkoutList);
            await save("programs:list:all", safeProgramList);
            queryClient.setQueryData(["all-workouts"], safeWorkoutList);
            queryClient.setQueryData(["all-programs"], safeProgramList);

            for (const w of workouts) {
              const slug = workoutSlugs.get(w.id) || slugifyContentName(w.name || w.id);
              const full = { ...w, canonical_slug: slug };
              // Not entitled? store a listing-safe copy only, which also
              // OVERWRITES any body cached while Free Access Mode was on.
              const row = entitledTo(w, "workout") ? full : stripBody(full);
              await save(`detail:workout:${w.id}`, row);
              await save(`detail:workout:${slug}`, row);
            }
            for (const p of programs) {
              const slug = programSlugs.get(p.id) || slugifyContentName(p.name || p.id);
              const full = { ...p, canonical_slug: slug };
              const row = entitledTo(p, "program") ? full : stripBody(full);
              await save(`detail:program:${p.id}`, row);
              await save(`detail:program:${slug}`, row);
              await save(`detail:training-program:${p.id}`, row);
              await save(`detail:training-program:${slug}`, row);
            }

            await cacheMedia(collectMediaUrls([...workouts, ...programs]));

            const today = getCyprusTodayStr();
            const todayWods = workouts.filter(
              (w: any) => w.is_workout_of_day === true && w.generated_for_date === today,
            );
            await save(`wod:today:${today}`, todayWods);
          })(),
        );

        // ---- exercise library (paginated until exhausted) + filters -----------
        tasks.push(
          (async () => {
            const all: unknown[] = [];
            const pageSize = 1000;
            for (let page = 0; page < 50; page += 1) {
              const { data, error } = await table("exercises")
                .select("*")
                .order("name")
                .range(page * pageSize, page * pageSize + pageSize - 1);
              if (error || !data?.length) break;
              all.push(...data);
              if (data.length < pageSize) break;
            }
            await save("library:list:exercises", all);
            for (const ex of all as any[]) {
              await save(`library:exercise:${ex.id}`, ex);
            }
            await save("library:filters", {
              categories: [...new Set((all as any[]).map((e) => e.category).filter(Boolean))],
              equipment: [...new Set((all as any[]).map((e) => e.equipment).filter(Boolean))],
              muscles: [...new Set((all as any[]).map((e) => e.muscle_group).filter(Boolean))],
            });
            await cacheMedia(collectMediaUrls(all));
          })(),
        );

        // ---- logbook / progress / stats ---------------------------------------
        tasks.push(
          (async () => {
            const [checkins, progress, calories, bmr, onerm, goals, measurements, badges, scheduled, activity] =
              await Promise.all([
                table("smarty_checkins").select("*").eq("user_id", userId),
                table("progress_logs").select("*").eq("user_id", userId),
                table("calorie_history").select("*").eq("user_id", userId),
                table("bmr_history").select("*").eq("user_id", userId),
                table("onerm_history").select("*").eq("user_id", userId),
                table("user_fitness_goals").select("*").eq("user_id", userId),
                table("user_measurement_goals").select("*").eq("user_id", userId),
                table("user_badges").select("*").eq("user_id", userId),
                table("scheduled_workouts").select("*").eq("user_id", userId),
                table("user_activity_log").select("*").eq("user_id", userId),
              ]);
            await Promise.all([
              save("logbook:checkins", checkins.data ?? []),
              save("progress:logs", progress.data ?? []),
              save("logbook:calories", calories.data ?? []),
              save("logbook:bmr", bmr.data ?? []),
              save("logbook:onerm", onerm.data ?? []),
              save("progress:goals", goals.data ?? []),
              save("progress:measurement-goals", measurements.data ?? []),
              save("badges", badges.data ?? []),
              save("saved:scheduled-workouts", scheduled.data ?? []),
              save("logbook:activity", activity.data ?? []),
            ]);
          })(),
        );

        // ---- owned / saved items + favourites ---------------------------------
        tasks.push(
          (async () => {
            const [savedWorkouts, savedPrograms, wInteractions, pInteractions] = await Promise.all([
              table("saved_workouts").select("*").eq("user_id", userId),
              table("saved_training_programs").select("*").eq("user_id", userId),
              table("workout_interactions").select("*").eq("user_id", userId),
              table("program_interactions").select("*").eq("user_id", userId),
            ]);
            await Promise.all([
              save("saved:workouts", savedWorkouts.data ?? []),
              save("saved:programs", savedPrograms.data ?? []),
              save("favorites:workout-interactions", wInteractions.data ?? []),
              save("favorites:program-interactions", pInteractions.data ?? []),
            ]);
          })(),
        );

        // ---- notifications / inbox --------------------------------------------
        tasks.push(
          (async () => {
            const [messages, contact, contactHistory] = await Promise.all([
              table("user_system_messages").select("*").eq("user_id", userId),
              table("contact_messages").select("*").eq("user_id", userId),
              table("contact_message_history").select("*").eq("user_id", userId),
            ]);
            await Promise.all([
              save("notifications:system-messages", messages.data ?? []),
              save("inbox:contact-messages", contact.data ?? []),
              save("inbox:contact-history", contactHistory.data ?? []),
            ]);
          })(),
        );

        // ---- workout discussion threads + full comments -----------------------
        tasks.push(
          (async () => {
            const { data: comments } = await table("workout_comments")
              .select("*")
              .order("created_at", { ascending: true });
            const allComments = comments ?? [];
            await save("community:workout-comments", allComments);
            const byWorkout = new Map<string, any[]>();
            for (const comment of allComments as any[]) {
              const workoutId = comment.workout_id;
              if (!workoutId) continue;
              const bucket = byWorkout.get(workoutId) ?? [];
              bucket.push(comment);
              byWorkout.set(workoutId, bucket);
            }
            await Promise.all(
              [...byWorkout.entries()].map(([workoutId, rows]) =>
                save(`community:workout-comments:${workoutId}`, rows),
              ),
            );
          })(),
        );

        // ---- community: leaderboards, testimonials, ratings --------------------
        tasks.push(
          (async () => {
            const rpc = (supabase as never as { rpc: (n: string, a?: unknown) => any }).rpc;
            const [workoutBoard, programBoard, checkinBoard, testimonials, wRatings, pRatings] =
              await Promise.all([
                rpc("get_workout_leaderboard"),
                rpc("get_program_leaderboard"),
                rpc("get_checkin_leaderboard"),
                rpc("get_public_testimonials"),
                rpc("get_workout_ratings"),
                rpc("get_program_ratings"),
              ]);
            await Promise.all([
              save("community:workout-leaderboard", workoutBoard.data ?? []),
              save("community:program-leaderboard", programBoard.data ?? []),
              save("community:checkin-leaderboard", checkinBoard.data ?? []),
              save("community:testimonials", testimonials.data ?? []),
              save("community:workout-ratings", wRatings.data ?? []),
              save("community:program-ratings", pRatings.data ?? []),
            ]);
          })(),
        );

        // ---- blog / articles (list + full detail) ------------------------------
        tasks.push(
          (async () => {
            const { data: articles } = await table("blog_articles")
              .select("*")
              .eq("is_published", true)
              .order("published_at", { ascending: false });
            await save("blog:list", articles ?? []);
            for (const a of (articles ?? []) as any[]) {
              await save(`blog:article:${a.slug || a.id}`, a);
            }
            await cacheMedia(collectMediaUrls(articles ?? []));
          })(),
        );

        // ---- daily ritual -------------------------------------------------------
        tasks.push(
          (async () => {
            const { data: rituals } = await table("daily_smarty_rituals").select("*");
            await save("rituals:list", rituals ?? []);
          })(),
        );

        await Promise.allSettled(tasks);

        // Entitlement dropped since the last sync (e.g. Free Access Mode was
        // switched off, or a subscription lapsed)? Throw away the in-memory
        // detail caches so the UI re-reads the now-locked local copies.
        const previousPremium = premiumAtLastSync.current;
        premiumAtLastSync.current = isPremium;
        if (previousPremium === true && !isPremium) {
          queryClient.removeQueries({ queryKey: ["workout"] });
          queryClient.removeQueries({ queryKey: ["training-program"] });
          queryClient.removeQueries({ queryKey: ["program"] });
        }

        await trimCache();
      } catch (error) {
        console.warn("[offline] bootstrap failed", error);
      } finally {
        running.current = false;
      }
    };

    let activeUserId: string | null = null;

    const start = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      activeUserId = session.user.id;
      setCurrentUserId(activeUserId);
      void cacheSessionForOffline(session);
      void run(activeUserId);
    };

    void start();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (activeUserId && activeUserId !== session.user.id) {
          queryClient.clear();
        }
        activeUserId = session.user.id;
        setCurrentUserId(activeUserId);
        void cacheSessionForOffline(session);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
          void run(session.user.id);
        }
      } else if (event === "SIGNED_OUT") {
        activeUserId = null;
        setCurrentUserId(null);
        queryClient.clear();
      }
    });

    const resync = (force = false) => {
      if (!activeUserId) return;
      if (force) lastRunAt.current = 0;
      void run(activeUserId);
    };

    const onOnline = () => resync(true);
    const onFocus = () => {
      if (document.visibilityState === "visible") resync();
    };
    // Admin flipped the Free Access switch → re-sync entitlements right away.
    // Only react to an actual change in value, never to plain re-reads.
    let lastFreeAccess: boolean | null = null;
    const unsubscribeFreeAccess = subscribeFreeAccessMode((value) => {
      const changed = lastFreeAccess !== null && lastFreeAccess !== value;
      lastFreeAccess = value;
      if (changed) resync(true);
    });
    // Catch the switch flipping on other devices too.
    const poll = window.setInterval(() => {
      if (navigator.onLine) void fetchFreeAccessMode(true);
    }, 5 * 60 * 1000);

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      sub.subscription.unsubscribe();
      unsubscribeFreeAccess();
      window.clearInterval(poll);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [queryClient]);

  return null;
};
