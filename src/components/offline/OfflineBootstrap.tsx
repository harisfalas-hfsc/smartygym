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
  initLocalDatabase,
  pendingMutationCount,
  clearStoredCredentials,
} from "@/lib/offline";
import {
  startConnectivityMonitor,
  isReachable,
  probeConnectivity,
  reportRequestFailure,
  reportRequestSuccess,
} from "@/lib/offline/connectivity";
import {
  loadSyncDiagnostics,
  registerSyncHandler,
  updateSyncDiagnostics,
} from "@/lib/offline/syncStatus";
import { getCyprusTodayStr } from "@/lib/cyprusDate";
import { fetchFreeAccessMode, subscribeFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";
import { warmOfflineUrls } from "@/utils/registerServiceWorker";

const OFFLINE_ROUTES = [
  "/", "/about", "/faq", "/smarty-premium", "/fitness-training", "/research",
  "/glossary", "/blog", "/workout", "/trainingprogram", "/tools",
  "/exerciselibrary", "/community", "/contact", "/privacy-policy",
  "/termsofservice", "/disclaimer", "/userdashboard",
];

/** Give the browser a breath so background sync never blocks the UI. */
const breathe = (ms = 0) =>
  new Promise<void>((resolve) => {
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => number);
    if (!ms && ric) ric(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, ms);
  });

const saveData = () => {
  const conn = (navigator as any)?.connection;
  return Boolean(conn?.saveData) || ["slow-2g", "2g"].includes(conn?.effectiveType);
};

/**
 * Media warming is strictly best-effort: capped, serialised, and skipped on
 * metered/slow links. Firing thousands of image/GIF requests at once was what
 * made the app feel frozen.
 */
const warmMedia = async (urls: Array<string | null | undefined>, cap = 60) => {
  if (saveData()) return;
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))].slice(0, cap);
  for (const url of unique) {
    try {
      await fetch(url, { mode: "cors", credentials: "omit" });
    } catch {
      // ignore
    }
    await breathe(150);
  }
};

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

