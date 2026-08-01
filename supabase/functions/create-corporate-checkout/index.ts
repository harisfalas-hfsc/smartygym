import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { blockIfPlatformPaymentsDisabled } from "../_shared/platform-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-smarty-platform, authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CORPORATE-CHECKOUT] ${step}${detailsStr}`);
};

// Corporate plan configurations
const CORPORATE_PLANS = {
  dynamic: { maxUsers: 10, priceId: "price_1TzXU6IxQYg9inGKSvUkoVxG" },
  power: { maxUsers: 20, priceId: "price_1TzXUfIxQYg9inGKr4DRiEg7" },
  elite: { maxUsers: 30, priceId: "price_1TzXVDIxQYg9inGKGBr5prVs" },
  enterprise: { maxUsers: 9999, priceId: "price_1TzXVUIxQYg9inGKOvbKdfr4" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const blocked = await blockIfPlatformPaymentsDisabled(req, corsHeaders);
  if (blocked) return blocked;

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { planType, organizationName, cancelPath } = await req.json();
    
    if (!planType || !CORPORATE_PLANS[planType as keyof typeof CORPORATE_PLANS]) {
      throw new Error("Invalid plan type");
    }

    if (!organizationName || organizationName.trim().length < 2) {
      throw new Error("Organization name is required");
    }

    const plan = CORPORATE_PLANS[planType as keyof typeof CORPORATE_PLANS];
    logStep("Plan selected", { planType, maxUsers: plan.maxUsers, organizationName });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "https://smartygym.com";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/corporate-admin?success=true`,
      cancel_url: `${origin}${typeof cancelPath === 'string' && cancelPath.startsWith('/') ? cancelPath : '/corporate?canceled=true'}`,
      metadata: {
        user_id: user.id,
        corporate_plan_type: planType,
        organization_name: organizationName.trim(),
        max_users: plan.maxUsers.toString(),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          corporate_plan_type: planType,
          organization_name: organizationName.trim(),
          max_users: plan.maxUsers.toString(),
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
