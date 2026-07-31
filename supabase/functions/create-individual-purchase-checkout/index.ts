import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { blockIfPlatformPaymentsDisabled } from "../_shared/platform-payments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-smarty-platform, authorization, x-client-info, apikey, content-type",
};

type PurchaseContentRecord = {
  id: string;
  name: string;
  is_visible: boolean | null;
  is_standalone_purchase: boolean | null;
  price: number | string | null;
  image_url: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_workout_of_day?: boolean | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const blocked = await blockIfPlatformPaymentsDisabled(req, corsHeaders);
  if (blocked) return blocked;

  try {
    const { contentType, contentId, cancelPath } = await req.json();

    if (!['workout', 'program'].includes(contentType) || !contentId) {
      return new Response(JSON.stringify({ error: "Invalid purchase request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Auth client (anon) is used ONLY to resolve the caller from their JWT.
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    // Data client (service-role) bypasses RLS so we can read premium/paid
    // admin_workouts and admin_training_programs rows during validation.
    // All business-rule checks (visibility, standalone, price, premium-block,
    // duplicate purchase, Stripe-link integrity) are enforced below.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAuth.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");
    console.log("[INDIV-CHECKOUT] Request", { userId: user.id, contentType, contentId });

    // 🚨 CRITICAL: Check if user is premium (cannot purchase standalone)
    const { data: subscription } = await supabaseClient
      .from('user_subscriptions')
      .select('status, plan_type')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subscription && (['lifetime','premium','legacy_premium'].includes(subscription.plan_type))) {
      return new Response(
        JSON.stringify({ 
          error: "Premium members have access to all content. Individual purchases are not available." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if user already purchased this
    const { data: existingPurchase } = await supabaseClient
      .from('user_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(JSON.stringify({ error: "You already own this content" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // SECURITY: Validate content state from database (don't trust client payload)
    const tableName = contentType === 'workout' ? 'admin_workouts' : 'admin_training_programs';
    const contentQuery = contentType === 'workout'
      ? supabaseClient
          .from('admin_workouts')
          .select('id, name, is_visible, is_standalone_purchase, price, image_url, stripe_product_id, stripe_price_id, is_workout_of_day, generated_for_date')
          .eq('id', contentId)
          .maybeSingle()
      : supabaseClient
          .from('admin_training_programs')
          .select('id, name, is_visible, is_standalone_purchase, price, image_url, stripe_product_id, stripe_price_id')
          .eq('id', contentId)
          .maybeSingle();
    const { data: contentRecordRaw, error: contentError } = await contentQuery;
    const contentRecord = contentRecordRaw as PurchaseContentRecord | null;

    if (contentError || !contentRecord) {
      console.log("[INDIV-CHECKOUT] Content not found", { contentType, contentId, contentError });
      return new Response(JSON.stringify({ error: "Content not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }
    console.log("[INDIV-CHECKOUT] Content loaded", {
      id: contentRecord.id,
      is_visible: contentRecord.is_visible,
      is_standalone_purchase: contentRecord.is_standalone_purchase,
      price: contentRecord.price,
      has_stripe_price: !!contentRecord.stripe_price_id,
    });

    if (contentRecord.is_visible === false || !contentRecord.is_standalone_purchase || !contentRecord.price) {
      return new Response(JSON.stringify({ error: "This content is not available for individual purchase." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const finalContentName = contentRecord.name;
    const finalPrice = Number(contentRecord.price);
    const finalImageUrl = typeof contentRecord.image_url === 'string' && contentRecord.image_url.startsWith('http')
      ? contentRecord.image_url
      : undefined;

    if (!finalContentName || !Number.isFinite(finalPrice) || finalPrice <= 0) {
      return new Response(JSON.stringify({ error: "This content is not configured correctly for purchase." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 422,
      });
    }

    // Create or use existing Stripe product/price. Never trust client-provided product, price, name, or amount.
    let finalPriceId = contentRecord.stripe_price_id;
    const existingProductId = contentRecord.stripe_product_id;

    if (contentType === 'workout' && contentRecord.is_workout_of_day && (!existingProductId || !finalPriceId)) {
      return new Response(JSON.stringify({ error: "This Workout of the Day is temporarily unavailable for purchase." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }

    if ((existingProductId && !finalPriceId) || (!existingProductId && finalPriceId)) {
      return new Response(JSON.stringify({ error: "This content is temporarily unavailable for purchase." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }

    if (existingProductId && finalImageUrl) {
      const existingProduct = await stripe.products.retrieve(existingProductId);
      if (!existingProduct.images?.includes(finalImageUrl)) {
        await stripe.products.update(existingProductId, { images: [finalImageUrl] });
      }
    }
    
    if (!finalPriceId) {
      // Create or reuse product, then create price
      let productIdToUse = existingProductId;

      if (!productIdToUse) {
        const product = await stripe.products.create({
          name: finalContentName,
          images: finalImageUrl ? [finalImageUrl] : undefined,
          metadata: {
            project: "SMARTYGYM",
            content_type: contentType,
            content_id: contentId,
            source: "create-individual-purchase-checkout",
          },
        }, {
          idempotencyKey: `SMARTYGYM:${contentType}:${contentId}:product`,
        });
        productIdToUse = product.id;
      }

      const priceObj = await stripe.prices.create({
        product: productIdToUse,
        unit_amount: Math.round(finalPrice * 100), // Convert to cents
        currency: 'eur',
        metadata: {
          project: "SMARTYGYM",
          content_type: contentType,
          content_id: contentId,
          source: "create-individual-purchase-checkout",
        },
      }, {
        idempotencyKey: `SMARTYGYM:${contentType}:${contentId}:price:${Math.round(finalPrice * 100)}:eur`,
      });

      finalPriceId = priceObj.id;

      // Update database with Stripe IDs
      await supabaseClient
        .from(tableName)
        .update({
          stripe_product_id: productIdToUse,
          stripe_price_id: priceObj.id,
        })
        .eq('id', contentId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}${typeof cancelPath === 'string' && cancelPath.startsWith('/') ? cancelPath : `/${contentType}/${contentId}`}`,
      shipping_address_collection: contentType === 'shop_product' ? {
        allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'GR', 'CY', 'NL', 'BE', 'AT', 'PT', 'IE', 'SE', 'DK', 'FI', 'NO', 'CH', 'PL'],
      } : undefined,
      metadata: {
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        content_name: finalContentName,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const message = error instanceof Error ? error.message : "Unknown checkout error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
