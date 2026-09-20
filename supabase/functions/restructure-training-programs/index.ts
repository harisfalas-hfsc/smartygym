// ═══════════════════════════════════════════════════════════════════════════════
// RESTRUCTURE TRAINING PROGRAMS
// One-shot admin endpoint that rebuilds every (or a subset of) training program
// using the Standardized Training Program Format:
//   📅 WEEK / 🎯 Objective / ① DAY … / 😴 Recovery / 🏁 Rest
// Preserves existing library-linked exercises ({{exercise:ID:Name}}) and pads
// each training day with library picks if the original had fewer than 5.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { buildProgramSkeleton, buildPhaseInstructions, buildDefaultTips } from "../_shared/program-template.ts";
import { buildDayBullets, buildExerciseBullet, filterLibraryForProgram, type LibExercise } from "../_shared/program-exercise-picker.ts";
import { normalizeWorkoutHtml } from "../_shared/html-normalizer.ts";
import { auditProgramCompliance } from "../_shared/program-compliance.ts";
import { parseProgramEquipmentIds } from "../_shared/program-doctrine.ts";
import { loadAllExercises } from "../_shared/workout-engine/pool.server.ts";
import { programMainFormat, programWorkExerciseViolation } from "../_shared/program-doctrine.ts";
import {
  guaranteeAllExercisesLinked,
  rejectNonLibraryExercises,
  repairStaticHoldPrescriptions,
  type ExerciseBasic,
} from "../_shared/exercise-matching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = "[RESTRUCTURE-PROG]";

function difficultyText(stars: number | null | undefined): string {
  const s = stars ?? 3;
  if (s >= 5) return "Advanced";
  if (s >= 3) return "Intermediate";
  return "Beginner";
}

