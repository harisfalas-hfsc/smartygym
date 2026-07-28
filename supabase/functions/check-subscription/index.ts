import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    let user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("Caller authenticated", { userId: user.id, email: user.email });

    if (targetUserId && targetUserId !== user.id) {
      const { data: adminRole, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !adminRole) {
        throw new Error("Unauthorized: Admin access required to sync another user");
      }

      const { data: targetUserData, error: targetUserError } = await supabaseClient.auth.admin.getUserById(targetUserId);
      if (targetUserError || !targetUserData?.user?.email) {
        throw new Error("Target user not found or email missing");
      }

      user = targetUserData.user;
    }

    logStep("Syncing subscription for user", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Prefer the Stripe customer ID we already stored — survives email changes.
    const { data: storedSub } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId: string | null = storedSub?.stripe_customer_id || null;

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      logStep("No customer found, setting free plan");
      
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: user.id,
            plan_type: 'free',
            status: 'active',
            stripe_customer_id: null,
            stripe_subscription_id: null,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        );
      
      if (upsertError) {
        logStep('Free plan sync error', { error: upsertError });
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_type: 'free' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe customer", { customerId });

    // Get all subscriptions with expanded price data.
    // NOTE: Stripe rejects >4 levels of expand, so we intentionally do NOT
    // expand `data.items.data.price.product` here — we fetch the product
    // separately below only when needed.
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price']
    });
    
    logStep("Found subscriptions", { count: subscriptions.data.length });
    
    // Find first active subscription
    const activeSubscription = subscriptions.data.find((sub: any) => 
      sub.status === 'active' || sub.status === 'trialing'
    );
    const pastDueSubscription = subscriptions.data.find((sub: any) =>
      sub.status === 'past_due' || sub.status === 'unpaid'
    );
    const responseStatus = activeSubscription
      ? activeSubscription.status
      : (pastDueSubscription ? pastDueSubscription.status : null);
    
    let planType = 'free';
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;

    if (activeSubscription) {
      stripeSubscriptionId = activeSubscription.id;
      logStep("Active subscription found", { 
        subscriptionId: activeSubscription.id,
        status: activeSubscription.status 
      });
      
      // Get subscription details.
      // NOTE: Stripe API 2025-08-27.basil moved current_period_* to the
      // subscription-item level. Fall back to the item's values when the
      // top-level fields are missing so we don't write NULLs to our DB.
      const firstItem: any = activeSubscription.items?.data?.[0];
      const periodEnd = (activeSubscription as any).current_period_end
        ?? firstItem?.current_period_end
        ?? null;
      const periodStart = (activeSubscription as any).current_period_start
        ?? firstItem?.current_period_start
        ?? null;
      
      if (periodEnd && typeof periodEnd === 'number') {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        logStep("Subscription period", { 
          start: new Date(periodStart * 1000).toISOString(),
          end: subscriptionEnd 
        });
      }
      
      // Determine plan type based on price
      const priceId = activeSubscription.items.data[0]?.price?.id;
      logStep("Checking price ID", { priceId });

      // 1) Prefer product metadata.plan_type (set when we create products).
      //    Works for any future price (promos, regional pricing, etc.).
      const priceObj: any = activeSubscription.items.data[0]?.price;
      let productMetaPlan: string | undefined;
      try {
        const productRef = priceObj?.product;
        if (productRef && typeof productRef === 'object') {
          productMetaPlan = productRef?.metadata?.plan_type;
        } else if (typeof productRef === 'string') {
          const product = await stripe.products.retrieve(productRef);
          productMetaPlan = product?.metadata?.plan_type as string | undefined;
        }
      } catch (e) {
        logStep('Product metadata lookup failed (non-fatal)', { error: String(e) });
      }

      // Legacy recurring subscriptions (Gold/Platinum) are no longer sold.
      // Map any active legacy subscription to `legacy_premium` so the user
      // keeps premium access while we honor what they already paid for, and
      // so analytics can still distinguish them from new Lifetime members.
      if (priceId === 'price_1Tr93GIxQYg9inGKhIZLvoB2' || productMetaPlan === 'premium') {
        // Active Premium Monthly subscription (€9.99/mo)
        planType = 'premium';
        logStep("Matched active Premium Monthly subscription", { priceId });
      } else if (productMetaPlan === 'gold' || productMetaPlan === 'platinum' ||
          priceId === 'price_1Tqn9EIxQYg9inGKWXTdr3bS' ||
          priceId === 'price_1SJ9q1IxQYg9inGKZzxxqPbD' ||
          priceId === 'price_1SJ9qGIxQYg9inGKFbgqVRjj') {
        planType = 'legacy_premium';
        logStep("Matched legacy premium subscription", { priceId, productMetaPlan });
      } else if (productMetaPlan === 'lifetime') {
        planType = 'lifetime';
        logStep("Matched lifetime plan via product metadata", { priceId, planType });
      } else {
        // Unknown recurring price — preserve premium access for the user
        // rather than dropping them to free, but flag for investigation.
        planType = 'legacy_premium';
        logStep("WARN: Unknown price ID — treating as legacy_premium to preserve access", { priceId });
      }
      
      logStep("Determined plan type", { planType, interval: activeSubscription.items.data[0]?.price?.recurring?.interval });

      // Check if this is a renewal (previous subscription existed and new one started)
      const { data: existingSub } = await supabaseClient
        .from('user_subscriptions')
        .select('current_period_end')
        .eq('user_id', user.id)
        .single();
      
      const isRenewal = existingSub && 
        existingSub.current_period_end && 
        new Date(existingSub.current_period_end) < new Date(periodStart * 1000);

      // Update database with subscription info
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: user.id,
            plan_type: planType,
            status: 'active',
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: customerId,
            current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
            current_period_end: subscriptionEnd,
            cancel_at_period_end: activeSubscription.cancel_at_period_end || false,
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        );

      if (upsertError) {
        logStep('Subscription sync error', { error: upsertError });
        return new Response(
          JSON.stringify({ 
            subscribed: true, 
            plan_type: planType,
            subscription_end: subscriptionEnd,
            error: 'Subscription active but sync failed'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      logStep("Database updated successfully");

      // Send renewal thank you message if this is a renewal
      if (isRenewal) {
        try {
          await supabaseClient.functions.invoke('send-system-message', {
            body: {
              userId: user.id,
              messageType: 'renewal_thank_you',
              customData: {
                planName: planType
              }
            }
          });
          logStep("Sent renewal thank you message");
        } catch (msgError) {
          logStep("Failed to send renewal thank you message", { error: msgError });
        }
      }
    } else {
      logStep("No active subscription found");
      
      // Check if user had a subscription before (to detect cancellation)
      const { data: previousSub } = await supabaseClient
        .from('user_subscriptions')
        .select('plan_type, status')
        .eq('user_id', user.id)
        .single();

      const wasCancelled = previousSub && 
        previousSub.plan_type !== 'free' && 
        previousSub.status === 'active';
      const remainsCanceled = previousSub?.status === 'canceled' || previousSub?.status === 'past_due';
      const latestSubscription = subscriptions.data[0];
      
      // Update to free plan
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: user.id,
            plan_type: 'free',
            status: wasCancelled || remainsCanceled ? 'canceled' : 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: wasCancelled || remainsCanceled ? latestSubscription?.id ?? null : null,
            current_period_start: (wasCancelled || remainsCanceled) && latestSubscription?.current_period_start
              ? new Date(latestSubscription.current_period_start * 1000).toISOString()
              : null,
            current_period_end: (wasCancelled || remainsCanceled) && latestSubscription?.current_period_end
              ? new Date(latestSubscription.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: wasCancelled || remainsCanceled ? true : false,
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        );

      if (upsertError) {
        logStep('Free plan update error', { error: upsertError });
      }

      // Send cancellation message if subscription was just cancelled
      if (wasCancelled) {
        try {
          await supabaseClient.functions.invoke('send-system-message', {
            body: {
              userId: user.id,
              messageType: 'cancellation',
              customData: {
                planName: previousSub.plan_type
              }
            }
          });
          logStep("Sent cancellation message");
        } catch (msgError) {
          logStep("Failed to send cancellation message", { error: msgError });
        }
      }
    }

    return new Response(JSON.stringify({
      subscribed: !!activeSubscription,
      plan_type: planType,
      subscription_end: subscriptionEnd,
      status: responseStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: 'Unable to check subscription status. Please try again.' }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});