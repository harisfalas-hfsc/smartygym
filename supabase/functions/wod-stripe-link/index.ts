import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * PLAN B: Background Stripe linker for WODs.
 *
 * Called fire-and-forget by `generate-workout-of-day` immediately after a WOD
 * row is inserted with stripe_product_id=NULL / stripe_price_id=NULL, and
 * also re-fired by the watchdog if a WOD is still missing IDs after 10 min.
 *
 * Idempotent: uses deterministic Stripe idempotency keys keyed on the WOD's
 * generated_for_date + equipment, so retries never create duplicates.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const { workout_id } = await req.json();
    if (!workout_id) throw new Error("workout_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: wod, error: fetchErr } = await supabase
      .from("admin_workouts")
      .select("id, name, category, equipment, image_url, price, stripe_product_id, stripe_price_id, generated_for_date, is_workout_of_day")
      .eq("id", workout_id)
      .single();
    if (fetchErr || !wod) throw new Error(`WOD not found: ${workout_id}`);

    if (wod.stripe_product_id && wod.stripe_price_id) {
      console.log(`[wod-stripe-link] ${workout_id} already linked, skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const date = wod.generated_for_date || new Date().toISOString().slice(0, 10);
    const equipment = (wod.equipment || "VARIOUS").toUpperCase();

    // Include workout_id so re-generations on the same day/slot don't collide
    // with the archived WOD's already-burned idempotency key.
    const productKey = `SMARTYGYM:wod:${wod.id}:product`;
    const priceKey = `SMARTYGYM:wod:${wod.id}:price`;

    const product = await stripe.products.create({
      name: wod.name,
      description: `${wod.category} Workout (${equipment})`,
      images: wod.image_url ? [wod.image_url] : [],
      metadata: {
        project: "SMARTYGYM",
        content_type: "Workout",
        content_id: wod.id,
        workout_id: wod.id,
        type: "wod",
        category: wod.category || "",
        equipment,
        generated_for_date: date,
      },
    }, { idempotencyKey: productKey });

    const unitAmount = Math.round(Number(wod.price || 3.99) * 100);
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: "eur",
      metadata: {
        project: "SMARTYGYM",
        content_id: wod.id,
        generated_for_date: date,
        equipment,
      },
    }, { idempotencyKey: priceKey });

    await stripe.products.update(product.id, { default_price: price.id });

    const { error: updateErr } = await supabase
      .from("admin_workouts")
      .update({ stripe_product_id: product.id, stripe_price_id: price.id })
      .eq("id", workout_id);
    if (updateErr) throw updateErr;

    console.log(`[wod-stripe-link] linked ${workout_id} → ${product.id} / ${price.id}`);

    return new Response(
      JSON.stringify({ success: true, workout_id, product_id: product.id, price_id: price.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[wod-stripe-link] error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});