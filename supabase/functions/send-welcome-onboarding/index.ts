import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@3.5.0";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { getEmailHeaders, wrapInEmailTemplateWithFooter } from "../_shared/email-utils.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { canSend } from "../_shared/notification-preferences.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONBOARDING_MESSAGE_TYPE = MESSAGE_TYPES.WELCOME_ONBOARDING;

async function sendOnboardingToUser(supabaseAdmin: any, userId: string) {
  // Check if already sent
  const { data: existing } = await supabaseAdmin
    .from('user_system_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('message_type', ONBOARDING_MESSAGE_TYPE)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[WELCOME-ONBOARDING] Already sent to ${userId}, skipping.`);
    return new Response(JSON.stringify({ success: true, alreadySent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get template
  const { data: template, error: templateError } = await supabaseAdmin
    .from('automated_message_templates')
    .select('*')
    .eq('message_type', ONBOARDING_MESSAGE_TYPE)
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (templateError || !template) {
    console.error("[WELCOME-ONBOARDING] No active template:", templateError);
    return new Response(JSON.stringify({ error: "No template found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }

  // Check notification prefs
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('notification_preferences')
    .eq('user_id', userId)
    .single();

  const prefs = (profile?.notification_preferences as Record<string, any>) || {};

  // Dashboard message
  let dashboardSent = false;
  if (canSend(prefs, "welcome_onboarding", "dashboard")) {
    await supabaseAdmin.from('user_system_messages').insert({
      user_id: userId,
      message_type: ONBOARDING_MESSAGE_TYPE,
      subject: template.dashboard_subject || template.subject,
      content: template.dashboard_content || template.content,
      is_read: false,
    });
    dashboardSent = true;
    console.log(`[WELCOME-ONBOARDING] Dashboard message sent to ${userId}`);
  }

  // Email
  let emailSent = false;
  if (canSend(prefs, "welcome_onboarding", "email")) {
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        const emailSubject = template.email_subject || template.subject;
        const emailContent = template.email_content || template.content;
        const emailHtml = wrapInEmailTemplateWithFooter(
          emailSubject, emailContent, userData.user.email,
          'https://smartygym.lovable.app/userdashboard', 'Explore Your Dashboard'
        );
        const sendResult = await resend.emails.send({
          from: "SmartyGym <notifications@smartygym.com>",
          to: [userData.user.email],
          subject: emailSubject,
          html: emailHtml,
          headers: getEmailHeaders(userData.user.email),
        });
        emailSent = true;
        console.log(`[WELCOME-ONBOARDING] Email sent to ${userData.user.email}`);
        await logEmailDelivery({
          userId,
          toEmail: userData.user.email,
          messageType: ONBOARDING_MESSAGE_TYPE,
          status: "sent",
          resendId: (sendResult as any)?.data?.id ?? null,
        });
      }
    } catch (emailErr) {
      console.error(`[WELCOME-ONBOARDING] Email failed for ${userId}:`, emailErr);
      try {
        await logEmailDelivery({
          userId,
          toEmail: "",
          messageType: ONBOARDING_MESSAGE_TYPE,
          status: "failed",
          errorMessage: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      } catch { /* ignore */ }
    }
  }

  // Audit log
  await supabaseAdmin.from('notification_audit_log').insert({
    notification_type: 'automated',
    message_type: ONBOARDING_MESSAGE_TYPE,
    sent_by: null,
    recipient_filter: 'manual_trigger',
    recipient_count: 1,
    success_count: (dashboardSent ? 1 : 0) + (emailSent ? 1 : 0),
    failed_count: 0,
    subject: template.subject,
    content: 'Welcome Onboarding Guide - manual trigger',
    metadata: { user_id: userId, dashboard_sent: dashboardSent, email_sent: emailSent },
  });

  return new Response(JSON.stringify({ success: true, dashboardSent, emailSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-welcome-onboarding");
  if (frozen) return frozen;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Support manual trigger for a specific user or test email
    let manualTriggerUserId: string | null = null;
    let testEmail: string | null = null;
    try {
      const body = await req.json();
      manualTriggerUserId = body?.manualTriggerUserId || null;
      testEmail = body?.testEmail || null;
    } catch { /* no body = cron trigger */ }

    // Test mode: send template directly to a specific email address
    if (testEmail) {
      console.log(`[WELCOME-ONBOARDING] Test send to: ${testEmail}`);
      const { data: template } = await supabaseAdmin
        .from('automated_message_templates')
        .select('*')
        .eq('message_type', ONBOARDING_MESSAGE_TYPE)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      if (!template) {
        return new Response(JSON.stringify({ error: "No template found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
        });
      }

      const emailSubject = template.email_subject || template.subject;
      const emailContent = template.email_content || template.content;
      const emailHtml = wrapInEmailTemplateWithFooter(
        emailSubject, emailContent, testEmail,
        'https://smartygym.lovable.app/userdashboard', 'Explore Your Dashboard'
      );
      
      const { error: sendError } = await resend.emails.send({
        from: "SmartyGym <notifications@smartygym.com>",
        to: [testEmail],
        subject: emailSubject,
        html: emailHtml,
        headers: getEmailHeaders(testEmail),
      });

      if (sendError) {
        console.error("[WELCOME-ONBOARDING] Test email error:", sendError);
        await logEmailDelivery({
          toEmail: testEmail,
          messageType: `${ONBOARDING_MESSAGE_TYPE}-test`,
          status: "failed",
          errorMessage: sendError.message,
        });
        return new Response(JSON.stringify({ error: sendError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
        });
      }

      console.log(`[WELCOME-ONBOARDING] ✅ Test email sent to ${testEmail}`);
      await logEmailDelivery({
        toEmail: testEmail,
        messageType: `${ONBOARDING_MESSAGE_TYPE}-test`,
        status: "sent",
      });
      return new Response(JSON.stringify({ success: true, testEmailSent: testEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (manualTriggerUserId) {
      console.log(`[WELCOME-ONBOARDING] Manual trigger for user: ${manualTriggerUserId}`);
      return await sendOnboardingToUser(supabaseAdmin, manualTriggerUserId);
    }

    console.log("[WELCOME-ONBOARDING] Starting daily check for 5-day-old premium members...");

    // Check if automation rule is active
    const { data: rule } = await supabaseAdmin
      .from('automation_rules')
      .select('is_active, total_executions')
      .eq('automation_key', 'welcome_onboarding_5day')
      .single();

    if (rule && !rule.is_active) {
      console.log("[WELCOME-ONBOARDING] Automation rule is disabled, skipping.");
      return new Response(JSON.stringify({ success: true, message: "Automation disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('automated_message_templates')
      .select('*')
      .eq('message_type', ONBOARDING_MESSAGE_TYPE)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (templateError || !template) {
      console.error("[WELCOME-ONBOARDING] No active template found:", templateError);
      return new Response(JSON.stringify({ error: "No template found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Find premium members whose subscription was created exactly 5 days ago (within a 24h window)
    const now = new Date();
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStart = new Date(fiveDaysAgo);
    fiveDaysAgoStart.setHours(0, 0, 0, 0);
    const fiveDaysAgoEnd = new Date(fiveDaysAgo);
    fiveDaysAgoEnd.setHours(23, 59, 59, 999);

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .in('plan_type', ['lifetime','premium','legacy_premium'])
      .eq('status', 'active')
      .gte('created_at', fiveDaysAgoStart.toISOString())
      .lte('created_at', fiveDaysAgoEnd.toISOString());

    if (subError) {
      console.error("[WELCOME-ONBOARDING] Error querying subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[WELCOME-ONBOARDING] No qualifying users found today.");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[WELCOME-ONBOARDING] Found ${subscriptions.length} potential users.`);

    let sentCount = 0;
    let skipCount = 0;

    for (const sub of subscriptions) {
      const result = await sendOnboardingToUser(supabaseAdmin, sub.user_id);
      const resultBody = await result.json();
      if (resultBody.alreadySent) {
        skipCount++;
      } else if (resultBody.success) {
        sentCount++;
      }
    }

    // Log audit for batch run
    await supabaseAdmin
      .from('notification_audit_log')
      .insert({
        notification_type: 'automated',
        message_type: ONBOARDING_MESSAGE_TYPE,
        sent_by: null,
        recipient_filter: 'premium_5_day',
        recipient_count: subscriptions.length,
        success_count: sentCount,
        failed_count: 0,
        subject: template.subject,
        content: 'Welcome Onboarding Guide - 5 day follow-up',
        metadata: { skipped: skipCount },
      });

    // Update automation rule last triggered
    await supabaseAdmin
      .from('automation_rules')
      .update({ last_triggered_at: new Date().toISOString(), total_executions: (rule?.total_executions || 0) + 1 })
      .eq('automation_key', 'welcome_onboarding_5day');

    console.log(`[WELCOME-ONBOARDING] Done. Sent: ${sentCount}, Skipped: ${skipCount}`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skipCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[WELCOME-ONBOARDING] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
