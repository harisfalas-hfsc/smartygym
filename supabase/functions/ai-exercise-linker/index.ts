import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripExerciseMarkup, type ExerciseBasic } from "../_shared/exercise-matching.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

/**
 * Deep clean content: strip markup, remove $2 artifacts, clean leftover fragments
 */
function deepCleanContent(content: string): string {
  // 1. Strip exercise markup to plain names
  let cleaned = stripExerciseMarkup(content);
  // 2. Remove $1/$2 regex artifacts
  cleaned = cleaned.replace(/\$\d+/g, '');
  // 3. Clean leftover fragments like "-Ups" after exercise names
  cleaned = cleaned.replace(/([a-z])\s*-([A-Z][a-z]+)/g, '$1');
  // 4. Collapse multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ');
  // 5. Clean empty dash fragments
  cleaned = cleaned.replace(/\s*–\s*–\s*/g, ' – ');
  return cleaned;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG_PREFIX = "[AI-EXERCISE-LINKER]";

// Section emoji patterns for workouts
const SECTION_PATTERNS = [
  { emoji: '🧽', name: 'soft_tissue', process: false },
  { emoji: '🔥', name: 'warm_up', process: false },
  { emoji: '💪', name: 'main_workout', process: true },
  { emoji: '⚡', name: 'finisher', process: true },
  { emoji: '🧘', name: 'cool_down', process: false },
];

interface AIExerciseMapping {
  original_text: string;
  exercise_id: string;
  exercise_name: string;
  was_replaced: boolean;
  replacement_reason?: string;
}

function splitWorkoutSections(html: string): Array<{ name: string; content: string; process: boolean }> {
  const sections: Array<{ name: string; content: string; process: boolean }> = [];
  const positions: Array<{ index: number; name: string; process: boolean }> = [];

  for (const sp of SECTION_PATTERNS) {
    let from = 0;
    while (true) {
      const idx = html.indexOf(sp.emoji, from);
      if (idx === -1) break;
      positions.push({ index: idx, name: sp.name, process: sp.process });
      from = idx + 1;
    }
  }

  if (positions.length === 0) {
    return [{ name: 'full_content', content: html, process: true }];
  }

  positions.sort((a, b) => a.index - b.index);

  if (positions[0].index > 0) {
    sections.push({ name: 'pre_header', content: html.substring(0, positions[0].index), process: false });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : html.length;
    sections.push({ name: positions[i].name, content: html.substring(start, end), process: positions[i].process });
  }

  return sections;
}

function buildExerciseLibraryPromptBlock(exercises: ExerciseBasic[]): string {
  // Build compact CSV format: id|name|body_part|equipment|target
  const lines = exercises.map(e => `${e.id}|${e.name}|${e.body_part}|${e.equipment}|${e.target}`);
  return lines.join('\n');
}

async function callAI(
  content: string,
  exerciseLibraryBlock: string,
  contentType: 'workout_section' | 'program_field',
  apiKey: string
): Promise<AIExerciseMapping[]> {
  const systemPrompt = `You are an exercise identification and matching expert. You will receive HTML content from a fitness ${contentType === 'workout_section' ? 'workout' : 'training program'} and a complete exercise library.

Your job:
1. Identify EVERY exercise name in the HTML content. Exercises appear in bold tags, list items, br-separated lines, comma-separated lists, or inline text. They may have reps/sets/duration info attached.
2. For each exercise, find the EXACT match or closest match from the provided exercise library.
3. If an exercise doesn't exactly match any library entry, find the closest biomechanical equivalent following this hierarchy:
   a. Same body_part (e.g., chest→chest, back→back)
   b. Same equipment type (bodyweight→bodyweight, dumbbell→dumbbell, barbell→barbell)
   c. Similar target muscle and movement pattern
4. Return the EXACT text span as it appears in the HTML (so we can do precise string replacement).

CRITICAL RULES:
- ONLY use exercises from the provided library. NEVER invent exercises.
- Return the original_text EXACTLY as it appears in the HTML (preserving case, hyphens, spaces).
- Do NOT include reps, sets, duration, or other metadata in original_text — just the exercise name portion.
- If an exercise already matches the library exactly, set was_replaced to false.
- If you had to substitute, set was_replaced to true and explain in replacement_reason.
- Skip structural headers (Warm Up, Cool Down, Circuit, Block, etc.) — only identify actual exercises.
- Skip instructional text (Perform, Complete, Rest, etc.)

Return a JSON array (no markdown, no code fences, just raw JSON):
[{"original_text": "Push-Ups", "exercise_id": "0662", "exercise_name": "push-up", "was_replaced": false}, ...]`;

  const userPrompt = `EXERCISE LIBRARY (id|name|body_part|equipment|target):
${exerciseLibraryBlock}

HTML CONTENT TO PROCESS:
${content}

Identify every exercise in the HTML and match each to the library. Return JSON array only.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${LOG_PREFIX} AI gateway error ${response.status}: ${errorText}`);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response (strip markdown fences if present)
  let jsonStr = rawContent.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.error(`${LOG_PREFIX} AI returned non-array:`, jsonStr.substring(0, 200));
      return [];
    }
    return parsed as AIExerciseMapping[];
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to parse AI response:`, jsonStr.substring(0, 500));
    return [];
  }
}

function applyMappingsToContent(content: string, mappings: AIExerciseMapping[]): string {
  let result = content;
  
  // Sort by original_text length descending to avoid partial replacements
  const sorted = [...mappings].sort((a, b) => b.original_text.length - a.original_text.length);
  
  for (const mapping of sorted) {
    if (!mapping.original_text || !mapping.exercise_id || !mapping.exercise_name) continue;
    
    const markup = `{{exercise:${mapping.exercise_id}:${mapping.exercise_name}}}`;
    const originalText = mapping.original_text;
    
    // Skip if this exercise is already marked up
    if (result.includes(`{{exercise:${mapping.exercise_id}:`)) continue;
    
    // Simple, direct string replacement — no complex regex
    // Find the original text and replace it entirely with the markup
    // This avoids $1/$2 artifacts from regex capture groups
    
    let replaced = false;
    
    // Case-insensitive search for the original text
    const lowerResult = result.toLowerCase();
    const lowerOriginal = originalText.toLowerCase();
    let searchFrom = 0;
    
    while (true) {
      const idx = lowerResult.indexOf(lowerOriginal, searchFrom);
      if (idx === -1) break;
      
      // Check we're not inside an existing markup
      const before = result.substring(Math.max(0, idx - 20), idx);
      if (before.includes('{{exercise:')) {
        searchFrom = idx + 1;
        continue;
      }
      
      // Replace the exact span
      result = result.substring(0, idx) + markup + result.substring(idx + originalText.length);
      replaced = true;
      break; // Only replace first occurrence
    }
    
    if (!replaced) {
      console.log(`${LOG_PREFIX} ⚠ Could not find "${originalText}" in content for replacement`);
    }
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const { type, ids, dryRun = false } = await req.json();
    
    if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "Required: type ('workout'|'program'), ids (string[])" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch exercise library
    console.log(`${LOG_PREFIX} Fetching exercise library...`);
    const { data: exercises, error: exError } = await supabase
      .from('exercises')
      .select('id, name, body_part, equipment, target')
      .limit(2000);
    
    if (exError || !exercises) {
      throw new Error(`Failed to fetch exercises: ${exError?.message}`);
    }
    console.log(`${LOG_PREFIX} Loaded ${exercises.length} exercises`);

    const libraryBlock = buildExerciseLibraryPromptBlock(exercises);
    
    const results: Array<{
      id: string;
      name: string;
      type: string;
      exercisesFound: number;
      exercisesReplaced: number;
      exercisesMatched: number;
      errors: string[];
    }> = [];

    if (type === 'workout') {
      // Process workouts
      for (const workoutId of ids) {
        console.log(`${LOG_PREFIX} ── Processing workout: ${workoutId} ──`);
        
        const { data: workout, error: wError } = await supabase
          .from('admin_workouts')
          .select('id, name, main_workout, finisher')
          .eq('id', workoutId)
          .single();
        
        if (wError || !workout) {
          console.error(`${LOG_PREFIX} Failed to fetch workout ${workoutId}:`, wError?.message);
          results.push({ id: workoutId, name: 'UNKNOWN', type: 'workout', exercisesFound: 0, exercisesReplaced: 0, exercisesMatched: 0, errors: [wError?.message || 'Not found'] });
          continue;
        }

        const itemResult = { id: workoutId, name: workout.name, type: 'workout', exercisesFound: 0, exercisesReplaced: 0, exercisesMatched: 0, errors: [] as string[] };
        const updates: Record<string, string> = {};

        // Process main_workout with section awareness
        if (workout.main_workout) {
          const stripped = deepCleanContent(workout.main_workout);
          const sections = splitWorkoutSections(stripped);
          let rebuiltContent = '';
          
          for (const section of sections) {
            if (section.process && section.content.trim().length > 20) {
              try {
                console.log(`${LOG_PREFIX} AI processing section: ${section.name} (${section.content.length} chars)`);
                const mappings = await callAI(section.content, libraryBlock, 'workout_section', LOVABLE_API_KEY);
                console.log(`${LOG_PREFIX} AI returned ${mappings.length} mappings for ${section.name}`);
                
                itemResult.exercisesFound += mappings.length;
                itemResult.exercisesMatched += mappings.filter(m => !m.was_replaced).length;
                itemResult.exercisesReplaced += mappings.filter(m => m.was_replaced).length;
                
                const processed = applyMappingsToContent(section.content, mappings);
                rebuiltContent += processed;
              } catch (e) {
                console.error(`${LOG_PREFIX} AI error for section ${section.name}:`, e);
                itemResult.errors.push(`AI error in ${section.name}: ${e instanceof Error ? e.message : String(e)}`);
                rebuiltContent += deepCleanContent(section.content);
              }
            } else {
              // Non-processable section: strip any old markup
              rebuiltContent += deepCleanContent(section.content);
            }
          }
          
          updates.main_workout = rebuiltContent;
        }

        // Process finisher separately
        if (workout.finisher) {
          const strippedFinisher = deepCleanContent(workout.finisher);
          try {
            console.log(`${LOG_PREFIX} AI processing finisher (${strippedFinisher.length} chars)`);
            const mappings = await callAI(strippedFinisher, libraryBlock, 'workout_section', LOVABLE_API_KEY);
            console.log(`${LOG_PREFIX} AI returned ${mappings.length} mappings for finisher`);
            
            itemResult.exercisesFound += mappings.length;
            itemResult.exercisesMatched += mappings.filter(m => !m.was_replaced).length;
            itemResult.exercisesReplaced += mappings.filter(m => m.was_replaced).length;
            
            updates.finisher = applyMappingsToContent(strippedFinisher, mappings);
          } catch (e) {
            console.error(`${LOG_PREFIX} AI error for finisher:`, e);
            itemResult.errors.push(`AI error in finisher: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // Save updates
        if (!dryRun && Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('admin_workouts')
            .update(updates)
            .eq('id', workoutId);
          
          if (updateError) {
            console.error(`${LOG_PREFIX} Failed to save workout ${workoutId}:`, updateError.message);
            itemResult.errors.push(`Save error: ${updateError.message}`);
          } else {
            console.log(`${LOG_PREFIX} ✅ Saved workout ${workoutId}: ${itemResult.exercisesFound} exercises found, ${itemResult.exercisesReplaced} replaced`);
          }
        }

        results.push(itemResult);
        
        // Small delay between items to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
      }
    } else if (type === 'program') {
      // Process training programs
      const programFields = ['program_structure', 'weekly_schedule', 'progression_plan'] as const;
      
      for (const programId of ids) {
        console.log(`${LOG_PREFIX} ── Processing program: ${programId} ──`);
        
        const { data: program, error: pError } = await supabase
          .from('admin_training_programs')
          .select('id, name, program_structure, weekly_schedule, progression_plan')
          .eq('id', programId)
          .single();
        
        if (pError || !program) {
          console.error(`${LOG_PREFIX} Failed to fetch program ${programId}:`, pError?.message);
          results.push({ id: programId, name: 'UNKNOWN', type: 'program', exercisesFound: 0, exercisesReplaced: 0, exercisesMatched: 0, errors: [pError?.message || 'Not found'] });
          continue;
        }

        const itemResult = { id: programId, name: program.name, type: 'program', exercisesFound: 0, exercisesReplaced: 0, exercisesMatched: 0, errors: [] as string[] };
        const updates: Record<string, string> = {};

        for (const field of programFields) {
          const content = program[field] as string | null;
          if (!content || content.trim().length < 20) continue;
          
          const stripped = deepCleanContent(content);
          
          try {
            console.log(`${LOG_PREFIX} AI processing ${field} (${stripped.length} chars)`);
            const mappings = await callAI(stripped, libraryBlock, 'program_field', LOVABLE_API_KEY);
            console.log(`${LOG_PREFIX} AI returned ${mappings.length} mappings for ${field}`);
            
            itemResult.exercisesFound += mappings.length;
            itemResult.exercisesMatched += mappings.filter(m => !m.was_replaced).length;
            itemResult.exercisesReplaced += mappings.filter(m => m.was_replaced).length;
            
            updates[field] = applyMappingsToContent(stripped, mappings);
          } catch (e) {
            console.error(`${LOG_PREFIX} AI error for ${field}:`, e);
            itemResult.errors.push(`AI error in ${field}: ${e instanceof Error ? e.message : String(e)}`);
          }
          
          // Delay between fields
          await new Promise(r => setTimeout(r, 500));
        }

        // Save updates
        if (!dryRun && Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('admin_training_programs')
            .update(updates)
            .eq('id', programId);
          
          if (updateError) {
            console.error(`${LOG_PREFIX} Failed to save program ${programId}:`, updateError.message);
            itemResult.errors.push(`Save error: ${updateError.message}`);
          } else {
            console.log(`${LOG_PREFIX} ✅ Saved program ${programId}: ${itemResult.exercisesFound} exercises found, ${itemResult.exercisesReplaced} replaced`);
          }
        }

        results.push(itemResult);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const totalFound = results.reduce((s, r) => s + r.exercisesFound, 0);
    const totalReplaced = results.reduce((s, r) => s + r.exercisesReplaced, 0);
    const totalMatched = results.reduce((s, r) => s + r.exercisesMatched, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

    const summary = {
      type,
      totalProcessed: results.length,
      totalExercisesFound: totalFound,
      totalExactMatches: totalMatched,
      totalReplacements: totalReplaced,
      totalErrors,
      dryRun,
      results,
    };

    console.log(`${LOG_PREFIX} ═══ COMPLETE ═══ ${results.length} items, ${totalFound} exercises found, ${totalMatched} matched, ${totalReplaced} replaced, ${totalErrors} errors`);

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Fatal error:`, e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
