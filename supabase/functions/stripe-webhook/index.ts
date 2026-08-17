import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const mapStripeSubscriptionStatus = (status: Stripe.Subscription.Status): 'active' | 'canceled' | 'past_due' => {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  return 'canceled';
};

// In Stripe API 2025-08-27.basil, current_period_start/end are on the
// subscription item, not the root subscription. Fall back to root for
// older API versions just in case.
const getSubPeriod = (sub: Stripe.Subscription): { start: number | null; end: number | null } => {
  const item: any = sub.items?.data?.[0];
  const start = (item?.current_period_start ?? (sub as any).current_period_start) ?? null;
  const end = (item?.current_period_end ?? (sub as any).current_period_end) ?? null;
  return {
    start: typeof start === 'number' ? start : null,
    end: typeof end === 'number' ? end : null,
  };
};

const periodIso = (ts: number | null): string | null =>
  ts && typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;

// Map a Stripe price ID to our internal plan_type. Mirrors the logic in
// check-subscription so upgrades/downgrades via Customer Portal stay in sync.
// Gold/Platinum recurring products are LEGACY and are surfaced as
// 'legacy_premium' so historical events (refunds, chargebacks, portal edits)
// still resolve to a valid premium tier without re-advertising those plans.
const planTypeFromPriceId = (priceId: string | undefined | null): 'premium' | 'legacy_premium' | null => {
  if (!priceId) return null;
  if (priceId === 'price_1Tr93GIxQYg9inGKhIZLvoB2') return 'premium';        // Premium Monthly €9.99/mo (active)
  if (priceId === 'price_1Tqn9EIxQYg9inGKWXTdr3bS') return 'legacy_premium'; // [RETIRED] Premium Monthly €6.99/mo
  if (priceId === 'price_1SJ9q1IxQYg9inGKZzxxqPbD') return 'legacy_premium'; // [LEGACY] Gold Monthly
  if (priceId === 'price_1SJ9qGIxQYg9inGKFbgqVRjj') return 'legacy_premium'; // [LEGACY] Platinum Yearly
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  
  if (!signature) {
    logStep("ERROR: Missing Stripe signature");
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  try {
    logStep("Webhook received");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Event verified", { type: event.type, id: event.id });
    } catch (err) {
      const error = err as Error;
      logStep("ERROR: Webhook signature verification failed", { error: error.message });
      return new Response(JSON.stringify({ error: `Webhook Error: ${error.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Idempotency guard: record the event id; if it already exists, skip processing.
    const { error: idemError } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });

    if (idemError) {
      // Duplicate key => already processed. Return 200 so Stripe stops retrying.
      if ((idemError as any).code === "23505") {
        logStep("Duplicate event ignored (idempotent)", { id: event.id, type: event.type });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      // Any other error: log but continue (do not block legitimate processing).
      logStep("WARN: Failed to record idempotency row, continuing", { error: idemError });
    }

    // Fast-ack pattern: Stripe disables endpoints that time out. Acknowledge
    // immediately and do the (slow) provisioning + email work in the background.
    const process = async () => {
      try {
        await handleEvent(event, supabase, stripe);
      } catch (e) {
        logStep("ERROR in background processing", { id: event.id, type: event.type, error: (e as Error).message });
      }
    };

    try {
      // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(process());
    } catch {
      await process();
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    const error = err as Error;
    logStep("ERROR in webhook handler", { error: error.message });
    // Return 200 so Stripe does not retry-storm and disable the endpoint;
    // failures are logged and reconciled by the sync/self-healing crons.
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

async function handleEvent(event: Stripe.Event, supabase: any, stripe: Stripe) {
  {
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { sessionId: session.id, mode: session.mode });

        // Check if this is a corporate subscription
        if (session.metadata?.corporate_plan_type) {
          await handleCorporateSubscriptionCheckout(session, supabase, stripe);
        } else if (session.mode === "subscription") {
          // Handle regular subscription checkout
          await handleSubscriptionCheckout(session, supabase, stripe);
        } else if (session.mode === "payment") {
          // Handle one-time purchase
          await handleOneTimePurchase(session, supabase, stripe);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.updated", { subscriptionId: subscription.id, status: subscription.status });
        await handleSubscriptionUpdate(subscription, supabase);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });
        await handleSubscriptionCancellation(subscription, supabase);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice.payment_succeeded", { invoiceId: invoice.id });
        await handleInvoicePaymentSucceeded(invoice, supabase);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice.payment_failed", { invoiceId: invoice.id });
        await handleInvoicePaymentFailed(invoice, supabase);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }
  }
}

// Helper function to check if user is a first-time customer
async function isFirstTimeCustomer(userId: string, supabase: any): Promise<boolean> {
  try {
    // Check if user has any previous purchases
    const { data: purchases, error: purchaseError } = await supabase
      .from('user_purchases')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    
    if (purchaseError) {
      logStep("ERROR checking purchases", { error: purchaseError });
      return false;
    }
    
    if (purchases && purchases.length > 0) {
      return false; // Has previous purchases
    }
    
    // Check if user has any previous subscriptions (excluding 'free')
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, plan_type')
      .eq('user_id', userId)
      .neq('plan_type', 'free')
      .limit(1);
    
    if (subError) {
      logStep("ERROR checking subscriptions", { error: subError });
      return false;
    }
    
    if (subscriptions && subscriptions.length > 0) {
      return false; // Has previous subscriptions
    }
    
    // No purchases and no paid subscriptions = first-time customer
    return true;
  } catch (error) {
    logStep("ERROR in isFirstTimeCustomer", { error });
    return false;
  }
}

// Helper function to send first-purchase welcome message
async function sendFirstPurchaseWelcome(userId: string, userEmail: string, supabase: any) {
  logStep("Sending first-purchase welcome message", { userId, email: userEmail });
  
  // Get the first-purchase welcome template
  const { data: template } = await supabase
    .from('automated_message_templates')
    .select('subject, content')
    .eq('template_name', 'First Purchase Welcome')
    .eq('is_active', true)
    .single();
  
  const subject = template?.subject || '🎉 Welcome to the SmartyGym Family!';
  const content = template?.content || '<p class="tiptap-paragraph"><strong>Welcome to the SmartyGym Family!</strong></p><p class="tiptap-paragraph">Thank you for making your first purchase! We\'re thrilled to have you with us.</p>';
  
  // Send dashboard notification
  try {
    await supabase.from('user_system_messages').insert({
      user_id: userId,
      message_type: MESSAGE_TYPES.FIRST_PURCHASE,
      subject: subject,
      content: content,
      is_read: false,
    });
    logStep("✅ First-purchase welcome dashboard message sent");
  } catch (notifError) {
    logStep("ERROR sending first-purchase welcome notification", { error: notifError });
  }
  
  // Send email
  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    await resend.emails.send({
      from: 'SmartyGym <notifications@smartygym.com>',
      to: [userEmail],
      subject: subject,
      headers: getEmailHeaders(userEmail),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #29B6D2; margin-bottom: 20px;">Welcome to the SmartyGym Family! 🎉</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Thank you for making your first purchase and trusting SmartyGym with your fitness journey. This is a big step, and we're honored to be part of it.</p>
            <h2 style="color: #333; font-size: 18px; margin-top: 24px;">What Makes SmartyGym Different</h2>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Every workout and training program on SmartyGym is expertly designed by <strong>Haris Falas</strong>, a Sports Scientist with over 20 years of coaching experience and CSCS certification. You're not getting generic AI-generated content – you're getting real expertise from a real professional.</p>
            <h2 style="color: #333; font-size: 18px; margin-top: 24px;">What You Now Have Access To</h2>
            <ul style="font-size: 16px; line-height: 1.8; margin-bottom: 24px;">
              <li>Expert-designed workouts crafted for real results</li>
              <li>Strategic training programs based on proven methodologies</li>
              <li>Daily Workout of the Day following smart periodization</li>
              <li>A community of like-minded fitness enthusiasts</li>
            </ul>
            <p style="margin-top: 24px;">
              <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
            </p>
          <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">Welcome aboard – let's make it happen!</p>
          <p style="font-size: 16px; margin-top: 16px;"><em>The SmartyGym Team</em></p>
          ${getEmailFooter(userEmail)}
        </div>
      `,
    });
    logStep("✅ First-purchase welcome email sent", { email: userEmail });
  } catch (emailError) {
    logStep("ERROR sending first-purchase welcome email", { error: emailError });
  }
}

// Handle corporate subscription checkout
async function handleCorporateSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  supabase: any,
  stripe: Stripe
) {
  const userId = session.metadata?.user_id;
  const planType = session.metadata?.corporate_plan_type;
  const organizationName = session.metadata?.organization_name;
  const maxUsers = parseInt(session.metadata?.max_users || '10');
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planType || !organizationName) {
    logStep("ERROR: Missing corporate metadata", { userId, planType, organizationName });
    return;
  }

  logStep("Processing corporate subscription", { userId, planType, organizationName, maxUsers });

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const corpPeriod = getSubPeriod(subscription);

  // Create corporate subscription record
  const { data: corpSub, error: corpError } = await supabase
    .from('corporate_subscriptions')
    .insert({
      admin_user_id: userId,
      organization_name: organizationName,
      plan_type: planType,
      max_users: maxUsers,
      current_users_count: 0,
      current_period_start: periodIso(corpPeriod.start),
      current_period_end: periodIso(corpPeriod.end),
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: 'active',
    })
    .select()
    .single();

  if (corpError) {
    logStep("ERROR: Failed to create corporate subscription", { error: corpError });
    return;
  }

  logStep("Corporate subscription created", { corpSubId: corpSub.id });

  // Also create/update the admin's personal subscription as premium
  await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_type: 'premium',
      status: 'active',
      current_period_start: periodIso(corpPeriod.start),
      current_period_end: periodIso(corpPeriod.end),
    }, {
      onConflict: 'user_id'
    });

  logStep("Admin user subscription set to premium");

  // Get user email for sending welcome email
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  if (userEmail) {
    // Send dashboard notification
    await supabase.from('user_system_messages').insert({
      user_id: userId,
      message_type: MESSAGE_TYPES.CORPORATE_SUBSCRIPTION,
      subject: '🎉 Welcome to Smarty Corporate!',
      content: `<p class="tiptap-paragraph"><strong>Your corporate subscription is now active!</strong></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Organization: ${organizationName}</p><p class="tiptap-paragraph">Plan: Smarty ${planType.charAt(0).toUpperCase() + planType.slice(1)}</p><p class="tiptap-paragraph">Team Limit: ${maxUsers === 9999 ? 'Unlimited' : maxUsers} members</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Head to your <a href="/corporate-admin">Corporate Admin Dashboard</a> to start adding team members!</p>`,
      is_read: false,
    });

    // Send welcome email
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      await resend.emails.send({
        from: 'SmartyGym <notifications@smartygym.com>',
        to: [userEmail],
        subject: '🎉 Welcome to Smarty Corporate!',
        headers: getEmailHeaders(userEmail),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #29B6D2; margin-bottom: 20px;">Welcome to Smarty Corporate! 🏢</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Congratulations! Your corporate subscription is now active.</p>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px;"><strong>Organization:</strong> ${organizationName}</p>
              <p style="margin: 0 0 10px;"><strong>Plan:</strong> Smarty ${planType.charAt(0).toUpperCase() + planType.slice(1)}</p>
              <p style="margin: 0;"><strong>Team Limit:</strong> ${maxUsers === 9999 ? 'Unlimited' : maxUsers} members</p>
            </div>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">All your team members will receive Premium-level access to the entire SmartyGym platform.</p>
            <p style="margin-top: 24px;">
              <a href="https://smartygym.com/corporate-admin" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Add Team Members →</a>
            </p>
            ${getEmailFooter(userEmail)}
          </div>
        `,
      });
      logStep("Corporate welcome email sent", { email: userEmail });
    } catch (emailError) {
      logStep("ERROR sending corporate welcome email", { error: emailError });
    }
  }
}

async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  supabase: any,
  stripe: Stripe
) {
  const userId = session.metadata?.user_id;
  const customerId = session.customer as string;

  if (!userId) {
    logStep("ERROR: No user_id in session metadata");
    return;
  }

  // Check if this is a first-time customer BEFORE creating subscription
  const isFirstTime = await isFirstTimeCustomer(userId, supabase);
  logStep("First-time customer check", { userId, isFirstTime });

  // Get subscription details
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subPeriod = getSubPeriod(subscription);
  const priceId = subscription.items.data[0].price.id;
  const productId = subscription.items.data[0].price.product as string;
  const localStatus = mapStripeSubscriptionStatus(subscription.status);
  
  // Get product details to determine plan type. Prefer Stripe product
  // metadata (kept in sync when we create products), and fall back to the
  // legacy Gold/Platinum price-ID mapping so historical recurring events
  // (refunds/chargebacks/customer portal edits) still resolve to a real
  // plan. As a final safety net, treat anything unknown as legacy_premium —
  // a paying customer should never silently drop to free.
  const product = await stripe.products.retrieve(productId);
  const planType =
    product.metadata?.plan_type ||
    planTypeFromPriceId(priceId) ||
    'legacy_premium';

  logStep("Creating subscription record", { userId, planType, subscriptionId });

  // Check if user is a corporate admin or member - protect their access
  const { data: corpAdmin } = await supabase
    .from('corporate_subscriptions')
    .select('id')
    .eq('admin_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const { data: corpMember } = await supabase
    .from('corporate_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  // If corporate user, only update Stripe IDs without changing plan_type
  // This allows personal subscriptions to coexist with corporate access
  if (corpAdmin || corpMember) {
    logStep("User is corporate admin/member - updating Stripe IDs only, preserving access", { corpAdmin: !!corpAdmin, corpMember: !!corpMember });
    
    // First check if user has existing subscription record
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('id, plan_type')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub) {
      // Update only Stripe-related fields, preserve plan_type
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: localStatus,
          current_period_start: periodIso(subPeriod.start),
          current_period_end: periodIso(subPeriod.end),
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('user_id', userId);

      if (error) {
        logStep("ERROR: Failed to update subscription for corporate user", { error });
      } else {
        logStep("Subscription Stripe IDs updated for corporate user (plan_type preserved)");
      }
    } else {
      // No existing record - create new one with the new plan
      const { error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan_type: planType,
          status: localStatus,
          current_period_start: periodIso(subPeriod.start),
          current_period_end: periodIso(subPeriod.end),
          cancel_at_period_end: subscription.cancel_at_period_end,
        });

      if (error) {
        logStep("ERROR: Failed to create subscription for corporate user", { error });
      } else {
        logStep("New subscription created for corporate user");
      }
    }
  } else {
    // Normal upsert for non-corporate users
    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_type: planType,
        status: localStatus,
        current_period_start: periodIso(subPeriod.start),
        current_period_end: periodIso(subPeriod.end),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      logStep("ERROR: Failed to update subscription", { error });
    } else {
      logStep("Subscription created successfully");
    
    // Track subscription purchase for social media analytics
    try {
      await supabase
        .from('social_media_analytics')
        .insert({
          user_id: userId,
          session_id: `subscription_${subscriptionId}`,
          referral_source: 'direct',
          event_type: 'subscription_purchase',
          event_value: subscription.items.data[0]?.price?.unit_amount ? (subscription.items.data[0].price.unit_amount / 100) : 0,
          landing_page: '/checkout',
        });
      logStep("Subscription purchase tracked in analytics");
    } catch (analyticsError) {
      logStep("ERROR: Failed to track subscription in analytics", { error: analyticsError });
    }
    
    // Display name for the subscription tier (e.g. "Premium", "Lifetime").
    const planName = planType === 'legacy_premium'
      ? 'Premium'
      : planType.charAt(0).toUpperCase() + planType.slice(1);
    
    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    
    if (!userEmail) {
      logStep("ERROR: Could not get user email for purchase confirmation");
      return;
    }
    
    // Get purchase confirmation template
    const { data: template } = await supabase
      .from('automated_message_templates')
      .select('subject, content')
      .eq('message_type', MESSAGE_TYPES.PURCHASE_SUBSCRIPTION)
      .eq('is_default', true)
      .single();
    
    if (template) {
      // Replace placeholders
      const subject = template.subject.replace('{planName}', planName);
      const contentText = template.content.replace('{planName}', planName);
      
      // Send dashboard notification immediately
      try {
        await supabase.from('user_system_messages').insert({
          user_id: userId,
          message_type: MESSAGE_TYPES.PURCHASE_SUBSCRIPTION,
          subject: subject,
          content: contentText,
          is_read: false,
        });
        logStep("✅ Subscription purchase dashboard message sent");
      } catch (notifError) {
        logStep("ERROR sending subscription notification", { error: notifError });
      }
      
      // Send email immediately
      try {
        const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
        await resend.emails.send({
          from: 'SmartyGym <notifications@smartygym.com>',
          to: [userEmail],
          subject: subject,
          headers: getEmailHeaders(userEmail),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #29B6D2; margin-bottom: 20px;">Welcome to ${planName}! 🎉</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Thank you for subscribing to the <strong>${planName}</strong> plan!</p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">You now have full access to all premium features.</p>
            <p style="margin-top: 24px;">
              <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
            </p>
              ${getEmailFooter(userEmail)}
            </div>
          `,
        });
        logStep("✅ Subscription purchase email sent", { email: userEmail });
      } catch (emailError) {
        logStep("ERROR sending subscription email", { error: emailError });
      }
    } else {
      logStep("ERROR: Could not find subscription purchase template");
    }
    
    // If first-time customer, also send the special first-purchase welcome message
    if (isFirstTime) {
      await sendFirstPurchaseWelcome(userId, userEmail, supabase);
    }
    }
  }
}

