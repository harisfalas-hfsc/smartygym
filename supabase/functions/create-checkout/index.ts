import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SmartyGym recurring-subscription price IDs.
// Current Premium checkout is handled by create-lifetime-checkout for
// backward compatibility, but this generic checkout path must still block
// duplicate subscriptions for every active/grandfathered Premium price.
const CURRENT_PREMIUM_PRICE_ID = "price_1Tr93GIxQYg9inGKhIZLvoB2"; // Premium Monthly €9.99
const RETIRED_SMARTYGYM_SUBSCRIPTION_PRICE_IDS = [
  "price_1Tqn9EIxQYg9inGKWXTdr3bS", // [RETIRED] Premium Monthly €6.99
  "price_1SJ9q1IxQYg9inGKZzxxqPbD", // [LEGACY] Gold Monthly
  "price_1SJ9qGIxQYg9inGKFbgqVRjj", // [LEGACY] Platinum Yearly
];
const ALL_SMARTYGYM_SUBSCRIPTION_PRICE_IDS = [
  CURRENT_PREMIUM_PRICE_ID,
  ...RETIRED_SMARTYGYM_SUBSCRIPTION_PRICE_IDS,
];

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { priceId, cancelPath } = await req.json();
    logStep("Request received", { priceId, cancelPath });

    if (!priceId) {
      throw new Error("Price ID is required");
    }

    // Block any attempt to create a NEW Gold/Platinum subscription.
    // The old tiers were retired; only Premium Monthly and Corporate plans are offered going forward.
    if (RETIRED_SMARTYGYM_SUBSCRIPTION_PRICE_IDS.includes(priceId)) {
      logStep("Blocked attempt to checkout a retired subscription tier", { priceId });
      return new Response(JSON.stringify({
          error: "This subscription plan is no longer offered. Please choose SmartyGym Premium Monthly instead.",
        code: "TIER_RETIRED",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 410,
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // CRITICAL: Check if user already has an active SmartyGym subscription (prevent double billing)
    if (customerId) {
      const activeSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        expand: ['data.items.data.price']
      });
      
      // Filter to only active/past-due SmartyGym subscription products.
      const activeSmartyGymSubs = activeSubscriptions.data.filter((sub: { status?: string; items: { data: { price?: { id?: string } }[] } }) => {
        if (!['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status ?? '')) return false;
        const subPriceId = sub.items.data[0]?.price?.id;
        return subPriceId && ALL_SMARTYGYM_SUBSCRIPTION_PRICE_IDS.includes(subPriceId);
      });
      
      if (activeSmartyGymSubs.length > 0) {
        logStep("User already has active SmartyGym subscription - blocking checkout", {
          subscriptionId: activeSmartyGymSubs[0].id
        });
        return new Response(JSON.stringify({ 
          error: "You already have an active subscription. Please manage your existing subscription instead.",
          hasActiveSubscription: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/userdashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}${typeof cancelPath === 'string' && cancelPath.startsWith('/') ? cancelPath : '/'}`,
      payment_method_collection: 'always',
      metadata: {
        user_id: user.id,
        project: "SMARTYGYM",
      },
      subscription_data: {
        metadata: {
          project: "SMARTYGYM",
          user_id: user.id,
        },
        // Guarantees the card used at checkout becomes the subscription's
        // default payment method. Without this, renewal invoices can stall
        // in draft/open because Stripe has no card to charge.
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-checkout:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
