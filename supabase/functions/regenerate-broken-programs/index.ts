// ═══════════════════════════════════════════════════════════════════════════════
// REGENERATE BROKEN PROGRAMS
// Fixes training programs with corrupted/incomplete content by regenerating
// week-by-week using AI with full exercise library integration
// Uses M-3 (Hypertrophy Accelerator) as the GOLD STANDARD format
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  processContentWithExerciseMatching,
  fetchAndBuildExerciseReference,
  logUnmatchedExercises,
  findBestMatch,
  guaranteeAllExercisesLinked,
  rejectNonLibraryExercises,
  repairStaticHoldPrescriptions,
  type ExerciseBasic,
} from "../_shared/exercise-matching.ts";
import { normalizeWorkoutHtml } from "../_shared/html-normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = "[REGEN-PROGRAM]";

// Category-specific philosophy for the AI prompt
const CATEGORY_PHILOSOPHY: Record<string, string> = {
  "LOW BACK PAIN": `**LOW BACK PAIN - "The Rehabilitation Specialist"**
People here have post-surgery recovery, herniated discs, sciatica, chronic sitting posture.
APPROACH: Step-by-step progression. Week 1-2: Foundation (pain-free ROM, basic core activation).
Week 3-4: Build (gentle strengthening, improved stability). Week 5+: Progress (functional movements).
Include: McKenzie exercises, pelvic tilts, bird-dogs, bridges, dead bugs, cat-cow.
Breathing is essential. SAFETY IS PARAMOUNT. No heavy loading. No explosive movements.
Exercises should be gentle, therapeutic, and progressive.`,

  "CARDIO ENDURANCE": `**CARDIO ENDURANCE - "The Endurance Builder"**
For runners, cyclists, swimmers wanting to improve cardiovascular capacity.
Use SPECIFIC PROTOCOLS: Zone 2 training (70-80% max HR), Threshold training (85-90% HR),
Above threshold intervals (90-95% HR, VO2 max work).
Mix modalities: running, biking, rowing, elliptical.
Include complementary indoor workouts (circuits, metabolic work).
Progressive structure: build aerobic base → add intensity → peak → recovery.
Explain heart rate zones and pacing strategies.`,

  "FUNCTIONAL STRENGTH": `**FUNCTIONAL STRENGTH - "The Everyday Athlete"**
This is NOT bodybuilding. Strong in LIFE: climbers, hikers, parents, athletes.
PREFER FREE WEIGHTS: deadlifts, squats, presses, pulls (for function, not 1RM).
Include: pull-ups, cleans, swings, farmer carries, loaded carries.
Combine exercises that complement each other. Evidence-based training.
Functional = real-world strength. Include mobility work.`,

  "MUSCLE HYPERTROPHY": `**MUSCLE HYPERTROPHY - "The Mass Builder"**
Serious muscle building with PERIODIZATION and PROTOCOLS:
Use training splits: Upper/Lower, Push/Pull/Legs, or Full Body.
PERIODIZATION: Loading weeks (progressive overload), Deload weeks (reduce 40-50%).
Include compound lifts, isolation work, time under tension.
Track: sets, reps, rest, tempo. DO NOT change protocols daily - CONSISTENCY builds muscle.
Rest: 60-120s between sets for hypertrophy.`,

  "WEIGHT LOSS": `**WEIGHT LOSS - "The Transformation"**
Strategic combination to maximize calorie burn and metabolic adaptation:
Combine: cardio endurance, metabolic conditioning, calorie-burning workouts.
PROPER PRIORITIZATION: when to do what type. DIFFICULTY SCALING: wave intensity.
Include HIIT, steady-state cardio, metabolic circuits, strength to preserve muscle.
Address metabolic adaptation and avoiding plateaus.`,

  "MOBILITY & STABILITY": `**MOBILITY & STABILITY - "The Joint Specialist"**
Think like a physical therapist. Address major joints:
ANKLES → MOBILITY, KNEES → STABILITY, HIPS → MOBILITY,
LUMBAR SPINE → STABILITY, THORACIC SPINE → MOBILITY, SHOULDERS → MOBILITY.
Include: core stability (Pallof presses, planks), mobility flows (cat-cows, scorpions),
decompression (hanging), balance work (single-leg stands), breathing coordination.
Controlled movements, holds 30-60 seconds. No explosive movements.`,
};

