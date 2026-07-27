// Generate ONE custom admin training program from wizard metadata.
// Mirrors the workout generator: produces a draft (name, description,
// program_structure, weekly_schedule, nutrition_tips) using library-first
// markup and the M-3 Gold Standard format. NOTHING is written to the DB —
// the editor's Save button still owns serial/image/Stripe/insert.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  processContentWithExerciseMatching,
  fetchAndBuildExerciseReference,
  guaranteeAllExercisesLinked,
  rejectNonLibraryExercises,
  repairStaticHoldPrescriptions,
  type ExerciseBasic,
} from "../_shared/exercise-matching.ts";
import { normalizeWorkoutHtml } from "../_shared/html-normalizer.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { buildProgramSkeleton, buildPhaseInstructions, buildDefaultTips } from "../_shared/program-template.ts";
import { buildDayBullets, filterLibraryForProgram, type LibExercise } from "../_shared/program-exercise-picker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = "[WIZ-PROG]";
function log(step: string, details?: any) {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`${LOG} ${step}${d}`);
}

interface WizardBody {
  category: string;
  equipment: string;            // "Bodyweight" | "Equipment"
  difficulty_stars: number;     // 0..6
  weeks: number;                // 4 / 6 / 8
  days_per_week: number;        // 3..6
  access?: "free" | "premium" | "standalone";
  price?: string | number;
  tier_required?: string;
}

const CATEGORY_PHILOSOPHY: Record<string, string> = {
  "LOW BACK PAIN":
    "Therapeutic progression. Foundation (pain-free ROM, basic core activation), Build (gentle strengthening, stability), Progress (functional movement). McKenzie work, pelvic tilts, bird-dogs, bridges, dead bugs, cat-cow. No heavy loading. No explosive movement.",
  "CARDIO ENDURANCE":
    "Zone-based endurance: Zone 2 base (70-80% HR), threshold (85-90%), VO2 intervals (90-95%). Mix modalities and include complementary indoor circuits and metabolic work. Periodized base → intensity → peak → recovery.",
  "FUNCTIONAL STRENGTH":
    "Real-world strength: free-weight bias (deadlifts, squats, presses, pulls), carries, climbs, swings. Combine complementary lifts. Include mobility. Not bodybuilding.",
  "MUSCLE HYPERTROPHY":
    "Periodized hypertrophy with proper splits (UL / PPL / FB). Progressive overload, planned deloads (40-50%). Compound + isolation. 60-120s rest. Track sets/reps/tempo. Consistency over novelty.",
  "WEIGHT LOSS":
    "Strategic blend: cardio endurance + metabolic conditioning + calorie-burning + strength retention. Wave intensity. Address metabolic adaptation. Avoid daily HIIT.",
  "MOBILITY & STABILITY":
    "Joint-by-joint: ankles mobility, knees stability, hips mobility, lumbar stability, thoracic mobility, shoulders mobility. Pallof, planks, cat-cows, hanging, single-leg stands, breathing. Controlled, 30-60s holds. No explosive movement.",
};

function philosophyFor(category: string): string {
  const u = category.toUpperCase();
  for (const [k, v] of Object.entries(CATEGORY_PHILOSOPHY)) if (u.includes(k)) return v;
  return "Follow professional coaching standards for this category.";
}

function difficultyLabel(stars: number) {
  if (stars >= 5) return "Advanced";
  if (stars >= 3) return "Intermediate";
  return "Beginner";
}

// Admin wizard uses Pro for stronger instruction-following on long prompts
// (library-first rules, sets×reps math, M-3 format). Flash kept as fallback
// only if Pro rate-limits/errors. All prompts/rules unchanged.
const AI_MODELS = ["google/gemini-2.5-pro", "google/gemini-2.5-flash"];

function aiGatewayFailureMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.message || parsed?.title || parsed?.error;
    if (status === 402) {
      return "Lovable AI credits are exhausted. Add workspace credits, then try Generate & Review again.";
    }
    if (status === 429) {
      return "Lovable AI is rate limited right now. Wait a moment, then try Generate & Review again.";
    }
    return message ? `Lovable AI request failed (${status}): ${message}` : `Lovable AI request failed (${status})`;
  } catch {
    if (status === 402) {
      return "Lovable AI credits are exhausted. Add workspace credits, then try Generate & Review again.";
    }
    return `Lovable AI request failed (${status})`;
  }
}

