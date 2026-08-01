import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Category-specific Soft Tissue Preparation exercises
const SOFT_TISSUE_PREP_BY_CATEGORY: Record<string, string[][]> = {
  "STRENGTH": [
    [
      "Foam roll upper back and lats (60 seconds)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Lacrosse ball pec release (30 seconds per side)",
      "Foam roll calves (30 seconds per leg)"
    ],
    [
      "Foam roll thoracic spine (60 seconds)",
      "Foam roll IT band (45 seconds per leg)",
      "Lacrosse ball glute release (45 seconds per side)",
      "Foam roll lats (30 seconds per side)",
      "Lacrosse ball foot massage (30 seconds per foot)"
    ],
    [
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll adductors (45 seconds per leg)",
      "Foam roll upper back (60 seconds)",
      "Lacrosse ball trap release (30 seconds per side)",
      "Foam roll glutes (45 seconds per side)"
    ]
  ],
  "CARDIO": [
    [
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll calves (45 seconds per leg)",
      "Foam roll IT band (30 seconds per leg)",
      "Lacrosse ball foot massage (30 seconds per foot)"
    ],
    [
      "Foam roll hip flexors (45 seconds per side)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll calves (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll lower back (60 seconds)"
    ],
    [
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll adductors (45 seconds per leg)",
      "Foam roll calves (30 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Lacrosse ball plantar fascia release (30 seconds per foot)"
    ]
  ],
  "METABOLIC": [
    [
      "Foam roll full back (60 seconds)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll calves (30 seconds per leg)"
    ],
    [
      "Foam roll thoracic spine (60 seconds)",
      "Foam roll lats (30 seconds per side)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll IT band (30 seconds per leg)",
      "Lacrosse ball foot massage (30 seconds per foot)"
    ],
    [
      "Foam roll upper back (60 seconds)",
      "Foam roll hip flexors (45 seconds per side)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll calves (30 seconds per leg)"
    ]
  ],
  "CALORIE BURNING": [
    [
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll upper back (60 seconds)",
      "Lacrosse ball foot massage (30 seconds per foot)"
    ],
    [
      "Foam roll full back (60 seconds)",
      "Foam roll IT band (30 seconds per leg)",
      "Foam roll calves (45 seconds per leg)",
      "Foam roll hip flexors (45 seconds per side)",
      "Foam roll lats (30 seconds per side)"
    ],
    [
      "Foam roll thoracic spine (60 seconds)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll calves (30 seconds per leg)"
    ]
  ],
  "MOBILITY & STABILITY": [
    [
      "Gentle foam roll thoracic spine (60 seconds)",
      "Lacrosse ball upper trap release (45 seconds per side)",
      "Foam roll hip flexors (45 seconds per side)",
      "Lacrosse ball glute trigger points (45 seconds per side)",
      "Foam roll calves with pauses (30 seconds per leg)"
    ],
    [
      "Foam roll upper back with arm reach (60 seconds)",
      "Lacrosse ball pec minor release (45 seconds per side)",
      "Foam roll quadriceps slowly (45 seconds per leg)",
      "Lacrosse ball piriformis release (45 seconds per side)",
      "Foam roll plantar fascia with ball (30 seconds per foot)"
    ],
    [
      "Gentle foam roll full spine (60 seconds)",
      "Lacrosse ball rhomboid release (45 seconds per side)",
      "Foam roll IT band with pauses (45 seconds per leg)",
      "Lacrosse ball hip flexor release (45 seconds per side)",
      "Foam roll ankle mobility prep (30 seconds per leg)"
    ]
  ],
  "CHALLENGE": [
    [
      "Foam roll thoracic spine (60 seconds)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll calves and lats (60 seconds total)"
    ],
    [
      "Foam roll full back (60 seconds)",
      "Foam roll hip flexors (45 seconds per side)",
      "Foam roll IT band (30 seconds per leg)",
      "Foam roll adductors (45 seconds per leg)",
      "Lacrosse ball foot and trap release (60 seconds total)"
    ],
    [
      "Foam roll upper back and lats (60 seconds)",
      "Foam roll quadriceps (45 seconds per leg)",
      "Foam roll glutes (45 seconds per side)",
      "Foam roll hamstrings (45 seconds per leg)",
      "Foam roll calves (30 seconds per leg)"
    ]
  ]
};

// Get a varied Soft Tissue Prep based on category and workout index
function getSoftTissuePrepExercises(category: string, index: number): string[] {
  const categoryExercises = SOFT_TISSUE_PREP_BY_CATEGORY[category] || SOFT_TISSUE_PREP_BY_CATEGORY["METABOLIC"];
  const variationIndex = index % categoryExercises.length;
  return categoryExercises[variationIndex];
}

