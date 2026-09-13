// Generate ONE admin workout draft from the Content Creation Wizard.
//
// This function now runs the EXACT SAME engine as "Create Your Own Workout"
// (supabase/functions/_shared/workout-engine/*): the same doctrine, exercise
// pool, session spec, prompt builder, enforcement, validators and packer.
// There is only one set of coaching rules in the platform.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { generateWorkoutContent } from "../_shared/workout-engine/generate.server.ts";
import { microMinutes } from "../_shared/workout-engine/programming.ts";
import {
  CATEGORIES,
  CATEGORY_FORMATS,
  FORMATS,
  STRENGTH_FOCUS,
  difficultyLabel,
  normalizeStars,
  type Category,
  type EquipmentMode,
  type Format,
  type StrengthFocus,
} from "../_shared/workout-engine/spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(step: string, details?: unknown) {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[WIZARD-GEN] ${step}${d}`);
}

interface WizardBody {
  category: string;
  equipment: "BODYWEIGHT" | "EQUIPMENT" | string;
  difficulty_stars: number; // 0..6
  format?: string;
  duration?: string; // e.g. "30 min"
  focus?: string; // STRENGTH / MUSCLE BUILDING only
  access?: "free" | "premium" | "standalone";
  price?: string | number;
  tier_required?: string;
  note?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** "30 min" / "1h 15min" / "45" → minutes. */
function parseMinutes(raw: string | undefined, fallback = 30): number {
  const text = String(raw ?? "").toLowerCase();
  const hours = text.match(/(\d+)\s*h/);
  const mins = text.match(/(\d+)\s*(?:m|min)/);
  let total = 0;
  if (hours) total += Number(hours[1]) * 60;
  if (mins) total += Number(mins[1]);
  if (!total) {
    const bare = text.match(/(\d+)/);
    total = bare ? Number(bare[1]) : fallback;
  }
  return Math.max(5, Math.min(120, total || fallback));
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function normalizeCategory(raw: string): Category {
  const upper = String(raw ?? "").toUpperCase().trim();
  const direct = (CATEGORIES as readonly string[]).find((c) => c === upper);
  if (direct) return direct as Category;
  // Tolerate legacy spellings coming from older admin lists.
  if (upper.includes("MICRO")) return "MICRO-WORKOUTS";
  if (upper.includes("MOBILITY")) return "MOBILITY & STABILITY";
  if (upper.includes("HYPERTROPH") || upper.includes("MUSCLE")) return "MUSCLE BUILDING";
  if (upper.includes("CALORIE")) return "CALORIE BURNING";
  throw new Error(`Unsupported workout category: ${raw}`);
}

function normalizeFormat(raw: string | undefined, category: Category): Format | null {
  const upper = String(raw ?? "").toUpperCase().replace(/&AMP;/g, "&").replace(/\s+/g, " ").trim();
  if (!upper) return null;
  const direct = (FORMATS as readonly string[]).find((f) => f === upper);
  const resolved = (direct ??
    (upper.includes("REPS") ? "REPS & SETS" : upper.includes("TIME") ? "FOR TIME" : null)) as
    | Format
    | null;
  if (!resolved) return null;
  return CATEGORY_FORMATS[category].includes(resolved) ? resolved : null;
}

function normalizeFocus(raw: string | undefined): StrengthFocus | null {
  const upper = String(raw ?? "").toUpperCase().trim();
  return (STRENGTH_FOCUS as readonly string[]).includes(upper) ? (upper as StrengthFocus) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorizedResponse = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => ({}))) as WizardBody;
    if (!body?.category || !body?.equipment) {
      return json({ ok: false, error: "category and equipment are required" }, 400);
    }

    const category = normalizeCategory(body.category);
    const isMicro = category === "MICRO-WORKOUTS";
    const equipmentMode: EquipmentMode =
      isMicro || String(body.equipment).toUpperCase() === "BODYWEIGHT" ? "BODYWEIGHT" : "EQUIPMENT";
    const selectedEquipment = equipmentMode === "BODYWEIGHT" ? ["bodyweight"] : ["fullgym"];

    const stars = normalizeStars(Number(body.difficulty_stars) || 0);
    const minutes = isMicro ? microMinutes(parseMinutes(body.duration, 5)) : parseMinutes(body.duration, 30);
    const requestedFormat = normalizeFormat(body.format, category);
    const focus = isMicro ? null : normalizeFocus(body.focus);
    const note = String(body.note ?? "").slice(0, 500);

    log("Wizard request", {
      category,
      equipmentMode,
      stars,
      minutes,
      format: requestedFormat,
      focus,
      access: body.access || "free",
    });

    // Every published workout name is off-limits so the engine never repeats one.
    const { data: existing } = await supabase.from("admin_workouts").select("name");
    const usedNames = (existing ?? []).map((w: { name: string }) => w.name).filter(Boolean);

    const built = await generateWorkoutContent(
      // deno-lint-ignore no-explicit-any
      supabase as any,
      {
        category,
        format: requestedFormat,
        equipmentMode,
        selectedEquipment,
        stars,
        minutes,
        focus,
        ...(note ? { note } : {}),
        athlete: {
          name: null,
          fitness_level: difficultyLabel(stars),
          primary_goal: null,
          secondary_goal: null,
          location: "anywhere",
          mood: "normal",
        },
      },
      usedNames,
    );

    const access = body.access || "free";
    const reviewWarnings = built.warnings ?? [];

    const draft = {
      // id/serial intentionally omitted — the editor allocates them on save.
      name: built.name,
      category,
      format: built.format,
      equipment: equipmentMode,
      difficulty: difficultyLabel(stars),
      difficulty_stars: stars,
      duration: built.duration || durationLabel(minutes),
      description: built.description_html,
      main_workout: built.main_workout,
      instructions: built.instructions_html,
      tips: built.tips_html,
      focus: focus ?? "",
      image_url: "",
      generate_unique_image: true,
      is_free: access === "free",
      is_premium: access === "premium",
      tier_required: access === "premium" ? (body.tier_required || "premium") : "",
      is_standalone_purchase: access === "standalone",
      price: access === "standalone" ? String(body.price ?? "") : "",
      stripe_product_id: "",
      stripe_price_id: "",
      needs_review: built.needs_review || reviewWarnings.length > 0,
      generation_review_warnings: reviewWarnings,
    };

    log("✅ Drafted (not saved)", { name: built.name, warnings: reviewWarnings.length });

    return json({
      ok: true,
      draft,
      needs_review: draft.needs_review,
      review_warnings: reviewWarnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-admin-workout]", message);
    return json({ ok: false, error: message }, 500);
  }
});
