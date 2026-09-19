// Read-only compliance audit of the existing workout library.
//
// Zero AI calls. Every workout is judged by the SAME rule modules the
// generators use (doctrine, exercise-selection, timing estimators), so the
// result reflects today's rules, not the rules a workout was built under.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { loadAllExercises, type PoolExercise } from "../_shared/workout-engine/pool.server.ts";
import { auditWorkout, type WorkoutRow } from "../_shared/workout-engine/compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_BATCH = 150;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorized = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = (await req.json().catch(() => ({}))) as {
      offset?: number;
      limit?: number;
      reset?: boolean;
    };
    const offset = Math.max(0, Number(body.offset) || 0);
    const limit = Math.max(1, Math.min(MAX_BATCH, Number(body.limit) || 100));

    if (body.reset) {
      await supabase.from("workout_compliance_audit").delete().neq("workout_id", "");
    }

    const library: PoolExercise[] = await loadAllExercises(supabase);
    const libraryById = new Map(library.map((e) => [e.id, e]));

    const { count } = await supabase
      .from("admin_workouts")
      .select("id", { count: "exact", head: true });

    const { data, error } = await supabase
      .from("admin_workouts")
      .select(
        "id,name,category,format,difficulty_stars,equipment,duration,focus,main_workout,warm_up,activation,finisher,cool_down",
      )
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as WorkoutRow[];
    const results = rows.map((row) => auditWorkout(row, libraryById));

    if (results.length) {
      const { error: upsertError } = await supabase
        .from("workout_compliance_audit")
        .upsert(
          results.map((r) => ({
            workout_id: r.workout_id,
            name: r.name,
            category: r.category,
            format: r.format,
            status: r.status,
            repair_tier: r.repair_tier,
            errors: r.errors,
            warnings: r.warnings,
            work_minutes: r.work_minutes,
            session_minutes: r.session_minutes,
            target_minutes: r.target_minutes,
            audited_at: new Date().toISOString(),
          })),
          { onConflict: "workout_id" },
        );
      if (upsertError) throw new Error(upsertError.message);
    }

    const nextOffset = offset + rows.length;
    const total = count ?? nextOffset;
    const done = rows.length < limit || nextOffset >= total;

    const batch = {
      pass: results.filter((r) => r.status === "pass").length,
      warn: results.filter((r) => r.status === "warn").length,
      fail: results.filter((r) => r.status === "fail").length,
    };

    console.log(
      `[COMPLIANCE-AUDIT] ${offset}-${nextOffset}/${total} pass=${batch.pass} warn=${batch.warn} fail=${batch.fail}`,
    );

    return json({
      ok: true,
      total,
      processed: rows.length,
      next_offset: nextOffset,
      done,
      batch,
    });
  } catch (e) {
    console.error("[COMPLIANCE-AUDIT] failed", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
