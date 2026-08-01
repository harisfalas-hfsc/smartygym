import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Get Audit Status - Check progress of a running audit or get latest result
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { runId } = await req.json().catch(() => ({}));

    if (runId) {
      // Check specific audit run
      const { data: audit, error } = await supabase
        .from('system_health_audits')
        .select('*')
        .eq('id', runId)
        .maybeSingle();

      if (error || !audit) {
        return new Response(JSON.stringify({ 
          error: 'Audit not found', 
          runId 
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isRunning = audit.results?.status === 'running';
      const completedAt = audit.results?.completed_at || (isRunning ? null : audit.audit_date);
      
      return new Response(JSON.stringify({
        runId,
        status: isRunning ? 'running' : 'completed',
        startedAt: audit.results?.started_at || audit.audit_date,
        completedAt,
        duration_ms: audit.duration_ms,
        summary: isRunning ? null : {
          total_checks: audit.total_checks,
          passed: audit.passed_checks,
          warnings: audit.warning_checks,
          failed: audit.failed_checks,
          skipped: audit.skipped_checks,
          critical_issues: audit.critical_issues
        },
        results: isRunning ? null : audit.results
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No runId - return latest audit
    const { data: latestAudit, error } = await supabase
      .from('system_health_audits')
      .select('*')
      .order('audit_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!latestAudit) {
      return new Response(JSON.stringify({ 
        status: 'no_audits',
        message: 'No audit history found'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isRunning = latestAudit.results?.status === 'running';
    const completedAt = latestAudit.results?.completed_at || (isRunning ? null : latestAudit.audit_date);

    return new Response(JSON.stringify({
      runId: latestAudit.id,
      status: isRunning ? 'running' : 'completed',
      startedAt: latestAudit.results?.started_at || latestAudit.audit_date,
      completedAt,
      duration_ms: latestAudit.duration_ms,
      summary: isRunning ? null : {
        total_checks: latestAudit.total_checks,
        passed: latestAudit.passed_checks,
        warnings: latestAudit.warning_checks,
        failed: latestAudit.failed_checks,
        skipped: latestAudit.skipped_checks,
        critical_issues: latestAudit.critical_issues
      },
      results: isRunning ? null : latestAudit.results
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Status check failed:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
