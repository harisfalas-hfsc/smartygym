import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@3.5.0";
import { getEmailHeaders, getEmailFooter, wrapInEmailTemplateWithFooter } from "../_shared/email-utils.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { canSend, type AutomationKey } from "../_shared/notification-preferences.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  userId: string;
  messageType: string;
  customData?: {
    planName?: string;
    date?: string;
    amount?: string;
    contentName?: string;
    subject?: string;
    content?: string;
  };
}

const OPTIONAL_AUTOMATION_BY_MESSAGE_TYPE: Record<string, AutomationKey> = {
  goal_achievement: "goal_achievement",
  welcome_onboarding: "welcome_onboarding",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdminOrServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const { userId, messageType, customData = {} }: SendMessageRequest = await req.json();

    console.log('[SEND-SYSTEM-MESSAGE] Request:', { userId, messageType, customData });

    if (!userId || !messageType) {
      throw new Error("Missing required fields: userId and messageType");
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the default active template for this message type
    const { data: template, error: templateError } = await supabaseAdmin
      .from('automated_message_templates')
      .select('*')
      .eq('message_type', messageType)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (templateError || !template) {
      console.error('[SEND-SYSTEM-MESSAGE] No default template found:', templateError);
      throw new Error(`No active default template found for message type: ${messageType}`);
    }

    console.log('[SEND-SYSTEM-MESSAGE] Using template:', template.template_name);

    // Replace placeholders in subject and content
    let subject = template.subject;
    let content = template.content;

    if (customData.planName) {
      subject = subject.replace(/\[Plan\]/g, customData.planName);
      content = content.replace(/\[Plan\]/g, customData.planName);
    }
    if (customData.date) {
      subject = subject.replace(/\[Date\]/g, customData.date);
      content = content.replace(/\[Date\]/g, customData.date);
    }
    if (customData.amount) {
      subject = subject.replace(/\[Amount\]/g, customData.amount);
      content = content.replace(/\[Amount\]/g, customData.amount);
    }
    if (customData.contentName) {
      subject = subject.replace(/\[Content\]/g, customData.contentName);
      content = content.replace(/\[Content\]/g, customData.contentName);
    }

    // Allow full override of subject/content from customData
    if (customData.subject) {
      subject = customData.subject;
    }
    if (customData.content) {
      content = customData.content;
    }

    // Check user's dashboard notification preferences before inserting
    const { data: profileForDashboard } = await supabaseAdmin
      .from('profiles')
      .select('notification_preferences, full_name')
      .eq('user_id', userId)
      .single();

    const dashPrefs = profileForDashboard?.notification_preferences as Record<string, any> || {};

    // Personalisation: replace {{name}} / {{first_name}} / {{full_name}} placeholders
    // with the member's real name (graceful fallback when we have no name on file).
    {
      const fullName = (profileForDashboard?.full_name as string | null)?.trim() || "";
      const firstName = fullName ? fullName.split(/\s+/)[0] : "";
      const nameFallback = firstName || "there";
      const replaceNames = (text: string) =>
        text
          .replace(/\{\{\s*first_name\s*\}\}/gi, nameFallback)
          .replace(/\{\{\s*full_name\s*\}\}/gi, fullName || nameFallback)
          .replace(/\{\{\s*name\s*\}\}/gi, nameFallback);
      subject = replaceNames(subject);
      content = replaceNames(content);
    }

    const automationKey = OPTIONAL_AUTOMATION_BY_MESSAGE_TYPE[messageType];
    const shouldSendDashboard = automationKey ? canSend(dashPrefs, automationKey, "dashboard") : true;

    let insertError = null;
    if (shouldSendDashboard) {
      // Insert system message for the user (dashboard)
      const result = await supabaseAdmin
        .from('user_system_messages')
        .insert({
          user_id: userId,
          message_type: messageType,
          subject: subject,
          content: content,
          is_read: false
        });
      insertError = result.error;
    } else {
      console.log(`[SEND-SYSTEM-MESSAGE] User has disabled dashboard ${messageType}, skipping dashboard message`);
    }

    if (insertError) {
      // Handle duplicate welcome messages gracefully (DB trigger may have already inserted one)
      if (insertError.code === '23505' && messageType === 'welcome') {
        console.log('[SEND-SYSTEM-MESSAGE] Welcome message already exists for user, skipping:', userId);
        return new Response(
          JSON.stringify({ success: true, message: "Welcome message already exists", duplicate: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      console.error('[SEND-SYSTEM-MESSAGE] Insert error:', insertError);
      throw insertError;
    }

    console.log('[SEND-SYSTEM-MESSAGE] Dashboard message sent successfully to user:', userId);

    // Mark welcome_sent on profile to prevent duplicate welcome emails
    if (messageType === 'welcome') {
      const { error: welcomeFlagError } = await supabaseAdmin
        .from('profiles')
        .update({ welcome_sent: true })
        .eq('user_id', userId);
      if (welcomeFlagError) {
        console.error('[SEND-SYSTEM-MESSAGE] Failed to set welcome_sent flag:', welcomeFlagError);
      } else {
        console.log('[SEND-SYSTEM-MESSAGE] welcome_sent flag set for user:', userId);
      }
    }

    // Send email as well
    let emailSent = false;
    let userEmail = "";
    try {
      // Get user email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.error('[SEND-SYSTEM-MESSAGE] Could not fetch user email:', userError);
      } else {
        userEmail = userData.user.email;
        
        // Check notification preferences from profiles table
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('notification_preferences')
          .eq('user_id', userId)
          .single();
        
        const prefs = profile?.notification_preferences as Record<string, any> || {};
        
        const shouldSendEmail = automationKey ? canSend(prefs, automationKey, "email") : true;
        if (!shouldSendEmail) {
          console.log(`[SEND-SYSTEM-MESSAGE] User has disabled email ${messageType}, skipping email`);
        } else {
          // Send email with headers and footer
          // Use goals link for goal_achievement notifications
          const ctaLink = 'https://smartygym.lovable.app/userdashboard';
          const ctaText = 'Set New Goals';

          const emailHtml = wrapInEmailTemplateWithFooter(
            subject,
            content,
            userEmail,
            ctaLink,
            ctaText
          );

          const emailResponse = await resend.emails.send({
            from: "SmartyGym <notifications@smartygym.com>",
            to: [userEmail],
            subject: subject,
            html: emailHtml,
            headers: getEmailHeaders(userEmail),
          });

          console.log('[SEND-SYSTEM-MESSAGE] Email sent successfully:', emailResponse.data?.id);
          emailSent = true;
          await logEmailDelivery({
            userId,
            toEmail: userEmail,
            messageType,
            status: "sent",
            resendId: emailResponse?.data?.id ?? null,
          });
        }
      }
    } catch (emailError) {
      console.error('[SEND-SYSTEM-MESSAGE] Email sending failed:', emailError);
      try {
        await logEmailDelivery({
          userId,
          toEmail: userEmail,
          messageType,
          status: "failed",
          errorMessage: emailError instanceof Error ? emailError.message : String(emailError),
        });
      } catch { /* ignore */ }
    }

    // Log to notification audit
    try {
      await supabaseAdmin
        .from('notification_audit_log')
        .insert({
          notification_type: 'automated',
          message_type: messageType,
          sent_by: null,
          recipient_filter: 'single_user',
          recipient_count: 1,
          success_count: 1,
          failed_count: 0,
          subject: subject,
          content: content,
          metadata: { userId, template_id: template.id, email_sent: emailSent }
        });
    } catch (auditError) {
      console.error('[SEND-SYSTEM-MESSAGE] Failed to log audit:', auditError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "System message sent successfully", emailSent }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[SEND-SYSTEM-MESSAGE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