function getCategoryPhilosophy(category: string): string {
  const upper = category.toUpperCase();
  for (const [key, value] of Object.entries(CATEGORY_PHILOSOPHY)) {
    if (upper.includes(key)) return value;
  }
  return "Follow professional fitness coaching standards for this category.";
}

// Category-to-filter mapping for relevant exercises
function getRelevantFilters(category: string, equipment: string): { bodyParts?: string[]; equipmentFilter?: string } {
  const upper = category.toUpperCase();
  const isBodyweight = equipment.toLowerCase().includes("bodyweight") || equipment.toLowerCase().includes("body weight");
  
  if (upper.includes("LOW BACK PAIN")) {
    return { bodyParts: ["back", "waist", "upper legs", "lower legs"], equipmentFilter: isBodyweight ? "body weight" : undefined };
  }
  if (upper.includes("MOBILITY") || upper.includes("STABILITY")) {
    return { bodyParts: ["back", "waist", "upper legs", "lower legs", "shoulders", "upper arms"], equipmentFilter: isBodyweight ? "body weight" : undefined };
  }
  if (upper.includes("CARDIO")) {
    return { equipmentFilter: isBodyweight ? "body weight" : undefined };
  }
  return {}; // Full library for hypertrophy, weight loss, functional
}

// Build a condensed exercise reference (ID:Name only, grouped by target)
function buildCondensedReference(exercises: ExerciseBasic[]): string {
  const grouped: Record<string, Array<{ id: string; name: string }>> = {};
  for (const ex of exercises) {
    const key = `${ex.target} / ${ex.body_part}`.toUpperCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ id: ex.id, name: ex.name });
  }
  
  const lines: string[] = [
    'EXERCISE LIBRARY (use ONLY these exercises, format: {{exercise:ID:Name}})',
    '═══════════════════════════════════════════════════════════════════════',
    '',
  ];
  
  for (const key of Object.keys(grouped).sort()) {
    lines.push(`[${key}]`);
    for (const ex of grouped[key].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  ${ex.id} | ${ex.name}`);
    }
  }
  
  lines.push('', 'MANDATORY: Write EVERY exercise as {{exercise:ID:Exact Name}} from this list.');
  return lines.join('\n');
}

interface ProgramRow {
  id: string;
  name: string;
  category: string;
  weeks: number | null;
  days_per_week: number | null;
  difficulty_stars: number | null;
  equipment: string | null;
  description: string | null;
  overview: string | null;
  weekly_schedule: string | null;
  program_structure: string | null;
  progression_plan: string | null;
  nutrition_tips: string | null;
  expected_results: string | null;
  target_audience: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { programIds, dryRun = false, fixOnly = false } = body;

    if (!programIds || !Array.isArray(programIds) || programIds.length === 0) {
      return new Response(JSON.stringify({ error: "programIds array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`${LOG} 🔄 Starting ${fixOnly ? 'FIX-ONLY' : 'regeneration'} for ${programIds.length} programs (dryRun=${dryRun})`);

    // Load FULL exercise library (we'll filter per-program)
    const allExercises: ExerciseBasic[] = [];
    let exFrom = 0;
    const exPageSize = 1000;
    while (true) {
      const { data, error: libErr } = await supabase
        .from("exercises")
        .select("id, name, body_part, equipment, target")
        .eq("is_generation_enabled", true)
        .range(exFrom, exFrom + exPageSize - 1);
      if (libErr || !data || data.length === 0) break;
      allExercises.push(...(data as ExerciseBasic[]));
      if (data.length < exPageSize) break;
      exFrom += exPageSize;
    }

    if (allExercises.length === 0) {
      return new Response(JSON.stringify({ error: "Exercise library is empty" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`${LOG} Loaded ${allExercises.length} exercises`);

    // Fetch programs
    const { data: programs, error: fetchErr } = await supabase
      .from("admin_training_programs")
      .select("id, name, category, weeks, days_per_week, difficulty_stars, equipment, description, overview, weekly_schedule, program_structure, progression_plan, nutrition_tips, expected_results, target_audience")
      .in("id", programIds);

    if (fetchErr || !programs || programs.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to fetch programs", details: fetchErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{
      id: string;
      name: string;
      status: string;
      weeksGenerated: number;
      totalChars: number;
      error?: string;
    }> = [];

    // Process each program sequentially (AI calls are heavy)
    for (const program of programs as ProgramRow[]) {
      console.log(`${LOG} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`${LOG} 📋 ${fixOnly ? 'Fix-only' : 'Regenerating'}: "${program.name}" (${program.id})`);
      console.log(`${LOG}    Category: ${program.category}, Weeks: ${program.weeks}, Days/wk: ${program.days_per_week}`);

      try {
        // ══════════════════════════════════════════════════════════════
        // FIX-ONLY MODE: Clean existing content without regeneration
        // ══════════════════════════════════════════════════════════════
        if (fixOnly) {
          let content = program.weekly_schedule || '';
          if (!content) {
            results.push({ id: program.id, name: program.name, status: "skipped_empty", weeksGenerated: 0, totalChars: 0 });
            continue;
          }

          // Step 1: Fix malformed tags
          content = fixMalformedExerciseTags(content, allExercises);

          // Step 2: Run exercise matching on untagged exercises
          const matchResult = processContentWithExerciseMatching(content, allExercises, `${LOG}[FIX]`);
          content = matchResult.processedContent;

          // Step 3: Clean corrupted text patterns
          content = cleanCorruptedText(content);

          // Step 4: Final sweep - link remaining exercises
          const sweepResult = guaranteeAllExercisesLinked(content, allExercises, `${LOG}[FIX-SWEEP]`);
          content = sweepResult.processedContent;

          // Step 5: Strict rejection - remove non-library exercises
          const rejectResult = rejectNonLibraryExercises(content, allExercises, `${LOG}[FIX-REJECT]`);
          content = rejectResult.processedContent;
          content = repairStaticHoldPrescriptions(content, `${LOG}[FIX-HOLD-RX]`).processedContent;

          console.log(`${LOG}   Fix-only: ${matchResult.matched.length} matched, ${sweepResult.forcedMatches.length} swept, ${matchResult.unmatched.length} unmatched`);

          // GOLD STANDARD: Normalize HTML before saving
          content = normalizeWorkoutHtml(content);

          if (!dryRun) {
            const { error: updateErr } = await supabase
              .from("admin_training_programs")
              .update({ weekly_schedule: content })
              .eq("id", program.id);

            if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

            const uniqueUnmatched = [...new Set(matchResult.unmatched)];
            if (uniqueUnmatched.length > 0) {
              await supabase.from("mismatched_exercises").delete().eq("source_id", program.id);
              await logUnmatchedExercises(supabase, uniqueUnmatched, "program", program.id, program.name, LOG);
            }
          }

          results.push({
            id: program.id, name: program.name, status: dryRun ? "dry_run_fix" : "fixed",
            weeksGenerated: program.weeks || 0, totalChars: content.length,
          });
          continue;
        }

        // ══════════════════════════════════════════════════════════════
        // FULL REGENERATION MODE
        // ══════════════════════════════════════════════════════════════
        const totalWeeks = program.weeks || 6;
        const daysPerWeek = program.days_per_week || 4;
        const difficulty = program.difficulty_stars || 3;
        const equipment = program.equipment || "Full Gym";
        const philosophy = getCategoryPhilosophy(program.category);

        // Filter exercises relevant to this category
        const filters = getRelevantFilters(program.category, equipment);
        let filteredExercises = allExercises;
        if (filters.bodyParts) {
          filteredExercises = filteredExercises.filter(ex =>
            filters.bodyParts!.some(bp => ex.body_part.toLowerCase().includes(bp))
          );
        }
        if (filters.equipmentFilter) {
          filteredExercises = filteredExercises.filter(ex =>
            ex.equipment.toLowerCase() === filters.equipmentFilter!.toLowerCase()
          );
        }
        // Fallback: if filter is too aggressive, use full library
        if (filteredExercises.length < 50) filteredExercises = allExercises;
        
        const exerciseRef = buildCondensedReference(filteredExercises);
        console.log(`${LOG}   Using ${filteredExercises.length} exercises (filtered from ${allExercises.length})`);

        // Generate week-by-week in 2-week chunks
        const weekChunks: string[] = [];
        const chunkSize = 2;

        for (let startWeek = 1; startWeek <= totalWeeks; startWeek += chunkSize) {
          const endWeek = Math.min(startWeek + chunkSize - 1, totalWeeks);
          console.log(`${LOG}   Generating weeks ${startWeek}-${endWeek}...`);

          const systemPrompt = buildSystemPrompt(exerciseRef, philosophy, program.category);
          const userPrompt = buildUserPrompt(program, startWeek, endWeek, totalWeeks, daysPerWeek, difficulty, equipment);

          const aiContent = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt);

          if (!aiContent) {
            throw new Error(`AI returned empty content for weeks ${startWeek}-${endWeek}`);
          }

          console.log(`${LOG}   ✅ Weeks ${startWeek}-${endWeek}: ${aiContent.length} chars`);
          weekChunks.push(aiContent);
        }

        // Combine all week chunks
        let fullSchedule = weekChunks.join('\n<p class="tiptap-paragraph"></p>\n');

        // Step 1: Fix malformed exercise tags from AI output
        fullSchedule = fixMalformedExerciseTags(fullSchedule, allExercises);

        // Step 2: Run exercise matching on remaining untagged exercises
        const matchResult = processContentWithExerciseMatching(
          fullSchedule,
          allExercises,
          `${LOG}[MATCH]`
        );
        fullSchedule = matchResult.processedContent;

        // Step 3: Clean corrupted text
        fullSchedule = cleanCorruptedText(fullSchedule);

        // Step 4: Final sweep - link remaining exercises
        const sweepResult = guaranteeAllExercisesLinked(fullSchedule, allExercises, `${LOG}[SWEEP]`);
        fullSchedule = sweepResult.processedContent;

        // Step 5: Strict rejection - remove non-library exercises
        const rejectResult = rejectNonLibraryExercises(fullSchedule, allExercises, `${LOG}[REJECT]`);
        fullSchedule = rejectResult.processedContent;
        fullSchedule = repairStaticHoldPrescriptions(fullSchedule, `${LOG}[HOLD-RX]`).processedContent;

        console.log(`${LOG}   Exercise matching: ${matchResult.matched.length} matched, ${sweepResult.forcedMatches.length} swept, ${matchResult.unmatched.length} unmatched`);

        // Generate overview and progression if missing/short
        let overview = program.overview;
        let progressionPlan = program.progression_plan;

        if (!overview || overview.length < 200) {
          overview = await generateOverview(LOVABLE_API_KEY, program, philosophy);
          console.log(`${LOG}   Generated overview: ${overview?.length || 0} chars`);
        }

        if (!progressionPlan || progressionPlan.length < 200) {
          progressionPlan = await generateProgressionPlan(LOVABLE_API_KEY, program, philosophy);
          console.log(`${LOG}   Generated progression plan: ${progressionPlan?.length || 0} chars`);
        }

        // GOLD STANDARD: Normalize all HTML fields before saving
        fullSchedule = normalizeWorkoutHtml(fullSchedule);
        if (overview) overview = normalizeWorkoutHtml(overview);
        if (progressionPlan) progressionPlan = normalizeWorkoutHtml(progressionPlan);

        if (!dryRun) {
          // Update program
          const updates: Record<string, string | null> = {
            weekly_schedule: fullSchedule,
          };
          if (overview) updates.overview = overview;
          if (progressionPlan) updates.progression_plan = progressionPlan;

          const { error: updateErr } = await supabase
            .from("admin_training_programs")
            .update(updates)
            .eq("id", program.id);

          if (updateErr) {
            throw new Error(`DB update failed: ${updateErr.message}`);
          }

          // Log unmatched exercises
          const uniqueUnmatched = [...new Set(matchResult.unmatched)];
          if (uniqueUnmatched.length > 0) {
            await supabase.from("mismatched_exercises").delete().eq("source_id", program.id);
            await logUnmatchedExercises(supabase, uniqueUnmatched, "program", program.id, program.name, LOG);
          }

          console.log(`${LOG}   ✅ Saved to database`);
        } else {
          console.log(`${LOG}   🔍 Dry run - not saving`);
        }

        results.push({
          id: program.id,
          name: program.name,
          status: dryRun ? "dry_run" : "regenerated",
          weeksGenerated: totalWeeks,
          totalChars: fullSchedule.length,
        });
      } catch (err) {
        console.error(`${LOG}   ❌ Failed: ${err}`);
        results.push({
          id: program.id,
          name: program.name,
          status: "error",
          weeksGenerated: 0,
          totalChars: 0,
          error: String(err),
        });
      }
    }

    const successCount = results.filter(r => r.status !== "error").length;
    console.log(`${LOG} ✅ Completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, successCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`${LOG} ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── AI Call Helper ───────────────────────────────────────────────────────────

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${LOG} AI API error ${response.status}:`, errorText.substring(0, 200));
    if (response.status === 429) {
      // Rate limited - wait and retry once
      console.log(`${LOG} Rate limited, waiting 10s and retrying...`);
      await new Promise(r => setTimeout(r, 10000));
      return callAI(apiKey, systemPrompt, userPrompt);
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || null;
}

// ─── System Prompt Builder (M-3 GOLD STANDARD FORMAT) ─────────────────────────

function buildSystemPrompt(exerciseRef: string, philosophy: string, category: string): string {
  return `You are an expert fitness coach creating a PROFESSIONAL, COMPLETE training program.

${exerciseRef}

MANDATORY: For EVERY exercise, write it as: {{exercise:ID:Exact Name}}
Pick the ID and Name EXACTLY from the library above.
If you write ANY exercise without {{exercise:ID:Name}} format, the program will be REJECTED.

${philosophy}

=== OUTPUT FORMAT (CRITICAL - FOLLOW THE M-3 GOLD STANDARD EXACTLY) ===

You MUST follow this EXACT HTML structure. This is the ONLY acceptable format:

**WEEK HEADERS:**
<p class="tiptap-paragraph"><strong><u>Week 1-2 (Phase Name - Intensity):</u></strong></p>
<p class="tiptap-paragraph"></p>

**DAY HEADERS:**
<p class="tiptap-paragraph"><strong><u>Day 1 - Focus Area:</u></strong></p>

**EXERCISES (CRITICAL - USE THIS EXACT FORMAT):**
Exercises are NUMBERED inside a SINGLE <p> tag, separated by <br> tags. NOT bullet lists. NOT <ul>/<li>.

<p class="tiptap-paragraph"><br>1. {{exercise:ID:Name}}– sets × reps @ intensity<br>2. {{exercise:ID:Name}}– sets × reps<br>3. {{exercise:ID:Name}}– sets × reps</p>

**SEPARATORS:**
One empty paragraph between days:
<p class="tiptap-paragraph"></p>

**1RM REFERENCES (for strength/hypertrophy programs):**
When exercises use percentage-based loading, add a calculator link:
{{exercise:ID:Name}}– 4 sets × 10 reps @ 70% 1RM (<a href="/1rmcalculator">calculate</a>)

=== COMPLETE EXAMPLE (FOLLOW THIS EXACTLY) ===

<p class="tiptap-paragraph"><strong><u>Week 1-2 (Volume Phase - 70% 1RM):</u></strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><strong><u>Day 1 - Push:</u></strong></p>
<p class="tiptap-paragraph"><br>1. {{exercise:0025:barbell bench press}}– 4 sets × 10 reps @ 70% 1RM (<a href="/1rmcalculator">calculate</a>)<br>2. {{exercise:0438:dumbbell w-press}}– 4 sets × 12 reps<br>3. {{exercise:0868:cable curl}}– 3 sets × 15 reps<br>4. {{exercise:0426:dumbbell standing overhead press}}– 4 sets × 10 reps<br>5. {{exercise:0584:lever lateral raise}}– 4 sets × 15 reps<br>6. {{exercise:1723:cable one arm tricep pushdown}}– 3 sets × 12 reps</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><strong><u>Day 2 - Pull:</u></strong></p>
<p class="tiptap-paragraph"><br>1. {{exercise:0095:barbell shrug}}– 4 sets × 10 reps @ 70% 1RM<br>2. {{exercise:0198:cable pulldown}}– 4 sets × 12 reps<br>3. {{exercise:0139:biceps narrow pull-ups}}– 3 sets × 15 reps</p>
<p class="tiptap-paragraph"></p>

=== ABSOLUTE RULES ===
- NEVER use <ul>, <li>, or bullet lists. ONLY use <p> with <br> for exercises.
- NEVER use <strong> around exercise numbers (no "<strong>1.</strong>"). Just plain "1."
- EVERY exercise MUST use {{exercise:ID:Name}} format from the library.
- Day headers use <strong><u>Day X - Focus:</u></strong> in a <p> tag.
- Week headers use <strong><u>Week X-Y (Phase):</u></strong> in a <p> tag.
- Include REST DAYS explicitly (e.g., "Day 5 - Rest & Recovery")
- Each exercise line starts with <br> followed by number and period.
- One empty <p class="tiptap-paragraph"></p> between each day section.
- Use the × symbol (multiplication sign) for sets/reps, NOT "x".
- Include Smarty Tools references: 1RM Calculator (<a href="/1rmcalculator">calculate</a>).
- EVERY day must have SPECIFIC exercises - NO placeholder text.
- Vary exercises across weeks for proper periodization.
- Match volume and intensity to the program's difficulty level.`;
}