// Generate the Soft Tissue Preparation HTML section - NO NEWLINES (Gold Standard format)
function generateSoftTissuePrepHTML(exercises: string[]): string {
  const listItems = exercises
    .map(exercise => `<li class="tiptap-list-item"><p class="tiptap-paragraph">${exercise}</p></li>`)
    .join("");
  
  // Single line - no newlines between elements to match Gold Standard formatting
  return `<p class="tiptap-paragraph">🧽 <strong><u>Soft Tissue Preparation 5'</u></strong></p><ul class="tiptap-bullet-list">${listItems}</ul><p class="tiptap-paragraph"></p>`;
}

// Rename "Warm Up" to "Activation" in the content
function renameWarmUpToActivation(content: string): string {
  // Handle various formats of "Warm Up" in the title
  return content
    .replace(/🔥\s*<strong><u>Warm[-\s]?Up/gi, '🔥 <strong><u>Activation')
    .replace(/🔥<strong><u>Warm[-\s]?Up/gi, '🔥 <strong><u>Activation');
}

interface UpdateResult {
  id: string;
  name: string;
  category: string;
  status: 'updated' | 'skipped' | 'error';
  reason?: string;
}

// Fix existing workouts that have bad formatting (newlines in Soft Tissue section)
function cleanupSoftTissueFormatting(content: string): string {
  // Fix pattern: </p>\n<ul or </p> \n <ul etc - remove newlines between closing p and opening ul
  // Also fix newlines before </ul> and within the list items area
  
  // Pattern to find the Soft Tissue section with bad formatting
  const softTissuePattern = /<p class="tiptap-paragraph">🧽[^<]*<\/p>\s*\n\s*<ul/g;
  let fixed = content.replace(softTissuePattern, (match) => {
    return match.replace(/\s*\n\s*/g, '');
  });
  
  // Also fix any newlines before list items within the Soft Tissue ul
  // Match from 🧽 title through its closing </ul>
  const fullSectionPattern = /(<p class="tiptap-paragraph">🧽[^<]*<\/p>)(\s*\n\s*)(<ul class="tiptap-bullet-list">)(\s*\n\s*)?(<li[\s\S]*?<\/ul>)/g;
  fixed = fixed.replace(fullSectionPattern, '$1$3$5');
  
  return fixed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let dryRun = false;
    let limitCount: number | null = null;
    let mode = "add"; // "add" = add new sections, "cleanup" = fix existing formatting
    
    try {
      const body = await req.json();
      dryRun = body.dryRun === true;
      limitCount = body.limit ? parseInt(body.limit) : null;
      mode = body.mode || "add";
    } catch {
      // No body or invalid JSON, use defaults
    }
    
    // CLEANUP MODE: Fix existing workouts with bad Soft Tissue formatting
    if (mode === "cleanup") {
      console.log(`[CLEANUP] Starting formatting cleanup. DryRun: ${dryRun}`);
      
      // Find all workouts that have the 🧽 emoji (already have Soft Tissue section)
      const { data: workouts, error: fetchError } = await supabase
        .from("admin_workouts")
        .select("id, name, category, main_workout")
        .like("main_workout", "%🧽%")
        .not("main_workout", "is", null);
      
      if (fetchError) {
        throw new Error(`Failed to fetch workouts: ${fetchError.message}`);
      }
      
      console.log(`[CLEANUP] Found ${workouts?.length || 0} workouts with 🧽 to check`);
      
      const results: UpdateResult[] = [];
      
      for (const workout of workouts || []) {
        const { id, name, category, main_workout } = workout;
        
        // Check if it has bad formatting (newlines after the 🧽 title)
        if (!main_workout.includes("🧽") || !main_workout.match(/<\/p>\s*\n\s*<ul/)) {
          results.push({
            id,
            name,
            category: category || "unknown",
            status: 'skipped',
            reason: 'Already has correct formatting'
          });
          continue;
        }
        
        try {
          const cleanedContent = cleanupSoftTissueFormatting(main_workout);
          
          if (dryRun) {
            console.log(`[CLEANUP-DRY] Would fix: ${name}`);
            results.push({
              id,
              name,
              category: category || "unknown",
              status: 'updated',
              reason: 'Dry run - formatting would be fixed'
            });
          } else {
            const { error: updateError } = await supabase
              .from("admin_workouts")
              .update({ 
                main_workout: cleanedContent,
                updated_at: new Date().toISOString()
              })
              .eq("id", id);
            
            if (updateError) {
              throw new Error(`Update failed: ${updateError.message}`);
            }
            
            results.push({
              id,
              name,
              category: category || "unknown",
              status: 'updated'
            });
            console.log(`[CLEANUP] Fixed formatting: ${name}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({
            id,
            name,
            category: category || "unknown",
            status: 'error',
            reason: errorMessage
          });
        }
      }
      
      const summary = {
        mode: "cleanup",
        totalProcessed: results.length,
        updated: results.filter(r => r.status === 'updated').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        dryRun,
        results
      };
      
      console.log(`[CLEANUP] Complete. Fixed: ${summary.updated}, Skipped: ${summary.skipped}, Errors: ${summary.errors}`);
      
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[UPDATE-STRUCTURE] Starting workout structure update. DryRun: ${dryRun}, Limit: ${limitCount || 'none'}`);

    // Target categories
    const targetCategories = [
      "STRENGTH",
      "CARDIO", 
      "METABOLIC",
      "CALORIE BURNING",
      "MOBILITY & STABILITY",
      "CHALLENGE"
    ];

    // Fetch all workouts in target categories
    let query = supabase
      .from("admin_workouts")
      .select("id, name, category, main_workout")
      .in("category", targetCategories)
      .not("main_workout", "is", null);

    if (limitCount) {
      query = query.limit(limitCount);
    }

    const { data: workouts, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch workouts: ${fetchError.message}`);
    }

    console.log(`[UPDATE-STRUCTURE] Found ${workouts?.length || 0} workouts to process`);

    const results: UpdateResult[] = [];
    const categoryCounters: Record<string, number> = {};

    for (const workout of workouts || []) {
      const { id, name, category, main_workout } = workout;

      // Initialize category counter for variation
      if (!categoryCounters[category]) {
        categoryCounters[category] = 0;
      }

      // Skip if already has Soft Tissue Preparation
      if (main_workout?.includes("🧽")) {
        results.push({
          id,
          name,
          category,
          status: 'skipped',
          reason: 'Already has 🧽 Soft Tissue Preparation'
        });
        continue;
      }

      // Skip if no warm-up section found (unusual format)
      if (!main_workout?.includes("🔥")) {
        results.push({
          id,
          name,
          category,
          status: 'skipped',
          reason: 'No 🔥 Warm Up section found'
        });
        continue;
      }

      try {
        // Get category-specific exercises with variation
        const exercises = getSoftTissuePrepExercises(category, categoryCounters[category]);
        categoryCounters[category]++;

        // Generate Soft Tissue Prep HTML
        const softTissuePrepHTML = generateSoftTissuePrepHTML(exercises);

        // Rename Warm Up to Activation
        let updatedContent = renameWarmUpToActivation(main_workout);

        // Prepend Soft Tissue Preparation section
        updatedContent = softTissuePrepHTML + updatedContent;

        if (dryRun) {
          console.log(`[DRY-RUN] Would update: ${name} (${category})`);
          console.log(`[DRY-RUN] First 500 chars of new content:`, updatedContent.substring(0, 500));
          results.push({
            id,
            name,
            category,
            status: 'updated',
            reason: 'Dry run - no changes made'
          });
        } else {
          // Update the database
          const { error: updateError } = await supabase
            .from("admin_workouts")
            .update({ 
              main_workout: updatedContent,
              updated_at: new Date().toISOString()
            })
            .eq("id", id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          results.push({
            id,
            name,
            category,
            status: 'updated'
          });

          console.log(`[UPDATE-STRUCTURE] Updated: ${name} (${category})`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          id,
          name,
          category,
          status: 'error',
          reason: errorMessage
        });
        console.error(`[UPDATE-STRUCTURE] Error updating ${name}:`, errorMessage);
      }
    }

    // Summary
    const summary = {
      totalProcessed: results.length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      dryRun,
      byCategory: targetCategories.reduce((acc, cat) => {
        acc[cat] = {
          updated: results.filter(r => r.category === cat && r.status === 'updated').length,
          skipped: results.filter(r => r.category === cat && r.status === 'skipped').length,
          errors: results.filter(r => r.category === cat && r.status === 'error').length
        };
        return acc;
      }, {} as Record<string, { updated: number; skipped: number; errors: number }>),
      results
    };

    console.log(`[UPDATE-STRUCTURE] Complete. Updated: ${summary.updated}, Skipped: ${summary.skipped}, Errors: ${summary.errors}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[UPDATE-STRUCTURE] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
