// ═══════════════════════════════════════════════════════════════════════════════
// REPROCESS WOD EXERCISES  (v2 — re-deployed 2026-02-22)
// Re-runs exercise matching on existing WODs to fix broken/missing links
// SECTION-AWARE: Only processes Main Workout and Finisher sections
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  processContentSectionAware,
  processContentWithExerciseMatching,
  stripExerciseMarkup,
  logUnmatchedExercises,
  guaranteeAllExercisesLinked,
  rejectNonLibraryExercises,
  repairStaticHoldPrescriptions,
  type ExerciseBasic,
} from "../_shared/exercise-matching.ts";
import { normalizeWorkoutHtml } from "../_shared/html-normalizer.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  const LOG_PREFIX = "[REPROCESS-WOD]";
  console.log(`${LOG_PREFIX} 🔄 Starting WOD exercise reprocessing (section-aware + force-match)...`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { wodIds, targetDate, processAll, batchOffset = 0, batchSize = 50 } = body;

    console.log(`${LOG_PREFIX} Request params:`, { wodIds, targetDate, processAll, batchOffset, batchSize });

    let wodsQuery = supabase
      .from("admin_workouts")
      .select("id, name, main_workout, warm_up, cool_down, finisher, activation, instructions, tips, notes")
      .order("id");

    if (wodIds && Array.isArray(wodIds) && wodIds.length > 0) {
      wodsQuery = wodsQuery.in("id", wodIds);
    } else if (targetDate) {
      wodsQuery = wodsQuery.eq("generated_for_date", targetDate);
    } else if (processAll) {
      wodsQuery = wodsQuery.range(batchOffset, batchOffset + batchSize - 1);
      console.log(`${LOG_PREFIX} Processing batch: offset=${batchOffset}, size=${batchSize}`);
    } else {
      const today = new Date().toISOString().split("T")[0];
      wodsQuery = wodsQuery.eq("generated_for_date", today);
    }

    const { data: wods, error: wodsError } = await wodsQuery;

    if (wodsError) {
      console.error(`${LOG_PREFIX} ❌ Error fetching WODs:`, wodsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch WODs", details: wodsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!wods || wods.length === 0) {
      console.log(`${LOG_PREFIX} ⚠️ No WODs found to reprocess`);
      return new Response(
        JSON.stringify({ message: "No WODs found to reprocess", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${LOG_PREFIX} Found ${wods.length} WODs to reprocess`);

    // Paginate to load ALL exercises (Supabase caps at 1000 per request)
    const exerciseLibrary: Array<{ id: string; name: string; body_part: string; equipment: string; target: string }> = [];
    let exFrom = 0;
    const exPageSize = 1000;
    while (true) {
      const { data, error: libraryError } = await supabase
        .from("exercises")
        .select("id, name, body_part, equipment, target")
        .range(exFrom, exFrom + exPageSize - 1);

      if (libraryError) {
        console.error(`${LOG_PREFIX} ❌ Error fetching exercise library:`, libraryError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch exercise library" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!data || data.length === 0) break;
      exerciseLibrary.push(...data);
      if (data.length < exPageSize) break;
      exFrom += exPageSize;
    }

    if (exerciseLibrary.length === 0) {
      return new Response(
        JSON.stringify({ error: "Exercise library is empty" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${LOG_PREFIX} Loaded ${exerciseLibrary.length} exercises from library`);

    const results: Array<{
      id: string;
      name: string;
      matched: number;
      unmatched: number;
      unmatchedNames: string[];
    }> = [];

    for (const wod of wods) {
      console.log(`${LOG_PREFIX} 📋 Processing: "${wod.name}" (${wod.id})`);

      const updates: Record<string, string> = {};
      let totalMatched = 0;
      const allUnmatched: string[] = [];

      // ── Process ALL fields with exercise matching ──
      // main_workout uses section-aware processing (handles emoji headers)
      if (wod.main_workout) {
        const result = processContentSectionAware(
          wod.main_workout,
          exerciseLibrary as ExerciseBasic[],
          `${LOG_PREFIX}[main_workout]`
        );
        updates.main_workout = result.processedContent;
        totalMatched += result.matched.length;
        allUnmatched.push(...result.unmatched);
      }

      // ── warm_up, cool_down, activation, instructions, tips, notes: Process with exercise matching ──
      for (const field of ["warm_up", "cool_down", "activation", "instructions", "tips", "notes"] as const) {
        const content = wod[field] as string | null;
        if (content) {
          const strippedContent = stripExerciseMarkup(content);
          const result = processContentWithExerciseMatching(
            strippedContent,
            exerciseLibrary as ExerciseBasic[],
            `${LOG_PREFIX}[${field}]`
          );
          updates[field] = result.processedContent;
          totalMatched += result.matched.length;
          allUnmatched.push(...result.unmatched);
        }
      }

      // ── finisher: Process with force-matching ──
      if (wod.finisher) {
        const strippedFinisher = stripExerciseMarkup(wod.finisher);
        const result = processContentWithExerciseMatching(
          strippedFinisher,
          exerciseLibrary as ExerciseBasic[],
          `${LOG_PREFIX}[finisher]`
        );
        updates.finisher = result.processedContent;
        totalMatched += result.matched.length;
        allUnmatched.push(...result.unmatched);
      }

      // ── BULLETPROOF FINAL SWEEP + STRICT REJECTION on all fields ──
      for (const field of ["main_workout", "warm_up", "cool_down", "activation", "finisher", "instructions", "tips", "notes"] as const) {
        if (updates[field]) {
          // Final sweep: link remaining exercises
          const sweep = guaranteeAllExercisesLinked(
            updates[field],
            exerciseLibrary as ExerciseBasic[],
            `${LOG_PREFIX}[${field}-FINAL-SWEEP]`
          );
          updates[field] = sweep.processedContent;
          totalMatched += sweep.forcedMatches.length;
          
          // Strict rejection: remove any exercise NOT in library
          const rejection = rejectNonLibraryExercises(
            updates[field],
            exerciseLibrary as ExerciseBasic[],
            `${LOG_PREFIX}[${field}-REJECT]`
          );
          updates[field] = rejection.processedContent;
          updates[field] = repairStaticHoldPrescriptions(updates[field], `${LOG_PREFIX}[${field}-HOLD-RX]`).processedContent;
        }
      }

      // ── NORMALIZE HTML before saving ──
      for (const field of Object.keys(updates)) {
        updates[field] = normalizeWorkoutHtml(updates[field]);
      }

      // Update the WOD
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("admin_workouts")
          .update(updates)
          .eq("id", wod.id);

        if (updateError) {
          console.error(`${LOG_PREFIX} ❌ Failed to update WOD "${wod.name}":`, updateError);
        } else {
          console.log(`${LOG_PREFIX} ✅ Updated WOD "${wod.name}" - ${totalMatched} exercises matched`);
        }
      }

      // Clear old mismatched entries
      await supabase
        .from("mismatched_exercises")
        .delete()
        .eq("source_id", wod.id);

      // Log new unmatched
      const uniqueUnmatched = [...new Set(allUnmatched)];
      if (uniqueUnmatched.length > 0) {
        await logUnmatchedExercises(supabase, uniqueUnmatched, "wod", wod.id, wod.name, LOG_PREFIX);
      }

      results.push({
        id: wod.id,
        name: wod.name,
        matched: totalMatched,
        unmatched: uniqueUnmatched.length,
        unmatchedNames: uniqueUnmatched,
      });
    }

    console.log(`${LOG_PREFIX} ✅ Completed reprocessing ${wods.length} WODs`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: wods.length,
        batchOffset,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
