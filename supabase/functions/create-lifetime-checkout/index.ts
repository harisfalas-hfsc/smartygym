import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { blockIfPlatformPaymentsDisabled } from "../_shared/platform-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-smarty-platform, authorization, x-client-info, apikey, content-type",
};

// Premium Monthly subscription — €9.99/month recurring.
// (Function name kept for backward compatibility with existing clients.)
const PREMIUM_MONTHLY_PRICE_ID = "price_1Tr93GIxQYg9inGKhIZLvoB2";
const PREMIUM_MONTHLY_PRODUCT_ID = "prod_UqU78UzgA2ckcP";
const ALL_SMARTYGYM_SUBSCRIPTION_PRICE_IDS = new Set([
  PREMIUM_MONTHLY_PRICE_ID,
  "price_1Tqn9EIxQYg9inGKWXTdr3bS", // [RETIRED] Premium Monthly €6.99
  "price_1SJ9q1IxQYg9inGKZzxxqPbD", // [LEGACY] Gold Monthly
  "price_1SJ9qGIxQYg9inGKFbgqVRjj", // [LEGACY] Platinum Yearly
]);

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PREMIUM-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const blocked = await blockIfPlatformPaymentsDisabled(req, corsHeaders);
  if (blocked) return blocked;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { cancelPath } = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Block if already premium (subscription or prior lifetime purchase)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: hasPremium } = await supabaseAdmin.rpc("user_has_active_premium_access", {
      _user_id: user.id,
    });
    if (hasPremium === true) {
      return new Response(
        JSON.stringify({
          error: "You already have premium access.",
          alreadyPremium: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    if (customerId) {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
        expand: ["data.items.data.price"],
      });
      const hasLiveSmartyGymSubscription = existingSubscriptions.data.some((sub: any) => {
        if (!["active", "trialing", "past_due", "unpaid"].includes(sub.status)) return false;
        const priceId = sub.items?.data?.[0]?.price?.id;
        return typeof priceId === "string" && ALL_SMARTYGYM_SUBSCRIPTION_PRICE_IDS.has(priceId);
      });

      if (hasLiveSmartyGymSubscription) {
        return new Response(
          JSON.stringify({
            error: "You already have an active subscription. Please manage your existing subscription instead.",
            alreadyPremium: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const origin = req.headers.get("origin") || "https://smartygym.com";
    const safeCancel =
      typeof cancelPath === "string" && cancelPath.startsWith("/") ? cancelPath : "/smarty-premium";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "subscription",
      line_items: [{ price: PREMIUM_MONTHLY_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${safeCancel}`,
      payment_method_collection: "always",
      subscription_data: {
        metadata: {
          project: "SMARTYGYM",
          purchase_type: "premium_monthly",
          user_id: user.id,
        },
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
      },
      metadata: {
        project: "SMARTYGYM",
        purchase_type: "premium_monthly",
        user_id: user.id,
        product_id: PREMIUM_MONTHLY_PRODUCT_ID,
      },
    });

    logStep("Premium monthly checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});