async function callAI(apiKey: string, system: string, user: string, maxTokens = 16000): Promise<string | null> {
  for (const model of AI_MODELS) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.6,
          max_tokens: maxTokens,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.choices?.[0]?.message?.content;
        if (c) return c;
      } else {
        const raw = await r.text();
        log("AI non-OK", { model, status: r.status, body: raw.slice(0, 300) });
        if (r.status === 402) throw new Error(aiGatewayFailureMessage(r.status, raw));
        if (r.status === 429) await new Promise((s) => setTimeout(s, 8000));
      }
    } catch (e: any) {
      log("AI error", { model, err: e.message });
    }
  }
  return null;
}

async function generateProse(
  apiKey: string,
  field: "name" | "description" | "overview" | "program_structure" | "nutrition_tips",
  category: string,
  weeks: number,
  daysPerWeek: number,
  difficulty: number,
  equipment: string,
  philosophy: string,
): Promise<string | null> {
  const ctx = `Category: ${category}\nDuration: ${weeks} weeks, ${daysPerWeek} days/week\nDifficulty: ${difficulty}/6\nEquipment: ${equipment}\n${philosophy}`;
  if (field === "name") {
    const r = await callAI(
      apiKey,
      "You name training programs. Output ONLY the 2-4 word name — no quotes, no punctuation.",
      `Invent a unique, premium 2-4 word program name for:\n${ctx}\nAvoid overused words: Inferno, Blaze, Storm, Beast, Warrior, Elite, Ultimate, Foundation, Engine, Catalyst, Flow, Restore, Gauntlet, Summit, Crucible.`,
      80,
    );
    return r?.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 60) || null;
  }
  const titles = {
    description: "2-3 paragraph program overview — what it delivers, who it's for, expected outcomes. No exercise names. No {{exercise:}} markup.",
    overview: "3-4 paragraph in-depth program overview explaining the training philosophy, split logic, compact Week A/Week B template system, and progression model. Different angle from the short description. No exercise names. No {{exercise:}} markup.",
    program_structure: "1-2 paragraph explanation that the program uses only Week A and Week B workout templates, repeated with weekly progression rules. No exercise names. No {{exercise:}} markup.",
    nutrition_tips: "3-5 sentence nutrition and recovery guidance tied to the program category. No exercise names. No {{exercise:}} markup.",
  } as const;
  const r = await callAI(
    apiKey,
    "You are an expert fitness coach writing program copy. Output HTML using <p class=\"tiptap-paragraph\"> tags only.",
    `Write a ${titles[field]}\n${ctx}`,
    1500,
  );
  return r ? r.trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorized = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = (await req.json()) as WizardBody;
    if (!body?.category) throw new Error("category is required");

    const equipment = body.equipment || "Equipment";
    const weeks = Math.min(Math.max(body.weeks || 4, 4), 8);
    const daysPerWeek = Math.min(Math.max(body.days_per_week || 4, 3), 6);
    const difficulty = body.difficulty_stars ?? 3;
    const access = body.access || "free";
    const difficultyText = difficultyLabel(difficulty);
    const philosophy = philosophyFor(body.category);

    log("Wizard request", { category: body.category, equipment, weeks, daysPerWeek, difficulty, access });

    // Library — filter to bodyweight when requested
    const equipFilter = equipment.toLowerCase().includes("bodyweight") ? "body weight" : undefined;
    const { exercises: rawLibrary } =
      await fetchAndBuildExerciseReference(supabase, "[WIZ-PROG]", equipFilter, difficultyText.toLowerCase());
    if (!rawLibrary || rawLibrary.length === 0) throw new Error("No exercises available for this equipment/difficulty.");
    const library: LibExercise[] = filterLibraryForProgram(rawLibrary as LibExercise[], equipment, difficultyText, body.category);
    log("Library filtered", { remaining: library.length });

    // ── 1. Name (cheap AI) ─────────────────────────────────────────────────
    const name = (await generateProse(lovableApiKey, "name", body.category, weeks, daysPerWeek, difficulty, equipment, philosophy))
      || `${body.category.split(" ")[0]} Protocol`;

    // ── 2. Description (cheap AI) — overview only, no exercises ────────────
    const descriptionRaw = await generateProse(
      lovableApiKey, "description", body.category, weeks, daysPerWeek, difficulty, equipment, philosophy,
    );

    // ── 2b. Overview (longer narrative for the program page) ───────────────
    const overviewRaw = await generateProse(
      lovableApiKey, "overview", body.category, weeks, daysPerWeek, difficulty, equipment, philosophy,
    );

    // ── 3. Compact Week A/B schedule via STANDARDIZED SKELETON + deterministic library picks ──
    // We do NOT ask the model to pick exercises. The picker guarantees every
    // bullet is a real {{exercise:ID:Name}} token (eye icon) and respects the
    // equipment/difficulty constraints exactly.
    const dayTitlesByCategory = (() => {
      // Light wrapper so we can grab the same day titles the skeleton uses.
      // We rebuild here ONLY to know each day's focus for exercise picking.
      const skeleton = buildProgramSkeleton({ category: body.category, weeks: 1, daysPerWeek });
      const titles: string[] = [];
      const re = /DAY (\d+) – ([^<]+)<\/strong>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(skeleton)) !== null) {
        const dayNum = parseInt(m[1]);
        if (dayNum <= daysPerWeek) titles.push(m[2].trim());
      }
      return titles;
    })();

    const exercisesPerDay: string[][][] = [];
    const templateCount = 2;
    for (let w = 1; w <= templateCount; w++) {
      const wk: string[][] = [];
      for (let d = 1; d <= daysPerWeek; d++) {
        const title = dayTitlesByCategory[d - 1] || "Training Day";
        wk.push(buildDayBullets(library, body.category, title, w, d, 6, difficultyText, weeks));
      }
      exercisesPerDay.push(wk);
    }

    let fullSchedule = buildProgramSkeleton({
      category: body.category,
      weeks,
      daysPerWeek,
      exercisesPerDay,
    });

    // ── 4. Defense-in-depth: re-run library matching to enforce no plain names ──
    const matched = processContentWithExerciseMatching(fullSchedule, library as ExerciseBasic[], `${LOG}[MATCH]`);
    fullSchedule = matched.processedContent;
    const sweep = guaranteeAllExercisesLinked(fullSchedule, library as ExerciseBasic[], `${LOG}[SWEEP]`);
    fullSchedule = sweep.processedContent;
    const reject = rejectNonLibraryExercises(fullSchedule, library as ExerciseBasic[], `${LOG}[REJECT]`);
    fullSchedule = reject.processedContent;
    fullSchedule = repairStaticHoldPrescriptions(fullSchedule, `${LOG}[HOLD-RX]`).processedContent;

    // ── 5. Phase instructions + tips (deterministic, no AI) ────────────────
    const construction = buildPhaseInstructions(weeks, body.category);
    const finalTips = buildDefaultTips(body.category);

    // ── 6. Normalize HTML ──────────────────────────────────────────────────
    fullSchedule = normalizeWorkoutHtml(fullSchedule);
    const description = descriptionRaw ? normalizeWorkoutHtml(descriptionRaw) : "";
    const overview = overviewRaw ? normalizeWorkoutHtml(overviewRaw) : description;

    const draft = {
      // id/serial intentionally omitted — editor allocates them on Save.
      name,
      category: body.category,
      equipment,
      difficulty: difficultyText,
      difficulty_stars: difficulty,
      weeks,
      days_per_week: daysPerWeek,
      // ProgramEditDialog field names:
      training_program: fullSchedule,
      program_description: description,
      overview,
      construction,
      final_tips: finalTips,
      image_url: "",
      generate_unique_image: true,
      is_free: access === "free",
      is_premium: access === "premium" || access === "standalone",
      is_standalone_purchase: access === "standalone",
      tier_required: access === "premium" ? (body.tier_required || "premium") : "",
      price: access === "standalone" ? String(body.price ?? "") : "",
      stripe_product_id: "",
      stripe_price_id: "",
    };

    log("✅ Drafted (not saved)", { name, scheduleChars: fullSchedule.length });
    return new Response(JSON.stringify({ ok: true, draft }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log("Fatal", { err: e.message });
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});