async function handleOneTimePurchase(
  session: Stripe.Checkout.Session,
  supabase: any,
  stripe: Stripe
) {
  const userId = session.metadata?.user_id;
  const productType = session.metadata?.product_type;
  
  if (!userId) {
    logStep("ERROR: Missing user_id in metadata");
    return;
  }

  // Check if this is a first-time customer BEFORE recording purchase
  const isFirstTime = await isFirstTimeCustomer(userId, supabase);
  logStep("First-time customer check (standalone)", { userId, isFirstTime });

  // Get payment intent to get amount
  const paymentIntentId = session.payment_intent as string;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const amount = paymentIntent.amount / 100; // Convert from cents

  // Handle lifetime membership one-time purchase
  if (session.metadata?.purchase_type === "lifetime_membership") {
    logStep("Recording lifetime membership purchase", { userId, amount });

    const { error: subError } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_type: "lifetime",
          status: "active",
          stripe_customer_id: (session.customer as string) || null,
          stripe_subscription_id: null,
          current_period_end: null,
        },
        { onConflict: "user_id" }
      );

    if (subError) {
      logStep("ERROR: Failed to record lifetime subscription", { error: subError });
    } else {
      logStep("Lifetime subscription recorded successfully");
    }

    // Also log as a purchase for audit/history
    await supabase.from("user_purchases").insert({
      user_id: userId,
      content_id: "lifetime_membership",
      content_type: "membership",
      content_name: "SmartyGym Lifetime Membership",
      price: amount,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: session.id,
    });

    return;
  }

  // Handle standalone workout/program/shop product/ritual purchases
  const contentType = session.metadata?.content_type;
  const contentId = session.metadata?.content_id;
  const contentName = session.metadata?.content_name;

  if (!contentType || !contentId) {
    logStep("ERROR: Missing metadata for purchase", { contentType, contentId });
    return;
  }

  logStep("Recording purchase", { userId, contentType, contentId, amount });

  // Handle ritual purchases separately
  if (contentType === 'ritual') {
    const ritualDate = session.metadata?.ritual_date;
    const { error: ritualError } = await supabase
      .from('ritual_purchases')
      .insert({
        user_id: userId,
        ritual_date: ritualDate,
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: session.id,
      });
    
    if (ritualError) {
      logStep("ERROR: Failed to record ritual purchase", { error: ritualError });
    } else {
      logStep("Ritual purchase recorded successfully", { ritualDate });
    }
    return;
  }

  // Record purchase in database
  const { error } = await supabase
    .from('user_purchases')
    .insert({
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      content_name: contentName,
      price: amount,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: session.id,
    });

  if (error) {
    logStep("ERROR: Failed to record purchase", { error });
    return;
  }
  
  logStep("Purchase recorded successfully");
  
  // Track purchase for social media analytics
  try {
    await supabase
      .from('social_media_analytics')
      .insert({
        user_id: userId,
        session_id: session.id,
        referral_source: 'direct',
        event_type: 'standalone_purchase',
        event_value: amount,
        landing_page: '/checkout',
      });
    logStep("Purchase tracked in analytics");
  } catch (analyticsError) {
    logStep("ERROR: Failed to track purchase in analytics", { error: analyticsError });
  }

  // Get user email
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;
  
  if (!userEmail) {
    logStep("ERROR: Could not get user email for purchase confirmation");
    return;
  }
  
  // Determine message type based on content type (using centralized MESSAGE_TYPES)
  let messageType: string = MESSAGE_TYPES.PURCHASE_WORKOUT;
  if (contentType === 'program') {
    messageType = MESSAGE_TYPES.PURCHASE_PROGRAM;
  } else if (contentType === 'shop_product') {
    messageType = MESSAGE_TYPES.PURCHASE_SHOP_PRODUCT;
  }
  
  // Get purchase template
  const { data: template } = await supabase
    .from('automated_message_templates')
    .select('subject, content')
    .eq('message_type', messageType)
    .eq('is_default', true)
    .single();
  
  if (template) {
    const subject = template.subject.replace('{contentName}', contentName);
    const contentText = template.content.replace('{contentName}', contentName);
    
    // Send dashboard notification immediately
    try {
      await supabase.from('user_system_messages').insert({
        user_id: userId,
        message_type: messageType,
        subject: subject,
        content: contentText,
        is_read: false,
      });
      logStep("✅ Purchase dashboard message sent", { contentType });
    } catch (notifError) {
      logStep("ERROR sending purchase notification", { error: notifError });
    }
    
    // Send email immediately
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      await resend.emails.send({
        from: 'SmartyGym <notifications@smartygym.com>',
        to: [userEmail],
        subject: subject,
        headers: getEmailHeaders(userEmail),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #29B6D2; margin-bottom: 20px;">Purchase Confirmed! 🎉</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Thank you for your purchase of <strong>${contentName}</strong>!</p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Your content is now available in your dashboard.</p>
            <p style="margin-top: 24px;">
              <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
            </p>
            ${getEmailFooter(userEmail)}
          </div>
        `,
      });
      logStep("✅ Purchase email sent", { email: userEmail, contentType });
    } catch (emailError) {
      logStep("ERROR sending purchase email", { error: emailError });
    }
  } else {
    logStep("ERROR: Could not find purchase template", { messageType });
  }
  
  // If first-time customer, also send the special first-purchase welcome message
  if (isFirstTime) {
    await sendFirstPurchaseWelcome(userId, userEmail, supabase);
  }
}

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: any
) {
  const customerId = subscription.customer as string;

  // Find user by customer ID
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan_type')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!existingSub) {
    logStep("ERROR: No user found for customer", { customerId });
    return;
  }

  const userId = existingSub.user_id;
  const oldPlanType = existingSub.plan_type;
  const priceId = subscription.items.data[0].price.id;
  const localStatus = mapStripeSubscriptionStatus(subscription.status);
  const updPeriod = getSubPeriod(subscription);

  // Recompute plan_type from current price so upgrades/downgrades via
  // Customer Portal stay in sync. Prefer product metadata, fall back to
  // our known Gold/Platinum price-ID mapping.
  let newPlanType: string | null = null;
  try {
    const productId = subscription.items.data[0].price.product as string;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const product = await stripe.products.retrieve(productId);
    newPlanType =
      (product.metadata?.plan_type as string | undefined) ||
      planTypeFromPriceId(priceId) ||
      null;
  } catch (e) {
    logStep("WARN: Failed to retrieve product for plan_type recompute", { error: e });
    newPlanType = planTypeFromPriceId(priceId);
  }

  logStep("Updating subscription", { userId, status: subscription.status, oldPlan: oldPlanType });

  // Check if user is a corporate admin or member - protect their access
  const { data: corpAdmin } = await supabase
    .from('corporate_subscriptions')
    .select('id')
    .eq('admin_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const { data: corpMember } = await supabase
    .from('corporate_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  // For corporate users, don't update plan_type - only update Stripe-related fields
  if (corpAdmin || corpMember) {
    logStep("User is corporate admin/member - updating Stripe fields only, preserving plan_type", { corpAdmin: !!corpAdmin, corpMember: !!corpMember });
    
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: localStatus,
        current_period_start: periodIso(updPeriod.start),
        current_period_end: periodIso(updPeriod.end),
        cancel_at_period_end: subscription.cancel_at_period_end,
        // NOTE: plan_type is intentionally NOT updated for corporate users
      })
      .eq('user_id', userId);

    if (error) {
      logStep("ERROR: Failed to update subscription for corporate user", { error });
    } else {
      logStep("Subscription updated for corporate user (plan_type preserved)");
    }
  } else {
    // Normal update for non-corporate users
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: localStatus,
        current_period_start: periodIso(updPeriod.start),
        current_period_end: periodIso(updPeriod.end),
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(newPlanType ? { plan_type: newPlanType } : {}),
      })
      .eq('user_id', userId);

    if (error) {
      logStep("ERROR: Failed to update subscription", { error });
    } else {
      logStep("Subscription updated successfully");
    }
  }

  // Send subscription update notification to user
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  if (userEmail) {
    const nextBillingDate = (updPeriod.end ? new Date(updPeriod.end * 1000) : new Date()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const statusText = subscription.status === 'active' ? 'active' : subscription.status;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    let subject = '📋 Subscription Update';
    let dashboardContent = `<p class="tiptap-paragraph"><strong>Your subscription has been updated.</strong></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Status: ${statusText}</p><p class="tiptap-paragraph">Next billing date: ${nextBillingDate}</p>`;
    
    if (cancelAtPeriodEnd) {
      subject = '📋 Subscription Set to Cancel';
      dashboardContent = `<p class="tiptap-paragraph"><strong>Your subscription is set to cancel.</strong></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">You will continue to have access until ${nextBillingDate}.</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Changed your mind? <a href="/pricing" style="color: #29B6D2;">Resubscribe anytime →</a></p>`;
    }

    // Send dashboard notification
    await supabase.from('user_system_messages').insert({
      user_id: userId,
      message_type: MESSAGE_TYPES.RENEWAL_REMINDER,
      subject: subject,
      content: dashboardContent,
      is_read: false,
    });
    logStep("Subscription update dashboard notification sent");

    // Send email notification
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      await resend.emails.send({
        from: 'SmartyGym <notifications@smartygym.com>',
        to: [userEmail],
        subject: subject,
        headers: getEmailHeaders(userEmail),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #29B6D2; margin-bottom: 20px;">Subscription Update</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Your subscription has been updated.</p>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px;"><strong>Status:</strong> ${statusText}</p>
              <p style="margin: 0;"><strong>Next billing date:</strong> ${nextBillingDate}</p>
              ${cancelAtPeriodEnd ? '<p style="margin: 10px 0 0; color: #e74c3c;"><strong>Note:</strong> Your subscription is set to cancel at the end of the billing period.</p>' : ''}
            </div>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">If you have any questions about your subscription, please don't hesitate to contact us.</p>
            <p style="margin-top: 24px;">
              <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
            </p>
            ${getEmailFooter(userEmail)}
          </div>
        `,
      });
      logStep("✅ Subscription update email sent", { email: userEmail });
    } catch (emailError) {
      logStep("ERROR sending subscription update email", { error: emailError });
    }
  }
}

async function handleSubscriptionCancellation(
  subscription: Stripe.Subscription,
  supabase: any
) {
  const customerId = subscription.customer as string;

  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!existingSub) {
    logStep("ERROR: No user found for customer", { customerId });
    return;
  }

  logStep("Cancelling subscription", { userId: existingSub.user_id });

  // Get user email for sending cancellation email
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(existingSub.user_id);
  const userEmail = userData?.user?.email;
  logStep("Fetched user email for cancellation", { email: userEmail });

  // Calculate subscription end date
  const cancelPeriod = getSubPeriod(subscription);
  const endDate = cancelPeriod.end
    ? new Date(cancelPeriod.end * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'the end of your billing period';

  // Update subscription status
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
    })
    .eq('user_id', existingSub.user_id);

  if (error) {
    logStep("ERROR: Failed to cancel subscription", { error });
  } else {
    logStep("Subscription cancelled successfully");
    
    // Get cancellation template
    const { data: template } = await supabase
      .from('automated_message_templates')
      .select('subject, content')
      .eq('template_name', 'Subscription Cancellation')
      .eq('is_active', true)
      .maybeSingle();

    const subject = template?.subject || '😢 We\'re Sorry to See You Go';
    let content = template?.content || '<p class="tiptap-paragraph">Your subscription has been cancelled. You will continue to have access until the end of your current billing period.</p>';
    
    // Replace placeholder with actual end date
    content = content.replace('{endDate}', endDate);

    // Send dashboard notification
    await supabase
      .from('user_system_messages')
      .insert({
        user_id: existingSub.user_id,
        subject: subject,
        content: content,
        message_type: MESSAGE_TYPES.CANCELLATION,
        is_read: false,
      });
    logStep("Dashboard cancellation notification sent");

    // Send cancellation email
    if (userEmail) {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const resend = new Resend(resendKey);
          
          const htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #29B6D2; margin: 0;">SmartyGym</h1>
              </div>
              <div style="background: #f9f9f9; border-radius: 8px; padding: 30px;">
                <h2 style="margin-top: 0;">Your Subscription Has Been Cancelled</h2>
                <p>We're sorry to see you go. Your subscription has been successfully cancelled.</p>
                <p><strong>What Happens Next:</strong></p>
                <p>You will continue to have full access to all your premium content until <strong>${endDate}</strong>. After that date, your account will revert to free tier access.</p>
                <p><strong>We'd Love to Have You Back:</strong></p>
                <p>If you ever decide to return, your fitness journey awaits. All our expert-designed workouts and training programs will be here for you.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://smartygym.com/pricing" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Resubscribe Anytime →</a>
                </div>
                <p>Thank you for being part of the SmartyGym family. We wish you all the best in your fitness journey!</p>
                <p><em>The SmartyGym Team</em></p>
              </div>
            </body>
            </html>
          `;

          await resend.emails.send({
            from: "SmartyGym <notifications@smartygym.com>",
            to: [userEmail],
            subject: subject,
            headers: getEmailHeaders(userEmail),
            html: htmlEmail.replace('</body>', `${getEmailFooter(userEmail)}</body>`),
          });
          logStep("Cancellation email sent successfully", { email: userEmail });
        }
      } catch (emailError) {
        logStep("ERROR: Failed to send cancellation email", { error: emailError });
      }
    }
  }
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: any
) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    logStep("No subscription ID in invoice, skipping");
    return;
  }

  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan_type')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!existingSub) {
    logStep("ERROR: No user found for customer", { customerId });
    return;
  }

  logStep("Invoice payment succeeded", { userId: existingSub.user_id, amount: invoice.amount_paid / 100 });

  const planName = existingSub.plan_type.charAt(0).toUpperCase() + existingSub.plan_type.slice(1);
  const amount = (invoice.amount_paid / 100).toFixed(2);

  // Get user email
  const { data: userData } = await supabase.auth.admin.getUserById(existingSub.user_id);
  const userEmail = userData?.user?.email;

  if (!userEmail) {
    logStep("User email not found for renewal confirmation", { userId: existingSub.user_id });
    return;
  }

  // Get renewal thank you template
  const { data: template } = await supabase
    .from("automated_message_templates")
    .select("subject, content")
    .eq("message_type", MESSAGE_TYPES.RENEWAL_THANK_YOU)
    .eq("is_active", true)
    .eq("is_default", true)
    .single();

  let subject = '✅ Payment Successful - Thank You!';
  let contentText = `<p class="tiptap-paragraph"><strong>Payment Successful!</strong></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Your ${planName} subscription payment of €${amount} has been processed successfully.</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Thank you for being a valued SmartyGym member! Your premium access continues uninterrupted.</p>`;

  if (template) {
    subject = template.subject.replace(/\{planName\}/g, planName).replace(/\{amount\}/g, amount);
    contentText = template.content.replace(/\{planName\}/g, planName).replace(/\{amount\}/g, amount);
  }

  // Send dashboard notification directly (not via scheduled_notifications)
  await supabase.from('user_system_messages').insert({
    user_id: existingSub.user_id,
    message_type: MESSAGE_TYPES.RENEWAL_THANK_YOU,
    subject: subject,
    content: contentText,
    is_read: false,
  });
  logStep("✅ Renewal thank you dashboard notification sent", { userId: existingSub.user_id });

  // Send email directly via Resend
  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    await resend.emails.send({
      from: 'SmartyGym <notifications@smartygym.com>',
      to: [userEmail],
      subject: subject,
      headers: getEmailHeaders(userEmail),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #d4af37; margin-bottom: 20px;">Payment Successful!</h1>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Your ${planName} subscription payment of <strong>€${amount}</strong> has been processed successfully.</p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Thank you for being a valued SmartyGym member! Your premium access continues uninterrupted.</p>
          <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px;"><strong>Plan:</strong> ${planName}</p>
            <p style="margin: 0;"><strong>Amount:</strong> €${amount}</p>
          </div>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Keep up the great work on your fitness journey!</p>
          <p style="margin-top: 24px;">
            <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: #d4af37; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
          </p>
          ${getEmailFooter(userEmail)}
        </div>
      `,
    });
    logStep("✅ Renewal thank you email sent", { email: userEmail });
  } catch (emailError) {
    logStep("ERROR sending renewal thank you email", { error: emailError });
  }
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: any
) {
  const customerId = invoice.customer as string;

  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!existingSub) {
    logStep("ERROR: No user found for customer", { customerId });
    return;
  }

  logStep("Invoice payment failed", { userId: existingSub.user_id });

  // Get user email
  const { data: userData } = await supabase.auth.admin.getUserById(existingSub.user_id);
  const userEmail = userData?.user?.email;

  // Idempotency: skip if we already sent for this invoice
  const idemKey = `payment_failed:${invoice.id}`;
  const { data: already } = await supabase
    .from('notification_audit_log')
    .select('id')
    .eq('notification_type', idemKey)
    .limit(1)
    .maybeSingle();
  if (already) {
    logStep("Skipping — already notified for this invoice", { invoiceId: invoice.id });
    return;
  }

  // Determine which template to use based on Stripe's retry state
  const isFinal = !invoice.next_payment_attempt;
  const automationKey = isFinal ? 'payment_failed_final' : 'payment_failed_attempt';

  // Update subscription status
  await supabase
    .from('user_subscriptions')
    .update({ status: isFinal ? 'canceled' : 'past_due' })
    .eq('user_id', existingSub.user_id);

  // Load template from admin panel (single source of truth, editable)
  const { data: tpl } = await supabase
    .from('automated_message_templates')
    .select('dashboard_subject, dashboard_content, email_subject, email_content, subject, content')
    .eq('automation_key', automationKey)
    .eq('is_active', true)
    .maybeSingle();

  if (!tpl) {
    logStep("ERROR: template not found", { automationKey });
    return;
  }

  // Personalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', existingSub.user_id)
    .maybeSingle();
  const name = (profile?.full_name || '').split(' ')[0] || 'there';
  const attempt = invoice.attempt_count ?? 1;
  const nextRetry = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
    : '';
  const render = (s: string) =>
    (s || '')
      .replaceAll('{{name}}', name)
      .replaceAll('{{attempt}}', String(attempt))
      .replaceAll('{{next_retry}}', nextRetry);

  const dashSubject = render(tpl.dashboard_subject || tpl.subject || 'Payment failed');
  const dashContent = render(tpl.dashboard_content || tpl.content || '');
  const mailSubject = render(tpl.email_subject || tpl.subject || 'Payment failed');
  const mailContent = render(tpl.email_content || tpl.content || '');

  // Dashboard notification (mandatory — bypasses opt-out)
  await supabase.from('user_system_messages').insert({
    user_id: existingSub.user_id,
    subject: dashSubject,
    content: dashContent,
    message_type: MESSAGE_TYPES.PAYMENT_FAILED,
    is_read: false,
  });
  logStep("Payment failure dashboard notification sent", { automationKey });

  // Email (mandatory — bypasses opt-out)
  let emailOk = false;
  if (userEmail) {
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      await resend.emails.send({
        from: 'SmartyGym <notifications@smartygym.com>',
        to: [userEmail],
        subject: mailSubject,
        headers: getEmailHeaders(userEmail),
        html: mailContent + getEmailFooter(userEmail),
      });
      emailOk = true;
      logStep("✅ Payment failure email sent", { email: userEmail });
    } catch (emailError) {
      logStep("ERROR sending payment failure email", { error: emailError });
    }
  }

  // Audit for idempotency
  await supabase.from('notification_audit_log').insert({
    notification_type: idemKey,
    message_type: MESSAGE_TYPES.PAYMENT_FAILED,
    recipient_count: 1,
    success_count: emailOk ? 1 : 0,
    failed_count: emailOk ? 0 : 1,
    subject: mailSubject,
    content: mailContent,
    metadata: {
      invoice_id: invoice.id,
      attempt_count: attempt,
      is_final: isFinal,
      user_id: existingSub.user_id,
      source: 'stripe-webhook',
    },
  });
}