// ─── User Prompt Builder ──────────────────────────────────────────────────────

function buildUserPrompt(
  program: ProgramRow,
  startWeek: number,
  endWeek: number,
  totalWeeks: number,
  daysPerWeek: number,
  difficulty: number,
  equipment: string
): string {
  const phase = startWeek <= 2 ? "Foundation/Adaptation" :
    startWeek <= Math.ceil(totalWeeks * 0.6) ? "Building/Progressive Overload" :
    startWeek <= Math.ceil(totalWeeks * 0.85) ? "Peak/Intensification" : "Peak/Taper";

  return `Generate COMPLETE content for Week ${startWeek} through Week ${endWeek} of this training program.

PROGRAM: "${program.name}"
CATEGORY: ${program.category}
TOTAL DURATION: ${totalWeeks} weeks
DAYS PER WEEK: ${daysPerWeek} training days (include rest days to fill 7 days)
DIFFICULTY: ${difficulty}/6 stars
EQUIPMENT: ${equipment}
TARGET AUDIENCE: ${program.target_audience || "General fitness enthusiasts"}
DESCRIPTION: ${program.description || program.name}

CURRENT PHASE (Weeks ${startWeek}-${endWeek} of ${totalWeeks}): ${phase}

REQUIREMENTS:
1. Write EVERY SINGLE DAY for weeks ${startWeek} through ${endWeek}
2. Each training day MUST have 4-8 exercises with sets, reps, and rest periods
3. Use {{exercise:ID:Name}} format for ALL exercises - pick from the library
4. Include rest days based on ${daysPerWeek} training days per week
5. Progressive overload from week to week (increase reps, sets, or reduce rest)
6. Difficulty ${difficulty}/6: ${difficulty <= 2 ? "Beginner-friendly, basic movements, longer rest" : difficulty <= 4 ? "Intermediate, moderate complexity, balanced rest" : "Advanced, complex movements, shorter rest, higher volume"}
7. NO placeholder text - EVERY exercise must be specifically named from the library
8. Vary exercises between days and across weeks for proper stimulus

FORMAT REMINDER - USE THIS EXACT STRUCTURE:
<p class="tiptap-paragraph"><strong><u>Week ${startWeek}${startWeek !== endWeek ? `-${endWeek}` : ''} (${phase}):</u></strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><strong><u>Day 1 - Focus:</u></strong></p>
<p class="tiptap-paragraph"><br>1. {{exercise:ID:Name}}– sets × reps<br>2. {{exercise:ID:Name}}– sets × reps</p>
<p class="tiptap-paragraph"></p>

DO NOT use <ul>, <li>, or bullet lists. Use <p> with <br> for exercises.
Generate the FULL content now:`;
}

