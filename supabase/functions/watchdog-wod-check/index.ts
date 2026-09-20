import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getDayIn84Cycle, getPeriodizationForDay } from "../_shared/periodization-84day.ts";
import { validateWodPublishContract } from "../_shared/wod-integrity.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cyprusDateOffset(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Read-only WOD verifier.
 *
 * This function deliberately cannot select, generate, publish, unpublish,
 * repair images, create payment records, or send email. The scheduled library
 * picker is the only automatic process allowed to assign a WOD.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing backend configuration");
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const dates = [cyprusDateOffset(0), cyprusDateOffset(1), cyprusDateOffset(2)];
    const checks = [];

    for (const targetDate of dates) {
      const periodization = getPeriodizationForDay(getDayIn84Cycle(targetDate));
      const expectedSlots = periodization.category === "RECOVERY"
        ? ["VARIOUS"]
        : ["BODYWEIGHT", "EQUIPMENT"];

      const { data, error } = await supabase
        .from("admin_workouts")
        .select("id,name,equipment,category,difficulty_stars,is_visible,image_url,stripe_product_id,stripe_price_id,main_workout,description,instructions,tips,is_standalone_purchase,price,is_premium,is_workout_of_day,generated_for_date,wod_source")
        .eq("is_workout_of_day", true)
        .eq("generated_for_date", targetDate);
      if (error) throw error;

      const workouts = data || [];
      const slotCounts = new Map<string, number>();
      for (const workout of workouts) {
        const slot = String(workout.equipment || "").toUpperCase();
        slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1);
      }

      const issues: string[] = [];
      for (const slot of expectedSlots) {
        const count = slotCounts.get(slot) || 0;
        if (count === 0) issues.push(`Missing ${slot} library workout`);
        if (count > 1) issues.push(`Duplicate ${slot} workouts (${count})`);
      }

      for (const workout of workouts) {
        if (workout.wod_source !== "library") {
          issues.push(`${workout.name}: source is not library`);
        }
        if (String(workout.category || "").toUpperCase() !== periodization.category) {
          issues.push(`${workout.name}: wrong category`);
        }
        const contract = validateWodPublishContract(workout, targetDate);
        if (!contract.ok) issues.push(`${workout.name}: ${contract.failures.join("; ")}`);
      }

      checks.push({
        date: targetDate,
        expectedCategory: periodization.category,
        expectedSlots,
        workoutCount: workouts.length,
        issues,
        ok: issues.length === 0,
      });
    }

    return new Response(JSON.stringify({
      success: checks.every((check) => check.ok),
      mode: "read-only-library-verification",
      mutations: 0,
      checks,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      mode: "read-only-library-verification",
      mutations: 0,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});