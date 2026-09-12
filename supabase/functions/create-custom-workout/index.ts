import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { generateWorkoutContent } from "./engine/generate.server.ts";
import { microMinutes, resolveDifficulty } from "./engine/programming.ts";
import {
  CATEGORY_FORMATS,
  difficultyLabel,
  type Category,
  type EquipmentMode,
  type Format,
  type StrengthFocus,
} from "./engine/spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Member-built workouts allowed per calendar day. */
const DAILY_LIMIT = 2;

const GOAL_TO_CATEGORY: Record<string, Category> = {
  strength: "STRENGTH",
  muscle: "MUSCLE BUILDING",
  calorie: "CALORIE BURNING",
  cardio: "CARDIO",
  metabolic: "METABOLIC",
  challenge: "CHALLENGE",
  mobility: "MOBILITY & STABILITY",
  pilates: "PILATES",
  micro: "MICRO-WORKOUTS",
  recovery: "RECOVERY",
};

const LEVEL_STARS: Record<string, number> = { beginner: 1, intermediate: 3, advanced: 5 };

/** REQUESTED difficulty only — mood never enters here. */
function requestedStarsFor(experience: string | null, requested?: string): number {
  const explicit = Number(requested);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 6) return Math.round(explicit);
  const level = (experience ?? "").toLowerCase();
  if (level.includes("adv")) return LEVEL_STARS.advanced;
  if (level.includes("inter")) return LEVEL_STARS.intermediate;
  return LEVEL_STARS.beginner;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Please sign in to build a workout." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Please sign in to build a workout." }, 401);

    // Service client: reads the full exercise library and writes the session.
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ── Daily limit ───────────────────────────────────────────────────────────
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await db
      .from("user_custom_workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", dayStart.toISOString());
    if ((todayCount ?? 0) >= DAILY_LIMIT) {
      return json(
        {
          error: `You have already built ${DAILY_LIMIT} workouts today. Your next one unlocks tomorrow.`,
          limitReached: true,
        },
        429,
      );
    }

    const body = await req.json().catch(() => ({}));
    const goal = String(body.goal ?? "strength");
    const mood = String(body.mood ?? "normal");
    const location = String(body.location ?? "anywhere");
    let minutes = Math.max(5, Math.min(120, Number(body.minutes) || 30));
    let equipmentIds = (Array.isArray(body.equipment) && body.equipment.length
      ? body.equipment
      : ["bodyweight"]
    ).map(String);
    let equipmentMode: EquipmentMode =
      equipmentIds.every((e: string) => e === "bodyweight") ? "BODYWEIGHT" : "EQUIPMENT";
    const equipmentOther = String(body.equipmentOther ?? "").slice(0, 200);
    const note = String(body.note ?? "").slice(0, 500);

    let category: Category = GOAL_TO_CATEGORY[goal] ?? "STRENGTH";
    if (minutes <= 5) category = "MICRO-WORKOUTS";

    // ── Athlete context ───────────────────────────────────────────────────────
    const [{ data: profile }, { data: goals }, { data: history }] = await Promise.all([
      db.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
      db
        .from("user_fitness_goals")
        .select("primary_goal,secondary_goal,experience_level,equipment_available")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("user_custom_workouts")
        .select("name,category,main_workout")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const rows = (history ?? []) as Array<{ name: string; main_workout: string | null }>;
    const usedNames = rows.map((r) => r.name);
    const recentIds = [
      ...new Set(
        rows
          .slice(0, 4)
          .flatMap((r) => [...(r.main_workout ?? "").matchAll(/\{\{exercise:([^:}]+):/g)])
          .map((m) => m[1]!),
      ),
    ].slice(0, 120);

    const experience = (goals?.experience_level as string | null) ?? null;
    const requestedStars = requestedStarsFor(experience, String(body.level ?? "auto"));
    const { effectiveStars: stars } = resolveDifficulty(requestedStars, mood);

    let focus = (body.focus as StrengthFocus | undefined) ?? null;
    if (category === "MICRO-WORKOUTS") {
      minutes = microMinutes(minutes);
      equipmentIds = ["bodyweight"];
      equipmentMode = "BODYWEIGHT";
      focus = null;
    }

    const requestedFormat = body.format as Format | undefined;
    const format =
      requestedFormat && CATEGORY_FORMATS[category].includes(requestedFormat)
        ? requestedFormat
        : null;

    // ── Build ────────────────────────────────────────────────────────────────
    const built = await generateWorkoutContent(
      db,
      {
        category,
        format,
        equipmentMode,
        selectedEquipment: equipmentIds,
        ...(equipmentOther ? { customEquipmentRaw: equipmentOther } : {}),
        stars,
        minutes,
        focus,
        ...(note ? { note } : {}),
        recentIds,
        location,
        mood,
        athlete: {
          name: (profile?.full_name as string) ?? null,
          fitness_level: experience,
          primary_goal: (goals?.primary_goal as string) ?? null,
          secondary_goal: (goals?.secondary_goal as string) ?? null,
          location,
          mood,
        },
      },
      usedNames,
    );

    const { data: inserted, error: insertError } = await db
      .from("user_custom_workouts")
      .insert({
        user_id: user.id,
        name: built.name,
        category,
        format: built.format,
        focus,
        difficulty_stars: stars,
        difficulty_label: difficultyLabel(stars),
        duration_min: minutes,
        duration_label: built.duration,
        equipment: equipmentIds,
        location,
        mood,
        description_html: built.description_html,
        instructions_html: built.instructions_html,
        tips_html: built.tips_html,
        main_workout: built.main_workout,
        needs_review: built.needs_review,
        review_warnings: built.warnings ?? [],
        status: "created",
      })
      .select("id,name")
      .single();

    if (insertError) throw new Error(insertError.message);

    return json({
      id: inserted.id,
      name: inserted.name,
      category,
      remainingToday: Math.max(0, DAILY_LIMIT - ((todayCount ?? 0) + 1)),
      notes: built.warnings?.slice(0, 1) ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-custom-workout]", message);
    return json({ error: message }, 500);
  }
});
