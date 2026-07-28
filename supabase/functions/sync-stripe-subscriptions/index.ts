import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

/**
 * Reconciles `user_subscriptions` with live Stripe truth for EVERY customer,
 * not just users who happen to log in (check-subscription only runs on login).
 *
 * Fixes the class of bug where the admin panel shows "not available" for
 * "Current plan since" / "Plan expires" because a historical write predates
 * the Stripe 2025-08-27.basil item-level period fields.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[SYNC-STRIPE-SUBS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Stripe 2025-08-27.basil keeps current_period_* on the subscription ITEM.
const getSubPeriod = (sub: any): { start: number | null; end: number | null } => {
  const item: any = sub?.items?.data?.[0];
  const start = item?.current_period_start ?? sub?.current_period_start ?? null;
  const end = item?.current_period_end ?? sub?.current_period_end ?? null;
  return {
    start: typeof start === "number" ? start : null,
    end: typeof end === "number" ? end : null,
  };
};

const periodIso = (ts: number | null): string | null =>
  ts && typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;

const mapStatus = (status: string): "active" | "past_due" | "canceled" => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  return "canceled";
};

const LEGACY_PRICE_IDS = new Set([
  "price_1SJ9q1IxQYg9inGKZzxxqPbD",
  "price_1SJ9qGIxQYg9inGKFbgqVRjj",
]);
const PREMIUM_PRICE_ID = "price_1Tr93GIxQYg9inGKhIZLvoB2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: rows, error: rowsError } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_type, status, subscription_source, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end")
      .not("stripe_customer_id", "is", null)
      // Never let Stripe history override a complimentary/admin-granted membership.
      .or("subscription_source.is.null,subscription_source.neq.admin_grant");
    if (rowsError) throw rowsError;

    log("Loaded local subscription rows", { count: rows?.length ?? 0 });

    let updated = 0;
    let unchanged = 0;
    const details: Array<Record<string, unknown>> = [];

    for (const row of rows ?? []) {
      const customerId = row.stripe_customer_id as string;
      let subs;
      try {
        subs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 10,
          expand: ["data.items.data.price"],
        });
      } catch (e) {
        log("Stripe lookup failed", { customerId, error: String(e) });
        continue;
      }

      const live =
        subs.data.find((s: any) => s.status === "active" || s.status === "trialing") ??
        subs.data.find((s: any) => s.status === "past_due" || s.status === "unpaid") ??
        subs.data[0];

      if (!live) {
        unchanged++;
        continue;
      }

      const period = getSubPeriod(live);
      const priceId = (live as any).items?.data?.[0]?.price?.id as string | undefined;
      const status = mapStatus(live.status);

      let planType = row.plan_type as string;
      if (status === "active") {
        if (priceId === PREMIUM_PRICE_ID) planType = "premium";
        else if (priceId && LEGACY_PRICE_IDS.has(priceId)) planType = "legacy_premium";
        else if (row.plan_type === "free") planType = "legacy_premium";
      }

      const next = {
        plan_type: planType,
        status,
        stripe_subscription_id: live.id,
        current_period_start: periodIso(period.start),
        current_period_end: periodIso(period.end),
        cancel_at_period_end: (live as any).cancel_at_period_end ?? false,
      };

      // Compare timestamps by absolute value: Postgres returns
      // "2026-07-08 04:55:40+00" while Stripe gives "2026-07-08T04:55:40.000Z".
      // A raw string compare would report every row as changed on every run.
      const sameInstant = (a: string | null, b: string | null) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        const ta = new Date(a).getTime();
        const tb = new Date(b).getTime();
        return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
      };

      const changed =
        row.plan_type !== next.plan_type ||
        row.status !== next.status ||
        row.stripe_subscription_id !== next.stripe_subscription_id ||
        !sameInstant(row.current_period_start as string | null, next.current_period_start) ||
        !sameInstant(row.current_period_end as string | null, next.current_period_end);

      if (!changed) {
        unchanged++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("user_subscriptions")
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq("user_id", row.user_id);

      if (updErr) {
        log("Update failed", { userId: row.user_id, error: updErr.message });
        continue;
      }

      updated++;
      details.push({
        user_id: row.user_id,
        plan_type: next.plan_type,
        status: next.status,
        period_start: next.current_period_start,
        period_end: next.current_period_end,
      });
    }

    log("Sync complete", { updated, unchanged });

    return new Response(JSON.stringify({ success: true, updated, unchanged, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
