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
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";

/**
 * Downloads the signed-in member's entire world in the background so every
 * page works with zero internet — without the member visiting any page first.
 */
export const OfflineBootstrap = () => {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const lastRunAt = useRef(0);

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

            await save("workouts:list:all", workouts);
            await save("programs:list:all", programs);
            queryClient.setQueryData(["all-workouts"], workouts);
            queryClient.setQueryData(["all-programs"], programs);

            for (const w of workouts) {
              const slug = workoutSlugs.get(w.id) || slugifyContentName(w.name || w.id);
              const row = { ...w, canonical_slug: slug };
              await save(`detail:workout:${w.id}`, row);
              await save(`detail:workout:${slug}`, row);
            }
            for (const p of programs) {
              const slug = programSlugs.get(p.id) || slugifyContentName(p.name || p.id);
              const row = { ...p, canonical_slug: slug };
              await save(`detail:program:${p.id}`, row);
              await save(`detail:program:${slug}`, row);
              await save(`detail:training-program:${p.id}`, row);
              await save(`detail:training-program:${slug}`, row);
            }

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
          })(),
        );

        // ---- logbook / progress / stats ---------------------------------------
        tasks.push(
          (async () => {
            const [checkins, progress, calories, bmr, onerm, goals, measurements, badges, scheduled] =
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
            const [messages, contact] = await Promise.all([
              table("user_system_messages").select("*").eq("user_id", userId),
              table("contact_messages").select("*").eq("user_id", userId),
            ]);
            await Promise.all([
              save("notifications:system-messages", messages.data ?? []),
              save("inbox:contact-messages", contact.data ?? []),
            ]);
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
        activeUserId = session.user.id;
        setCurrentUserId(activeUserId);
        void cacheSessionForOffline(session);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
          void run(session.user.id);
        }
      }
    });

    const onOnline = () => {
      if (activeUserId) void run(activeUserId);
    };
    window.addEventListener("online", onOnline);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, [queryClient]);

  return null;
};
