// ═══════════════════════════════════════════════════════════════════════════════
// REPROCESS PROGRAM EXERCISES
// Re-runs exercise matching on existing training programs to fix broken/missing links
// Programs have NO section filtering — ALL exercises get View buttons
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
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

  const LOG_PREFIX = "[REPROCESS-PROGRAM]";
  console.log(`${LOG_PREFIX} 🔄 Starting training program exercise reprocessing (force-match)...`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { programIds } = body;

    console.log(`${LOG_PREFIX} Request params:`, { programIds });

    let programsQuery = supabase
      .from("admin_training_programs")
      .select("id, name, overview, program_structure, weekly_schedule, progression_plan, nutrition_tips, expected_results");

    if (programIds && Array.isArray(programIds) && programIds.length > 0) {
      programsQuery = programsQuery.in("id", programIds);
    }

    const { data: programs, error: programsError } = await programsQuery;

    if (programsError) {
      console.error(`${LOG_PREFIX} ❌ Error fetching programs:`, programsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch programs", details: programsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!programs || programs.length === 0) {
      console.log(`${LOG_PREFIX} ⚠️ No programs found to reprocess`);
      return new Response(
        JSON.stringify({ message: "No programs found to reprocess", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${LOG_PREFIX} Found ${programs.length} programs to reprocess:`, programs.map(p => p.name));

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

    // Only process fields that contain actual exercise content
    // overview, nutrition_tips, expected_results are informational — skip them
    const exerciseContentFields = ["program_structure", "weekly_schedule"];

    for (const program of programs) {
      console.log(`${LOG_PREFIX} 📋 Processing: "${program.name}" (${program.id})`);

      const updates: Record<string, string> = {};
      let totalMatched = 0;
      const allUnmatched: string[] = [];

      for (const field of exerciseContentFields) {
        const content = program[field as keyof typeof program] as string | null;
        if (!content) continue;

        console.log(`${LOG_PREFIX} Processing field: ${field} (${content.length} chars)`);
        
        // Strip old markup first, then re-process
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

      // ── BULLETPROOF FINAL SWEEP + STRICT REJECTION on all fields ──
      for (const field of exerciseContentFields) {
        if (updates[field]) {
          const sweep = guaranteeAllExercisesLinked(
            updates[field],
            exerciseLibrary as ExerciseBasic[],
            `${LOG_PREFIX}[${field}-FINAL-SWEEP]`
          );
          updates[field] = sweep.processedContent;
          totalMatched += sweep.forcedMatches.length;

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

      // Update the program with processed content
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("admin_training_programs")
          .update(updates)
          .eq("id", program.id);

        if (updateError) {
          console.error(`${LOG_PREFIX} ❌ Failed to update program "${program.name}":`, updateError);
        } else {
          console.log(`${LOG_PREFIX} ✅ Updated program "${program.name}" - ${totalMatched} exercises matched`);
        }
      }

      // Clear old mismatched entries for this program
      const { error: deleteError } = await supabase
        .from("mismatched_exercises")
        .delete()
        .eq("source_id", program.id);

      if (deleteError) {
        console.log(`${LOG_PREFIX} ⚠️ Failed to clear old mismatches:`, deleteError.message);
      }

      // Log new unmatched exercises
      const uniqueUnmatched = [...new Set(allUnmatched)];
      if (uniqueUnmatched.length > 0) {
        await logUnmatchedExercises(
          supabase,
          uniqueUnmatched,
          "program",
          program.id,
          program.name,
          LOG_PREFIX
        );
      }

      results.push({
        id: program.id,
        name: program.name,
        matched: totalMatched,
        unmatched: uniqueUnmatched.length,
        unmatchedNames: uniqueUnmatched,
      });
    }

    console.log(`${LOG_PREFIX} ✅ Completed reprocessing ${programs.length} programs`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: programs.length,
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
