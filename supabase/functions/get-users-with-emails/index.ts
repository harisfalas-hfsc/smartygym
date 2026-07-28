import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECENT_SYNC_WINDOW_DAYS = 45;
const MAX_SYNC_CANDIDATES = 30;

const PLAN_BY_PRICE_ID: Record<string, "premium" | "legacy_premium"> = {
  "price_1Tr93GIxQYg9inGKhIZLvoB2": "premium",
  "price_1Tqn9EIxQYg9inGKWXTdr3bS": "legacy_premium",
  "price_1SJ9q1IxQYg9inGKZzxxqPbD": "legacy_premium",
  "price_1SJ9qGIxQYg9inGKFbgqVRjj": "legacy_premium",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-USERS-WITH-EMAILS] ${step}${detailsStr}`);
};

const isRecentlyJoined = (createdAt: string | null | undefined) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const windowMs = RECENT_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - created <= windowMs;
};

const resolvePlanType = (priceId?: string | null): "premium" | "legacy_premium" | "free" => {
  if (!priceId) return "free";
  return PLAN_BY_PRICE_ID[priceId] ?? "free";
};

async function syncRecentSubscriptionFromStripe({
  userId,
  email,
  existingSubscription,
  stripe,
  supabaseAdmin,
}: {
  userId: string;
  email: string;
  existingSubscription?: any;
  stripe: Stripe;
  supabaseAdmin: any;
}) {
  try {
    let customerId = existingSubscription?.stripe_customer_id as string | null;

    if (!customerId) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    }

    if (!customerId) {
      return null;
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const activeSubscription = subscriptions.data.find(
      (sub: Stripe.Subscription) => sub.status === "active" || sub.status === "trialing",
    );

    if (!activeSubscription) {
      return null;
    }

    const priceId = activeSubscription.items.data[0]?.price?.id ?? null;
    const planType = resolvePlanType(priceId);

    if (planType === "free") {
      logStep("Unknown active price ID during sync", { userId, email, priceId });
      return null;
    }

    const periodStart = activeSubscription.current_period_start
      ? new Date(activeSubscription.current_period_start * 1000).toISOString()
      : null;

    const periodEnd = activeSubscription.current_period_end
      ? new Date(activeSubscription.current_period_end * 1000).toISOString()
      : null;

    const upsertPayload = {
      user_id: userId,
      plan_type: planType,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: activeSubscription.id,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: activeSubscription.cancel_at_period_end ?? false,
      subscription_source: existingSubscription?.subscription_source ?? "stripe",
    };

    const { data: syncedSubscription, error: syncError } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert(upsertPayload, { onConflict: "user_id", ignoreDuplicates: false })
      .select(
        "user_id, plan_type, status, current_period_start, current_period_end, created_at, updated_at, stripe_customer_id, stripe_subscription_id, subscription_source, cancel_at_period_end",
      )
      .single();

    if (syncError) {
      logStep("Stripe sync upsert error", { userId, email, error: syncError.message });
      return null;
    }

    logStep("Synced subscription from Stripe during admin fetch", {
      userId,
      email,
      planType,
      subscriptionId: activeSubscription.id,
    });

    return syncedSubscription;
  } catch (error) {
    logStep("Stripe sync failed for candidate", { userId, email, error: String(error) });
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin verified");

    const [
      profilesResult,
      subscriptionsResult,
      userRolesResult,
      corporateSubsResult,
      corporateMembersResult,
      authUsersResult,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id, full_name, avatar_url, created_at"),
      supabaseAdmin
        .from("user_subscriptions")
        .select(
        "user_id, plan_type, status, current_period_start, current_period_end, created_at, updated_at, stripe_customer_id, stripe_subscription_id, subscription_source, cancel_at_period_end",
        ),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin
        .from("corporate_subscriptions")
        .select("id, admin_user_id, organization_name, plan_type, status, current_period_end"),
      supabaseAdmin.from("corporate_members").select("user_id, corporate_subscription_id, email"),
      (async () => {
        const allUsers: any[] = [];
        let page = 1;
        const perPage = 100;
        while (true) {
          const { data: pageData, error: pageError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (pageError) return { data: null, error: pageError };
          if (!pageData?.users?.length) break;
          allUsers.push(...pageData.users);
          if (pageData.users.length < perPage) break;
          page++;
        }
        return { data: { users: allUsers }, error: null };
      })(),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (corporateSubsResult.error) throw corporateSubsResult.error;
    if (corporateMembersResult.error) throw corporateMembersResult.error;
    if (authUsersResult.error) throw authUsersResult.error;

    if (userRolesResult.error) {
      logStep("Warning: Could not fetch user roles", { error: userRolesResult.error.message });
    }

    const profiles = profilesResult.data ?? [];
    const subscriptions = subscriptionsResult.data ?? [];
    const userRoles = userRolesResult.data ?? [];
    const corporateSubs = corporateSubsResult.data ?? [];
    const corporateMembers = corporateMembersResult.data ?? [];
    const authUsers = authUsersResult.data.users ?? [];

    logStep("Core datasets fetched", {
      profiles: profiles.length,
      subscriptions: subscriptions.length,
      roles: userRoles.length,
      corporateSubs: corporateSubs.length,
      corporateMembers: corporateMembers.length,
      authUsers: authUsers.length,
    });

    const authUserById = new Map(authUsers.map((u: any) => [u.id, u]));
    const subscriptionByUserId = new Map(subscriptions.map((sub: any) => [sub.user_id, sub]));

    // Fallback sync for recently joined users with missing/free subscriptions
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const syncCandidates = profiles
        .map((profile: any) => {
          const existingSubscription = subscriptionByUserId.get(profile.user_id);
          const authUser = authUserById.get(profile.user_id);
          const email = authUser?.email as string | undefined;

          const shouldSync =
            !!email &&
            isRecentlyJoined(profile.created_at) &&
            (!existingSubscription || existingSubscription.plan_type === "free");

          return shouldSync
            ? {
                userId: profile.user_id,
                email,
                existingSubscription,
              }
            : null;
        })
        .filter(Boolean)
        .slice(0, MAX_SYNC_CANDIDATES) as Array<{
          userId: string;
          email: string;
          existingSubscription?: any;
        }>;

      if (syncCandidates.length > 0) {
        logStep("Starting Stripe fallback sync", { candidates: syncCandidates.length });

        const syncedSubscriptions = await Promise.all(
          syncCandidates.map((candidate) =>
            syncRecentSubscriptionFromStripe({
              userId: candidate.userId,
              email: candidate.email,
              existingSubscription: candidate.existingSubscription,
              stripe,
              supabaseAdmin,
            }),
          ),
        );

        let syncedCount = 0;
        for (const syncedSubscription of syncedSubscriptions) {
          if (syncedSubscription?.user_id) {
            subscriptionByUserId.set(syncedSubscription.user_id, syncedSubscription);
            syncedCount++;
          }
        }

        logStep("Stripe fallback sync completed", { syncedCount });
      }
    } else {
      logStep("Skipping Stripe fallback sync - STRIPE_SECRET_KEY missing");
    }

    // Combine data with corporate info and user roles
    const combinedData = profiles.map((profile: any) => {
      const subscription = subscriptionByUserId.get(profile.user_id);
      const authUser = authUserById.get(profile.user_id);
      const userRole = userRoles?.find((r: any) => r.user_id === profile.user_id);

      // Check if user is corporate admin
      const corporateAdmin = corporateSubs?.find((cs: any) => cs.admin_user_id === profile.user_id);

      // Check if user is corporate member
      const corporateMember = corporateMembers?.find((cm: any) => cm.user_id === profile.user_id);
      const memberCorporateSub = corporateMember
        ? corporateSubs?.find((cs: any) => cs.id === corporateMember.corporate_subscription_id)
        : null;

      // Determine status: 'registered' for users without subscription instead of 'inactive'
      const status = subscription?.status || "registered";

      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        email: authUser?.email || null,
        plan_type: subscription?.plan_type || "free",
        status,
        stripe_status: subscription?.status || null,
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
        created_at: profile.created_at,
        subscription_created_at: subscription?.created_at || null,
        subscription_updated_at: subscription?.updated_at || null,
        stripe_customer_id: subscription?.stripe_customer_id || null,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        subscription_source: subscription?.subscription_source || null,
        cancel_at_period_end: subscription?.cancel_at_period_end || false,
        // User role info
        is_admin: userRole?.role === "admin",
        is_moderator: userRole?.role === "moderator",
        user_role: userRole?.role || "user",
        // Corporate admin info
        is_corporate_admin: !!corporateAdmin,
        corporate_admin_org: corporateAdmin?.organization_name || null,
        corporate_admin_plan: corporateAdmin?.plan_type || null,
        corporate_admin_status: corporateAdmin?.status || null,
        corporate_admin_end: corporateAdmin?.current_period_end || null,
        // Corporate member info
        is_corporate_member: !!corporateMember,
        corporate_member_org: memberCorporateSub?.organization_name || null,
        corporate_member_plan: memberCorporateSub?.plan_type || null,
      };
    });

    logStep("Users fetched with emails", { count: combinedData.length });

    return new Response(JSON.stringify({ users: combinedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