export const OfflineBootstrap = () => {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const lastRunAt = useRef(0);
  const premiumAtLastSync = useRef<boolean | null>(null);

  useEffect(() => {
    initOfflineSessionTracking();
    startConnectivityMonitor();
    void initLocalDatabase();
    // Public/permanent routes are warmed for everyone, not only signed-in
    // members. Deferred so it never competes with the first screens.
    const routeWarmTimer = window.setTimeout(() => void warmOfflineUrls(OFFLINE_ROUTES), 15_000);

    const run = async (userId: string) => {
      if (running.current) return;
      if (Date.now() - lastRunAt.current < 10 * 60_000) return;
      if (!isReachable() && (await probeConnectivity()) !== "online") return;
      running.current = true;
      lastRunAt.current = Date.now();
      updateSyncDiagnostics({ phase: "syncing", lastAttemptAt: Date.now() }, userId);

      const save = (key: string, data: unknown) => saveOffline(key, data, userId);
      const table = (name: string) => (supabase as never as { from: (n: string) => any }).from(name);
        const rpc = (name: string, args?: unknown) =>
          (supabase as never as { rpc: (n: string, a?: unknown) => any }).rpc(name, args);
        const dataOrThrow = <T,>(result: { data: T; error?: unknown }): T => {
          if (result.error) throw result.error;
          return result.data;
        };

      try {
        await flushMutationQueue(userId);

        // ---- entitlement first: it decides WHAT may be stored offline --------
        const [{ data: roleRows }, { data: subRow }, { data: purchaseRows }, freeAccessMode] =
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
            fetchFreeAccessMode(true),
          ]);

        const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
        const isPersonalPremium =
          subRow?.status === "active" &&
          ["lifetime", "premium", "legacy_premium"].includes(subRow?.plan_type ?? "");
        const isPremium = isAdmin || isPersonalPremium || freeAccessMode;
        const purchased = new Set(
          (purchaseRows ?? []).map((p: any) => `${p.content_type}:${p.content_id}`),
        );

        const entitledTo = (row: any, kind: "workout" | "program") => {
          if (isPremium) return true;
          if (row?.is_free === true || row?.is_premium === false) return true;
          return purchased.has(`${kind}:${row?.id}`);
        };

        const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [];

        // ---- account, access, profile, settings -------------------------------
        tasks.push({
          name: "account",
          run: async () => {
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
          },
        });

        // ---- content library: workouts + programs (list + every detail) -------
        tasks.push({
          name: "content-library",
          run: async () => {
            const [workoutMetadataResult, programMetadataResult, workoutFullResult, programFullResult] = await Promise.all([
              rpc("get_visible_workout_metadata", { _workout_id: null }),
              rpc("get_visible_program_metadata", { _program_id: null }),
              table("admin_workouts").select("*").neq("is_visible", false),
              table("admin_training_programs").select("*").neq("is_visible", false),
            ]);

            const workoutMetadata = dataOrThrow<any[]>(workoutMetadataResult) ?? [];
            const programMetadata = dataOrThrow<any[]>(programMetadataResult) ?? [];
            // The public RPCs are the authoritative catalog. Direct base-table
            // rows are merged only when access policies return them, preserving
            // full paid bodies for entitled members without emptying the list
            // for visitors/free members.
            const fullWorkouts = workoutFullResult.error ? [] : (workoutFullResult.data ?? []);
            const fullPrograms = programFullResult.error ? [] : (programFullResult.data ?? []);
            const workoutFullById = new Map<string, Record<string, unknown>>(
              fullWorkouts.map((row: any) => [String(row.id), row as Record<string, unknown>]),
            );
            const programFullById = new Map<string, Record<string, unknown>>(
              fullPrograms.map((row: any) => [String(row.id), row as Record<string, unknown>]),
            );
            const workouts = workoutMetadata.map((row) => ({ ...row, ...(workoutFullById.get(row.id) ?? {}) }));
            const programs = programMetadata.map((row) => ({ ...row, ...(programFullById.get(row.id) ?? {}) }));
            const workoutSlugs = buildUniqueContentSlugs(workouts);
            const programSlugs = buildUniqueContentSlugs(programs);

            await save("workouts:list:all", workouts);
            await save("programs:list:all", programs);
            queryClient.setQueryData(["all-workouts"], workouts);
            queryClient.setQueryData(["all-programs"], programs);

            let written = 0;
            for (const w of workouts) {
              const slug = workoutSlugs.get(w.id) || slugifyContentName(w.name || w.id);
              const full = { ...w, canonical_slug: slug };
              // Not entitled? store a listing-safe copy only, which also
              // OVERWRITES any body cached while Free Access Mode was on.
              const row = entitledTo(w, "workout") ? full : stripBody(full);
              await save(`detail:workout:${w.id}`, row);
              await save(`detail:workout:${slug}`, row);
              if ((written += 1) % 20 === 0) await breathe();
            }
            for (const p of programs) {
              const slug = programSlugs.get(p.id) || slugifyContentName(p.name || p.id);
              const full = { ...p, canonical_slug: slug };
              const row = entitledTo(p, "program") ? full : stripBody(full);
              await save(`detail:program:${p.id}`, row);
              await save(`detail:program:${slug}`, row);
              await save(`detail:training-program:${p.id}`, row);
              await save(`detail:training-program:${slug}`, row);
              if ((written += 1) % 20 === 0) await breathe();
            }

            const today = getCyprusTodayStr();
            const todayWods = workouts.filter(
              (w: any) => w.is_workout_of_day === true && w.generated_for_date === today,
            );
            await save(`wod:today:${today}`, todayWods);

            await warmMedia([
              ...workouts.map((row: any) => row.image_url),
              ...programs.map((row: any) => row.image_url),
            ]);
          },
        });

        // ---- exercise library (paginated until exhausted) + filters -----------
        tasks.push({
          name: "exercise-library",
          run: async () => {
            const all: unknown[] = [];
            const pageSize = 1000;
            for (let page = 0; page < 50; page += 1) {
              const { data, error } = await table("exercises")
                .select("*")
                .order("name")
                .range(page * pageSize, page * pageSize + pageSize - 1);
              if (error || !data?.length) break;
              all.push(...data);
              await breathe();
              if (data.length < pageSize) break;
            }
            await save("library:list:exercises", all);
            let count = 0;
            for (const ex of all as any[]) {
              await save(`library:exercise:${ex.id}`, ex);
              if ((count += 1) % 50 === 0) await breathe();
            }
            await save("library:filters", {
              categories: [...new Set((all as any[]).map((e) => e.category).filter(Boolean))],
              equipment: [...new Set((all as any[]).map((e) => e.equipment).filter(Boolean))],
              muscles: [...new Set((all as any[]).map((e) => e.muscle_group).filter(Boolean))],
            });
            // GIFs are heavy; warm only a small slice in the background.
            await warmMedia(
              (all as any[]).flatMap((ex) => [ex.gif_url, ex.image_url]),
              40,
            );
          },
        });

        // ---- logbook / progress / stats ---------------------------------------
        tasks.push({
          name: "progress-and-logbook",
          run: async () => {
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
              save("progress:activity-log", activity.data ?? []),
            ]);
          },
        });

        // ---- owned / saved items + favourites ---------------------------------
        tasks.push({
          name: "saved-and-favorites",
          run: async () => {
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
          },
        });

        // ---- notifications / inbox --------------------------------------------
        tasks.push({
          name: "notifications",
          run: async () => {
            const [messages, contact] = await Promise.all([
              table("user_system_messages").select("*").eq("user_id", userId),
              table("contact_messages").select("*").eq("user_id", userId),
            ]);
            await Promise.all([
              save("notifications:system-messages", messages.data ?? []),
              save("inbox:contact-messages", contact.data ?? []),
            ]);
          },
        });

        // ---- community: leaderboards, testimonials, ratings --------------------
        tasks.push({
          name: "community",
          run: async () => {
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
          },
        });

        // ---- blog / articles (list + full detail) ------------------------------
        tasks.push({
          name: "blog",
          run: async () => {
            const { data: articles } = await table("blog_articles")
              .select("*")
              .eq("is_published", true)
              .order("published_at", { ascending: false });
            await save("blog:list", articles ?? []);
            await warmMedia((articles ?? []).map((article: any) => article.image_url));
            for (const a of (articles ?? []) as any[]) {
              await save(`blog:article:${a.slug || a.id}`, a);
            }
          },
        });

        // ---- daily ritual -------------------------------------------------------
        tasks.push({
          name: "daily-ritual",
          run: async () => {
            const { data: rituals } = await table("daily_smarty_rituals").select("*");
            await save("rituals:list", rituals ?? []);
          },
        });

        // Run one task at a time, yielding between them. Firing every task in
        // parallel flooded the connection and the main thread, which is what
        // made pages take tens of seconds to open.
        const completedTasks: string[] = [];
        let failed = 0;
        for (const task of tasks) {
          try {
            await task.run();
            completedTasks.push(task.name);
          } catch (e) {
            failed += 1;
            console.warn("[offline] task failed", task.name, e);
          }
          await breathe(250);
        }

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
        reportRequestSuccess();
        updateSyncDiagnostics(
          {
            phase: failed > 0 ? "error" : "idle",
            lastSuccessAt: Date.now(),
            lastError: failed > 0 ? `${failed} sync task(s) failed` : null,
            failedOperations: failed,
            completedTasks,
            pendingOperations: await pendingMutationCount(userId),
          },
          userId,
        );
      } catch (error) {
        reportRequestFailure();
        console.warn("[offline] bootstrap failed", error);
        updateSyncDiagnostics(
          { phase: "error", lastError: error instanceof Error ? error.message : "Sync failed" },
          userId,
        );
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
      void loadSyncDiagnostics(activeUserId);
      // Let the app become interactive first; background sync starts after.
      window.setTimeout(() => activeUserId && void run(activeUserId), 8_000);
    };

    void start();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Device-scoped secrets must never survive a logout — the next person
        // on this device must not be able to sign in offline as the last one.
        activeUserId = null;
        setCurrentUserId(null);
        void clearStoredCredentials();
        updateSyncDiagnostics({ phase: "idle", pendingOperations: 0, failedOperations: 0 });
        return;
      }
      if (session) {
        if (activeUserId && activeUserId !== session.user.id) {
          // Different account on the same device: drop the previous device
          // credentials so the two identities never mix.
          void clearStoredCredentials();
        }
        activeUserId = session.user.id;
        setCurrentUserId(activeUserId);
        void cacheSessionForOffline(session);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
          const id = session.user.id;
          window.setTimeout(() => void run(id), 8_000);
        }
      }
    });

    const resync = (force = false) => {
      if (!activeUserId) return;
      if (force) lastRunAt.current = 0;
      void run(activeUserId);
    };

    registerSyncHandler(() => resync(true));

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
      if (isReachable()) void fetchFreeAccessMode(true);
    }, 5 * 60 * 1000);

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      sub.subscription.unsubscribe();
      unsubscribeFreeAccess();
      window.clearTimeout(routeWarmTimer);
      window.clearInterval(poll);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [queryClient]);

  return null;
};
