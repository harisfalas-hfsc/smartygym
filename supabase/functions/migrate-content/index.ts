import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { workouts, programs } = await req.json()

    console.log(`Migrating ${workouts?.length || 0} workouts and ${programs?.length || 0} programs`)

    const results = {
      workouts: { success: 0, failed: 0, errors: [] as string[] },
      programs: { success: 0, failed: 0, errors: [] as string[] }
    }

    // Migrate workouts
    if (workouts && Array.isArray(workouts)) {
      for (const workout of workouts) {
        try {
          // Format the exercises and tips as text strings
          const warmUp = workout.exercises
            ?.filter((e: any) => e.name.toLowerCase().includes('warm'))
            .map((e: any) => `${e.name}: ${e.reps} ${e.notes}`)
            .join('\n') || ''

          const mainWorkout = workout.exercises
            ?.filter((e: any) => !e.name.toLowerCase().includes('warm') && !e.name.toLowerCase().includes('cool'))
            .map((e: any) => `${e.name}\nSets: ${e.sets} | Reps: ${e.reps} | Rest: ${e.rest}\nNotes: ${e.notes}`)
            .join('\n\n') || JSON.stringify(workout.exercises)

          const coolDown = workout.exercises
            ?.filter((e: any) => e.name.toLowerCase().includes('cool'))
            .map((e: any) => `${e.name}: ${e.reps} ${e.notes}`)
            .join('\n') || ''

          const tips = workout.tips?.join('\n• ') || ''

          const { error } = await supabaseClient
            .from('admin_workouts')
            .upsert({
              id: workout.id,
              name: workout.name,
              type: workout.workoutType || 'General',
              description: workout.description || '',
              duration: workout.duration || '',
              equipment: workout.equipment || '',
              difficulty: workout.difficulty || '',
              focus: workout.focus || 'General Fitness',
              warm_up: warmUp,
              main_workout: mainWorkout,
              cool_down: coolDown,
              notes: `Format: ${workout.format}\n\nInstructions: ${workout.instructions}\n\nTips:\n• ${tips}`,
              image_url: workout.imageUrl || '',
              is_premium: workout.isPremium || false,
              tier_required: workout.tierRequired || null
            }, {
              onConflict: 'id'
            })

          if (error) {
            console.error(`Error inserting workout ${workout.id}:`, error)
            results.workouts.failed++
            results.workouts.errors.push(`${workout.id}: ${error.message}`)
          } else {
            results.workouts.success++
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error(`Exception processing workout ${workout.id}:`, errorMsg)
          results.workouts.failed++
          results.workouts.errors.push(`${workout.id}: ${errorMsg}`)
        }
      }
    }

    // Migrate programs
    if (programs && Array.isArray(programs)) {
      for (const program of programs) {
        try {
          // Format exercises as structured text
          const weeklySchedule = program.exercises
            ?.map((e: any) => `Week ${e.week} - ${e.day}:\n${e.workout}\n${e.details}`)
            .join('\n\n') || ''

          const tips = program.tips?.join('\n• ') || ''

          const { error } = await supabaseClient
            .from('admin_training_programs')
            .upsert({
              id: program.id,
              name: program.name,
              category: program.focus || program.category || 'General Training',
              duration: program.duration || '',
              description: program.description || '',
              overview: `Format: ${program.format}\n\n${program.description}`,
              target_audience: `Difficulty: ${program.difficulty}\nEquipment: ${program.equipment}`,
              program_structure: program.format || '',
              weekly_schedule: weeklySchedule,
              progression_plan: program.instructions || '',
              nutrition_tips: program.nutritionTips || '',
              expected_results: program.expectedResults || '',
              image_url: program.imageUrl || '',
              is_premium: program.isPremium || false,
              tier_required: program.tierRequired || null
            }, {
              onConflict: 'id'
            })

          if (error) {
            console.error(`Error inserting program ${program.id}:`, error)
            results.programs.failed++
            results.programs.errors.push(`${program.id}: ${error.message}`)
          } else {
            results.programs.success++
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error(`Exception processing program ${program.id}:`, errorMsg)
          results.programs.failed++
          results.programs.errors.push(`${program.id}: ${errorMsg}`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Content migration completed',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Migration error:', errorMsg)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
