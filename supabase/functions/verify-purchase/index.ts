import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@3.5.0";
import { getEmailHeaders, wrapInEmailTemplateWithFooter } from "../_shared/email-utils.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const mapStripeSubscriptionStatus = (status: Stripe.Subscription.Status): 'active' | 'canceled' | 'past_due' => {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  return 'canceled';
};

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

const planTypeFromPriceId = (priceId: string | undefined | null): 'premium' | 'legacy_premium' | null => {
  if (!priceId) return null;
  if (priceId === 'price_1Tr93GIxQYg9inGKhIZLvoB2') return 'premium';
  if (priceId === 'price_1Tqn9EIxQYg9inGKWXTdr3bS') return 'legacy_premium';
  if (priceId === 'price_1SJ9q1IxQYg9inGKZzxxqPbD') return 'legacy_premium';
  if (priceId === 'price_1SJ9qGIxQYg9inGKFbgqVRjj') return 'legacy_premium';
  return null;
};

async function alreadySentForStripeSession(supabaseClient: any, messageType: string, stripeSessionId: string) {
  const { data } = await supabaseClient
    .from('notification_audit_log')
    .select('id')
    .eq('message_type', messageType)
    .eq('metadata->>stripe_checkout_session_id', stripeSessionId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function sendMandatoryPurchaseMessage(params: {
  supabaseClient: any;
  userId: string;
  userEmail: string;
  messageType: string;
  stripeSessionId: string;
  subject: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseClient, userId, userEmail, messageType, stripeSessionId, subject, content, metadata = {} } = params;

  if (await alreadySentForStripeSession(supabaseClient, messageType, stripeSessionId)) {
    console.log('[VERIFY-PURCHASE] Mandatory purchase message already sent for session', { messageType, stripeSessionId });
    return { skipped: true };
  }

  let dashboardSent = false;
  let emailSent = false;

  const { error: dashboardError } = await supabaseClient
    .from('user_system_messages')
    .insert({
      user_id: userId,
      message_type: messageType,
      subject,
      content,
      is_read: false,
    });

  if (dashboardError) {
    console.error('[VERIFY-PURCHASE] Failed to insert mandatory dashboard message:', dashboardError);
  } else {
    dashboardSent = true;
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const resend = new Resend(resendApiKey);
    const html = wrapInEmailTemplateWithFooter(
      subject,
      content,
      userEmail,
      'https://smartygym.com/userdashboard',
      'Go to Dashboard'
    );

    const result = await resend.emails.send({
      from: 'SmartyGym <notifications@smartygym.com>',
      reply_to: 'support@smartygym.com',
      to: [userEmail],
      subject,
      html,
      headers: getEmailHeaders(userEmail),
    });

    emailSent = true;
    await logEmailDelivery({
      userId,
      toEmail: userEmail,
      messageType,
      status: 'sent',
      resendId: result?.data?.id ?? null,
      metadata: { stripe_checkout_session_id: stripeSessionId, source: 'verify-purchase-fallback', ...metadata },
    });
  } catch (emailError) {
    console.error('[VERIFY-PURCHASE] Failed to send mandatory purchase email:', emailError);
    await logEmailDelivery({
      userId,
      toEmail: userEmail,
      messageType,
      status: 'failed',
      errorMessage: emailError instanceof Error ? emailError.message : String(emailError),
      metadata: { stripe_checkout_session_id: stripeSessionId, source: 'verify-purchase-fallback', ...metadata },
    });
  }

  await supabaseClient
    .from('notification_audit_log')
    .insert({
      notification_type: 'mandatory_purchase',
      message_type: messageType,
      sent_by: null,
      recipient_filter: `user:${userId}`,
      recipient_count: 1,
      success_count: dashboardSent || emailSent ? 1 : 0,
      failed_count: dashboardSent || emailSent ? 0 : 1,
      subject,
      content,
      metadata: {
        stripe_checkout_session_id: stripeSessionId,
        source: 'verify-purchase-fallback',
        dashboard_sent: dashboardSent,
        email_sent: emailSent,
        ...metadata,
      },
    });

  return { skipped: false, dashboardSent, emailSent };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode === "subscription") {
      if (session.metadata?.user_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      if (session.status !== 'complete' && session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ success: false, message: "Subscription checkout is not complete" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const subscriptionId = session.subscription as string | null;
      if (!subscriptionId) throw new Error("Subscription ID not found on checkout session");

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subPeriod = getSubPeriod(subscription);
      const priceId = subscription.items.data[0]?.price?.id;
      const productId = subscription.items.data[0]?.price?.product as string | undefined;
      const customerId = (session.customer as string) || (subscription.customer as string);
      const amount = (session.amount_total ?? subscription.items.data[0]?.price?.unit_amount ?? 999) / 100;

      let planType: string = planTypeFromPriceId(priceId) || 'premium';
      if (productId) {
        try {
          const product = await stripe.products.retrieve(productId);
          const metadataPlanType = product.metadata?.plan_type;
          if (metadataPlanType === 'premium' || metadataPlanType === 'legacy_premium') {
            planType = metadataPlanType;
          }
        } catch (productError) {
          console.warn('[VERIFY-PURCHASE] Product metadata lookup failed:', productError);
        }
      }

      const { error: subError } = await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: userData.user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan_type: planType,
          status: mapStripeSubscriptionStatus(subscription.status),
          current_period_start: periodIso(subPeriod.start),
          current_period_end: periodIso(subPeriod.end),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'user_id' });

      if (subError) throw subError;

      const userEmail = userData.user.email;
      if (userEmail) {
        const { data: template } = await supabaseClient
          .from('automated_message_templates')
          .select('subject, content')
          .eq('message_type', MESSAGE_TYPES.PURCHASE_SUBSCRIPTION)
          .eq('is_active', true)
          .eq('is_default', true)
          .maybeSingle();

        const subject = template?.subject || 'Welcome to SmartyGym Premium — thank you! 🎉';
        const rawContent = template?.content || 'Thank you for joining SmartyGym Premium. Your monthly membership is active and you now have access to all Premium workouts, programs, tools, and daily features.';
        const content = rawContent
          .replace(/\{planName\}|\[Plan\]|{{plan_name}}/g, 'Premium Monthly')
          .replace(/\{amount\}|\[Amount\]|{{amount}}/g, `€${amount.toFixed(2)}`)
          .replace(/{{first_name}}/g, userData.user.user_metadata?.full_name?.split(' ')?.[0] || 'there');

        await sendMandatoryPurchaseMessage({
          supabaseClient,
          userId: userData.user.id,
          userEmail,
          messageType: MESSAGE_TYPES.PURCHASE_SUBSCRIPTION,
          stripeSessionId: session.id,
          subject,
          content,
          metadata: {
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            plan_type: planType,
            amount,
          },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        purchased: true,
        subscription: true,
        plan_type: planType,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (session.payment_status === "paid" && session.metadata) {
      const { user_id, content_type, content_id, content_name } = session.metadata;
      if (user_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      // Guard: standalone purchases must carry content_type in metadata.
      // Without it, the DB insert violates NOT NULL and the whole flow errors.
      if (!content_type || !content_id) {
        console.warn("verify-purchase: missing content metadata on session", { sessionId });
        return new Response(JSON.stringify({
          success: true,
          purchased: true,
          skipped: "missing_content_metadata",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // Get the price from the line items
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
      const priceAmount = lineItems.data[0]?.amount_total || 0;

      // Get shipping address if available (for shop products)
      const shippingAddress = session.shipping_details?.address || null;

      // Insert purchase record
      const { error } = await supabaseClient
        .from('user_purchases')
        .insert([{
          user_id,
          content_type,
          content_id,
          content_name,
          price: priceAmount / 100, // Convert from cents to euros
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_checkout_session_id: sessionId,
          shipping_address: shippingAddress,
        }]);

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        throw error;
      }

      // Log purchase to activity log for logbook
      try {
        await supabaseClient
          .from('user_activity_log')
          .insert({
            user_id,
            content_type: content_type === 'workout' ? 'workout' : 'program',
            item_id: content_id,
            item_name: content_name,
            action_type: 'purchased'
          });
      } catch (logError) {
        console.error('Failed to log purchase activity:', logError);
      }

      // Decrement stock for shop products
      if (content_type === 'shop_product') {
        try {
          const { data: product } = await supabaseClient
            .from('shop_products')
            .select('stock_quantity')
            .eq('id', content_id)
            .maybeSingle();

          if (product && product.stock_quantity !== null && product.stock_quantity > 0) {
            const newStock = Math.max(0, product.stock_quantity - 1);
            await supabaseClient
              .from('shop_products')
              .update({ 
                stock_quantity: newStock,
                is_available: newStock > 0
              })
              .eq('id', content_id);
          }
        } catch (stockError) {
          console.error('Failed to update stock:', stockError);
        }
      }

      // Send purchase confirmation via both dashboard and email
      try {
        // Determine the correct message type based on content_type
        let messageType = 'purchase_thank_you';
        if (content_type === 'shop_product') {
          messageType = 'purchase_shop_product';
        } else if (content_type === 'workout') {
          messageType = 'purchase_workout';
        } else if (content_type === 'program') {
          messageType = 'purchase_program';
        }

        // Get user email
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(user_id);
        if (userError) throw userError;
        
        const userEmail = userData.user.email;
        if (!userEmail) throw new Error("User email not found");

        // Get the default template for this message type
        const { data: template } = await supabaseClient
          .from("automated_message_templates")
          .select("subject, content")
          .eq("message_type", messageType)
          .eq("is_active", true)
          .eq("is_default", true)
          .single();

        if (!template) {
          console.error('No active template found for:', messageType);
          throw new Error(`No active template found for ${messageType}`);
        }

        // Replace placeholders
        const subject = template.subject.replace(/\[Content\]/g, content_name);
        const content = template.content.replace(/\[Content\]/g, content_name);

        // Send mandatory purchase email immediately. This bypasses opt-outs
        // because receipts/access confirmations are required account messages.
        await sendMandatoryPurchaseMessage({
          supabaseClient,
          userId: user_id,
          userEmail,
          messageType,
          stripeSessionId: session.id,
          subject,
          content,
          metadata: { content_type, content_id, content_name },
        });

        console.log('Purchase confirmation sent for:', user_id);
      } catch (msgError) {
        console.error('Failed to send purchase confirmation:', msgError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        purchased: true,
        content_type,
        content_id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: "Payment not completed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: any) {
    console.error("Error verifying purchase:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
