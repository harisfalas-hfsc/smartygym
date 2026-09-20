import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { auditProgramCompliance } from "../_shared/program-compliance.ts";
import { loadAllExercises, type PoolExercise } from "../_shared/workout-engine/pool.server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

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
    const body = await req.json().catch(() => ({} as { persist?: boolean }));
    const { data, error } = await supabase
      .from("admin_training_programs")
      .select("id,name,category,equipment,weekly_schedule")
      .order("id");
    if (error) throw error;

    const library: PoolExercise[] = await loadAllExercises(supabase);
    const results = (data || [])
      .filter((program) => !`${program.id} ${program.name} ${program.category}`.toLowerCase().includes("hfsc"))
      .map((program) => ({
        program,
        audit: auditProgramCompliance(program, library),
      }));

    if (body.persist !== false && results.length) {
      const { error: upsertError } = await supabase.from("training_program_compliance_audit").upsert(
        results.map(({ program, audit }) => ({
          program_id: program.id,
          name: program.name,
          category: program.category,
          status: audit.passed ? "pass" : "fail",
          issues: audit.issues,
          training_days: audit.trainingDays,
          linked_exercises: audit.linkedExercises,
          audited_at: new Date().toISOString(),
        })),
        { onConflict: "program_id" },
      );
      if (upsertError) throw upsertError;
    }

    return json({
      ok: true,
      total: results.length,
      pass: results.filter(({ audit }) => audit.passed).length,
      fail: results.filter(({ audit }) => !audit.passed).length,
      total_issues: results.reduce((sum, { audit }) => sum + audit.issues.length, 0),
      results: results.map(({ program, audit }) => ({
        id: program.id,
        name: program.name,
        category: program.category,
        ...audit,
      })),
    });
  } catch (error) {
    console.error("[PROGRAM-AUDIT] failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});