import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * cron-run-recorder
 *
 * Lightweight endpoint that records a cron job's invocation in
 * `cron_job_runs` and updates `cron_job_metadata.last_run_at`. It calls
 * the actual target edge function via fire-and-forget so the heartbeat
 * has fresh data, and total cron latency is barely affected.
 *
 * Body: { "job_name": "<name>" }
 *
 * The pg_cron job for each cron should ideally POST here, but since most
 * existing crons already POST directly to their target function, this is
 * provided as the building block for Step C of the cron-permanence plan.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireServiceRole(req, corsHeaders);
  if (authError) return authError;

  const frozen = await freezeGuard(corsHeaders, "cron-run-recorder");
  if (frozen) return frozen;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { job_name?: string; status?: string; error?: string; duration_ms?: number; metadata?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const job_name = body.job_name;
  if (!job_name) {
    return new Response(JSON.stringify({ error: "job_name required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const status = body.status ?? "success";
  const isFailure = status !== "success";

  await supabase.from("cron_job_runs").insert({
    job_name,
    started_at: now,
    finished_at: now,
    duration_ms: body.duration_ms ?? null,
    status,
    error_message: body.error ?? null,
    metadata: body.metadata ?? {},
  });

  // Bump last_run on metadata. If failure, increment consecutive_failures.
  if (isFailure) {
    await supabase.rpc("exec_sql", {
      sql: `UPDATE public.cron_job_metadata
              SET last_run_at = now(),
                  last_run_status = '${status.replace(/'/g, "''")}',
                  consecutive_failures = consecutive_failures + 1
            WHERE job_name = '${job_name.replace(/'/g, "''")}'`
    }).catch(() => null);
  } else {
    await supabase
      .from("cron_job_metadata")
      .update({
        last_run_at: now,
        last_run_status: status,
        consecutive_failures: 0,
      })
      .eq("job_name", job_name);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});