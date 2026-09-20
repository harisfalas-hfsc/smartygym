import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { auditProgramCompliance } from "../_shared/program-compliance.ts";
import { loadAllExercises } from "../_shared/workout-engine/pool.server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauthorized = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json();
    if (!body || typeof body.category !== "string" || typeof body.weekly_schedule !== "string") {
      return new Response(JSON.stringify({ error: "Category and weekly schedule are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const library = await loadAllExercises(supabase);
    const audit = auditProgramCompliance({
      category: body.category,
      equipment: typeof body.equipment === "string" ? body.equipment : null,
      weekly_schedule: body.weekly_schedule,
    }, library);
    return new Response(JSON.stringify(audit), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});