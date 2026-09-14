import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Pending Notifications
 * 
 * This function is a TRIGGER ONLY - it calls send-new-content-notifications
 * which handles:
 * 1. Fetching items older than 5 minutes (the buffer period)
 * 2. Sending notifications
 * 3. Deleting processed items
 * 
 * IMPORTANT: This function does NOT delete any items itself.
 * The send-new-content-notifications function is the single source of truth
 * for deletion after successful processing.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "process-pending-notifications");
  if (frozen) return frozen;

  console.log("[PROCESS-PENDING] Starting - triggering send-new-content-notifications");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check how many pending notifications exist (for logging only)
    const { data: pendingItems, error: countError } = await supabase
      .from("pending_content_notifications")
      .select("id, content_name, content_type, created_at");

    if (countError) {
      console.error("[PROCESS-PENDING] Error checking pending count:", countError);
    }

    const totalPending = pendingItems?.length || 0;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const eligibleItems = pendingItems?.filter(item => new Date(item.created_at) < fiveMinutesAgo) || [];
    
    console.log(`[PROCESS-PENDING] Status: ${totalPending} total pending, ${eligibleItems.length} eligible (older than 5 min)`);
    
    if (eligibleItems.length > 0) {
      console.log("[PROCESS-PENDING] Eligible items:", eligibleItems.map(i => `${i.content_type}: ${i.content_name}`));
    }

    // Call send-new-content-notifications ONCE
    // That function handles the 5-minute buffer, sends notifications, and deletes processed items
    const response = await fetch(`${supabaseUrl}/functions/v1/send-new-content-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({}),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      console.log("[PROCESS-PENDING] send-new-content-notifications completed successfully:", responseData);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Triggered notification processing",
          totalPending,
          eligibleForProcessing: eligibleItems.length,
          senderResponse: responseData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("[PROCESS-PENDING] send-new-content-notifications failed:", response.status, responseData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Sender returned ${response.status}`,
          details: responseData,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[PROCESS-PENDING] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