// ─── Overview Generator ───────────────────────────────────────────────────────

async function generateOverview(apiKey: string, program: ProgramRow, philosophy: string): Promise<string | null> {
  const prompt = `Write a professional program overview (2-3 paragraphs) for this training program:
Name: "${program.name}"
Category: ${program.category}
Duration: ${program.weeks} weeks, ${program.days_per_week} days/week
Difficulty: ${program.difficulty_stars}/6 stars
Equipment: ${program.equipment}
Target: ${program.target_audience || "General fitness enthusiasts"}

${philosophy}

Format as HTML using <p class="tiptap-paragraph"> tags. Be professional, motivating, and specific about what the program delivers.
Do NOT include any exercise names or {{exercise:}} markup in the overview.`;

  return callAI(apiKey, "You are an expert fitness coach writing program descriptions.", prompt);
}

// ─── Progression Plan Generator ───────────────────────────────────────────────

async function generateProgressionPlan(
  apiKey: string,
  program: ProgramRow,
  philosophy: string,
): Promise<string | null> {
  const prompt = `Write a detailed progression plan for this training program:
Name: "${program.name}"
Category: ${program.category}
Duration: ${program.weeks} weeks, ${program.days_per_week} days/week
Difficulty: ${program.difficulty_stars}/6 stars

${philosophy}

Include:
1. Week-by-week progression guidelines (volume, intensity, complexity)
2. How to know when to increase difficulty
3. Deload guidance (when applicable)
4. Signs of overtraining to watch for
5. How to adapt if exercises are too easy/hard

Format as HTML using <p class="tiptap-paragraph"> tags. Use <strong> for sub-headers.
Do NOT include any {{exercise:}} markup - this is a prose guidelines section, not an exercise list.`;

  return callAI(apiKey, "You are an expert fitness coach writing training progression guidelines.", prompt);
}

