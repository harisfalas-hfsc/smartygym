import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPIRE-SUBSCRIPTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const unauthorized = requireServiceRole(req, corsHeaders);
    if (unauthorized) return unauthorized;

    const frozen = await freezeGuard(corsHeaders, "expire-subscriptions");
    if (frozen) return frozen;

    logStep("Function invoked");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date().toISOString();
    logStep("Checking for expired subscriptions", { currentTime: now });

    // Find all active subscriptions that have passed their expiration date
    // Only process admin-granted subscriptions (no stripe_subscription_id)
    // Stripe handles its own subscription expiration via webhooks
    const { data: expiredSubs, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, user_id, plan_type, current_period_end, subscription_source')
      .eq('status', 'active')
      .is('stripe_subscription_id', null)
      .not('current_period_end', 'is', null)
      .lt('current_period_end', now);

    if (fetchError) {
      logStep("Error fetching expired subscriptions", { error: fetchError.message });
      throw new Error(`Failed to fetch expired subscriptions: ${fetchError.message}`);
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      logStep("No expired subscriptions found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired subscriptions to process',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep("Found expired subscriptions", { count: expiredSubs.length });

    // Update all expired subscriptions to 'expired' status
    const expiredUserIds = expiredSubs.map(sub => sub.user_id);
    
    const { error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ 
        status: 'canceled',
        plan_type: 'free',
        updated_at: now
      })
      .in('user_id', expiredUserIds)
      .eq('status', 'active')
      .is('stripe_subscription_id', null);

    if (updateError) {
      logStep("Error updating expired subscriptions", { error: updateError.message });
      throw new Error(`Failed to update expired subscriptions: ${updateError.message}`);
    }

    logStep("Successfully expired subscriptions", { 
      count: expiredSubs.length,
      users: expiredSubs.map(s => ({ 
        user_id: s.user_id, 
        plan_type: s.plan_type,
        expired_at: s.current_period_end 
      }))
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Expired ${expiredSubs.length} subscription(s)`,
        processed: expiredSubs.length,
        expired: expiredSubs.map(s => ({
          user_id: s.user_id,
          plan_type: s.plan_type,
          expired_at: s.current_period_end
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("Error", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