/** Pull every existing {{exercise:ID:Name}} token from the program's content. */
function extractExistingTokens(content: string): Array<{ id: string; name: string }> {
  if (!content) return [];
  const tokens: Array<{ id: string; name: string }> = [];
  const re = /\{\{exercise:([^:}]+):([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    tokens.push({ id: m[1].trim(), name: m[2].trim() });
  }
  return tokens;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorized = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({} as { programIds?: string[]; dryRun?: boolean }));
    const { programIds, dryRun } = body as { programIds?: string[]; dryRun?: boolean };

    // 1. Load programs
    let q = supabase.from("admin_training_programs").select("*");
    if (programIds && programIds.length) q = q.in("id", programIds);
    else q = q.eq("is_visible", true);
    const { data: programs, error: pErr } = await q;
    if (pErr) throw pErr;
    if (!programs || !programs.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0, results: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load full exercise library (paginated)
    const allExercises: LibExercise[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, body_part, equipment, target, difficulty, description")
        .range(from, from + 999);
      if (error) throw error;
      if (!data || !data.length) break;
      allExercises.push(...(data as LibExercise[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    console.log(`${LOG} Library loaded: ${allExercises.length}`);
    const complianceLibrary = await loadAllExercises(supabase);

    const results: Array<{ id: string; name: string; status: string; bullets: number; reused: number }> = [];

    for (const p of programs) {
      const protectedLabel = `${p.id || ""} ${p.name || ""} ${p.category || ""}`.toLowerCase();
      if (protectedLabel.includes("hfsc")) {
        results.push({ id: p.id, name: p.name, status: "skipped-protected", bullets: 0, reused: 0 });
        continue;
      }

      const weeks = Number(p.weeks) || 4;
      const daysPerWeek = Number(p.days_per_week) || 4;
      const diff = difficultyText(p.difficulty_stars);
      const equipmentIds = parseProgramEquipmentIds(p.equipment);
      const library = filterLibraryForProgram(allExercises, p.equipment || "Equipment", diff, p.category || "", equipmentIds);
      if (!library.length) {
        results.push({ id: p.id, name: p.name, status: "no-library", bullets: 0, reused: 0 });
        continue;
      }

      // Reuse existing linked exercises
      const reusedTokens = extractExistingTokens(
        [p.weekly_schedule, p.program_structure, p.training_program].filter(Boolean).join("\n"),
      );
      // Map by ID — keep only IDs that still exist in the library
      const libById = new Map(library.map((e) => [e.id, e]));
      const reusedValid = p.category.toUpperCase().includes("WEIGHT LOSS")
        ? []
        : reusedTokens
          .filter((t) => libById.has(t.id))
          .map((t) => libById.get(t.id)!)
          .filter((exercise) => library.some((allowed) => allowed.id === exercise.id))
          .filter((exercise) => !programWorkExerciseViolation({
            ...exercise,
            equipment: exercise.equipment ?? null,
            target_muscle: exercise.target,
          }, p.category, programMainFormat(p.category, 1)));
      const usedQueue = [...reusedValid];
      let reusedUsed = 0;

      // Discover day titles from a 1-week skeleton (so we know each day's focus)
      const probe = buildProgramSkeleton({ category: p.category, weeks: 1, daysPerWeek });
      const titles: string[] = [];
      const re = /DAY (\d+) – ([^<]+)<\/strong>/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(probe)) !== null) {
        const dn = parseInt(mm[1]);
        if (dn <= daysPerWeek) titles.push(mm[2].trim());
      }

      // Build compact Week A/B templates: prefer reused exercises (rotated across days) then pad.
      // The weekly progression rules make this a 4/6/8+ week program; we do NOT
      // create a new workout for every week.
      const exercisesPerDay: string[][][] = [];
      let bulletTotal = 0;
      const templateCount = 2;
      for (let w = 1; w <= templateCount; w++) {
        const wk: string[][] = [];
        for (let d = 1; d <= daysPerWeek; d++) {
          const title = titles[d - 1] || "Training Day";
          const picks = buildDayBullets(library, p.category, title, w, d, 6, diff, weeks);
          // Swap in a reused exercise for the first slot when available to honor
          // the original program's curated picks.
          if (usedQueue.length) {
            const swap = usedQueue.shift()!;
            reusedUsed++;
            // First few lines are coaching note + headings; locate first bullet starting with "• {{exercise"
            const firstExIdx = picks.findIndex((l) => l.startsWith("• {{exercise"));
            if (firstExIdx >= 0) picks[firstExIdx] = buildExerciseBullet(swap, p.category, title);
          }
          wk.push(picks);
          bulletTotal += picks.length;
        }
        exercisesPerDay.push(wk);
      }

      let schedule = buildProgramSkeleton({
        category: p.category,
        weeks,
        daysPerWeek,
        exercisesPerDay,
      });

      // Defensive re-link sweep
      const sweep = guaranteeAllExercisesLinked(schedule, library as ExerciseBasic[], `${LOG}[${p.id}-SWEEP]`);
      schedule = sweep.processedContent;
      const rej = rejectNonLibraryExercises(schedule, library as ExerciseBasic[], `${LOG}[${p.id}-REJECT]`);
      schedule = rej.processedContent;
      schedule = repairStaticHoldPrescriptions(schedule, `${LOG}[${p.id}-HOLD-RX]`).processedContent;
      schedule = normalizeWorkoutHtml(schedule);

      const structure = normalizeWorkoutHtml(buildPhaseInstructions(weeks, p.category));
      const tips = normalizeWorkoutHtml(buildDefaultTips(p.category));

      const audit = auditProgramCompliance({
        category: p.category,
        equipment: p.equipment,
        weekly_schedule: schedule,
      }, complianceLibrary);
      if (!audit.passed) {
        results.push({ id: p.id, name: p.name, status: `invalid:${audit.issues.slice(0, 3).map((issue) => issue.code).join(",")}`, bullets: bulletTotal, reused: reusedUsed });
        continue;
      }

      if (!dryRun) {
        const { error: backupError } = await supabase.from("training_program_content_backup").insert({
          program_id: p.id,
          weekly_schedule: p.weekly_schedule,
          program_structure: p.program_structure,
          progression_plan: p.progression_plan,
          nutrition_tips: p.nutrition_tips,
          reason: "pre-program-doctrine-repair-2026-09-20",
        });
        if (backupError) {
          results.push({ id: p.id, name: p.name, status: `backup-error:${backupError.message}`, bullets: bulletTotal, reused: reusedUsed });
          continue;
        }
        const { error: uErr } = await supabase
          .from("admin_training_programs")
          .update({
            weekly_schedule: schedule,
            program_structure: structure,
            progression_plan: structure, // mirror so the legacy field is also clean
            nutrition_tips: tips,
          })
          .eq("id", p.id);
        if (uErr) {
          console.error(`${LOG} update failed`, p.id, uErr.message);
          results.push({ id: p.id, name: p.name, status: `error:${uErr.message}`, bullets: bulletTotal, reused: reusedUsed });
          continue;
        }
      }

      results.push({ id: p.id, name: p.name, status: dryRun ? "dry-run" : "ok", bullets: bulletTotal, reused: reusedUsed });
    }

    return new Response(JSON.stringify({ ok: true, processed: programs.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(`${LOG} fatal`, e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});