// ─── Clean Corrupted Text ─────────────────────────────────────────────────────

function cleanCorruptedText(html: string): string {
  let cleaned = html;

  // Remove repeated parenthetical qualifiers like "(male)(male)(male)"
  cleaned = cleaned.replace(/(\([^)]+\))\s*(?:\1\s*){1,}/g, '$1');

  // Remove excessive repeated words/phrases
  cleaned = cleaned.replace(/(\b\w{3,}\b)\s+(?:\1\s+){2,}/gi, '$1 ');

  return cleaned;
}

// ─── Fix Malformed Exercise Tags ──────────────────────────────────────────────

function fixMalformedExerciseTags(html: string, exercises: ExerciseBasic[]): string {
  const idMap = new Map<string, ExerciseBasic>();
  for (const ex of exercises) {
    idMap.set(ex.id, ex);
    idMap.set(ex.id.toLowerCase(), ex);
  }
  const nameMap = new Map<string, ExerciseBasic>();
  for (const ex of exercises) {
    nameMap.set(ex.name.toLowerCase().trim(), ex);
  }

  let fixed = html;
  let fixCount = 0;

  // Pattern 1: {{exercise:ID:Name}} - validate and fix ID/Name
  fixed = fixed.replace(/\{\{exercise:([^:}]+):([^}]+)\}\}/g, (_m, id, name) => {
    const trimId = id.trim();
    const trimName = name.trim();
    // Valid ID exists in library
    if (idMap.has(trimId)) {
      const ex = idMap.get(trimId)!;
      return `{{exercise:${ex.id}:${ex.name}}}`;
    }
    // Try by name
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    // Fuzzy match by name
    const match = findBestMatch(trimName, exercises, 0.70);
    if (match) { fixCount++; return `{{exercise:${match.exercise.id}:${match.exercise.name}}}`; }
    fixCount++;
    return trimName;
  });

  // Pattern 2: {{ID:Name}} without "exercise:" prefix (e.g., {{0025:barbell bench press}})
  fixed = fixed.replace(/\{\{(\d{4}):([^}]+)\}\}/g, (_m, id, name) => {
    const trimId = id.trim();
    const trimName = name.trim();
    if (idMap.has(trimId)) {
      const ex = idMap.get(trimId)!;
      fixCount++;
      return `{{exercise:${ex.id}:${ex.name}}}`;
    }
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    return trimName;
  });

  // Pattern 3: {{slug-name:numericID:Display Name}} (e.g., {{walking-on-incline-treadmill:3666:walking on incline treadmill}})
  fixed = fixed.replace(/\{\{([a-z][a-z0-9-]+):(\d{1,5}):([^}]+)\}\}/gi, (_m, _slug, numId, name) => {
    const trimName = name.trim();
    // Try the numeric ID (pad to 4 digits)
    const paddedId = numId.padStart(4, '0');
    if (idMap.has(paddedId)) {
      const ex = idMap.get(paddedId)!;
      fixCount++;
      return `{{exercise:${ex.id}:${ex.name}}}`;
    }
    if (idMap.has(numId)) {
      const ex = idMap.get(numId)!;
      fixCount++;
      return `{{exercise:${ex.id}:${ex.name}}}`;
    }
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    const match = findBestMatch(trimName, exercises, 0.65);
    if (match) { fixCount++; return `{{exercise:${match.exercise.id}:${match.exercise.name}}}`; }
    fixCount++;
    return trimName;
  });

  // Pattern 4: {{slug:slug:Name}} (e.g., {{butt-kicks-cardio:butt-kicks-cardio:Butt Kicks}})
  fixed = fixed.replace(/\{\{([a-z][a-z0-9-]+):([a-z][a-z0-9-]+):([^}]+)\}\}/gi, (_m, slug1, slug2, name) => {
    // Already handled by pattern 1 if it starts with "exercise:"
    if (slug1 === 'exercise') return _m;
    const trimName = name.trim();
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    // Try slug as name (convert hyphens to spaces)
    const slugAsName = slug1.replace(/-/g, ' ');
    const bySlug = nameMap.get(slugAsName.toLowerCase());
    if (bySlug) { fixCount++; return `{{exercise:${bySlug.id}:${bySlug.name}}}`; }
    const match = findBestMatch(trimName, exercises, 0.65);
    if (match) { fixCount++; return `{{exercise:${match.exercise.id}:${match.exercise.name}}}`; }
    // Try matching on slug
    const slugMatch = findBestMatch(slugAsName, exercises, 0.65);
    if (slugMatch) { fixCount++; return `{{exercise:${slugMatch.exercise.id}:${slugMatch.exercise.name}}}`; }
    fixCount++;
    return trimName;
  });

  // Pattern 5: {{slug:Name}} without ID (e.g., {{cat-cow-stretch:Cat-Cow Stretch}})
  fixed = fixed.replace(/\{\{([a-z][a-z0-9-]+):([A-Z][^}]+)\}\}/g, (_m, slug, name) => {
    if (slug === 'exercise') return _m;
    const trimName = name.trim();
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    const match = findBestMatch(trimName, exercises, 0.65);
    if (match) { fixCount++; return `{{exercise:${match.exercise.id}:${match.exercise.name}}}`; }
    fixCount++;
    return trimName;
  });

  // Pattern 6: Remaining {{anything:anything}} that isn't exercise format
  fixed = fixed.replace(/\{\{(?!exercise:)([^:}]+):([^}]+)\}\}/g, (_m, part1, part2) => {
    // Try part2 as name
    const trimName = part2.trim();
    const byName = nameMap.get(trimName.toLowerCase());
    if (byName) { fixCount++; return `{{exercise:${byName.id}:${byName.name}}}`; }
    // Try part1 as slug-name
    const slugName = part1.replace(/-/g, ' ').trim();
    const bySlug = nameMap.get(slugName.toLowerCase());
    if (bySlug) { fixCount++; return `{{exercise:${bySlug.id}:${bySlug.name}}}`; }
    const match = findBestMatch(trimName, exercises, 0.65);
    if (match) { fixCount++; return `{{exercise:${match.exercise.id}:${match.exercise.name}}}`; }
    return trimName;
  });

  if (fixCount > 0) {
    console.log(`${LOG}   🔧 Fixed ${fixCount} malformed exercise tags`);
  }
  return fixed;
}
