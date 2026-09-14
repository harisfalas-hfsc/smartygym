import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { canSend } from "../_shared/notification-preferences.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, details?: any) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-RITUAL-NOTIFICATIONS] ${step}${detailsStr}`);
}

// Default fallback content
const DEFAULT_DASHBOARD_SUBJECT = "🌅 Your Daily Smarty Ritual is Ready!";
const DEFAULT_EMAIL_SUBJECT = "🌅 Good Morning, Smarty!";

function buildDefaultDashboardContent(): string {
  return `<p class="tiptap-paragraph"><strong>🌅 Good Morning, Smarty!</strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Your Daily Smarty Ritual is ready!</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Start your day with intention through our three wellness rituals:</p>
<p class="tiptap-paragraph">☀️ <strong>Morning</strong> - Energize your start</p>
<p class="tiptap-paragraph">🌤️ <strong>Midday</strong> - Recharge and refocus</p>
<p class="tiptap-paragraph">🌙 <strong>Evening</strong> - Wind down peacefully</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><a href="https://smartygym.com/daily-ritual">View Today's Ritual →</a></p>`;
}

function buildDefaultEmailHtml(email: string): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #29B6D2;">🌅 Good Morning, Smarty!</h1>
<p style="font-size: 16px;">Your <strong>Daily Smarty Ritual</strong> is ready!</p>
<p style="color: #666;">Start your day with intention through our three wellness rituals:</p>
<div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 10px 0;">☀️ <strong>Morning</strong> - Energize your start</p>
  <p style="margin: 10px 0;">🌤️ <strong>Midday</strong> - Recharge and refocus</p>
  <p style="margin: 10px 0;">🌙 <strong>Evening</strong> - Wind down peacefully</p>
</div>
<p style="margin-top: 20px;"><a href="https://smartygym.com/daily-ritual" style="background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Today's Ritual →</a></p>
${getEmailFooter(email, 'ritual')}
</div>`;
}

function replacePlaceholders(content: string, replacements: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-ritual-notifications");
  if (frozen) return frozen;

  try {
    logStep("Starting Ritual notification delivery (7:05 AM Cyprus time)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Get today's date in Cyprus timezone
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const cyprusOffset = (month >= 4 && month <= 10) ? 3 : 2;
    const cyprusTime = new Date(now.getTime() + cyprusOffset * 60 * 60 * 1000);
    const todayStr = cyprusTime.toISOString().split('T')[0];

    logStep("Looking for today's ritual", { todayStr });

    // Today's ritual = the one assigned to today by the rotation cron.
    const { data: assignment, error: assignErr } = await supabase
      .from("daily_ritual_assignments")
      .select("ritual_id, daily_smarty_rituals(*)")
      .eq("ritual_date", todayStr)
      .maybeSingle();

    const todaysRitual: any = assignment?.daily_smarty_rituals ?? null;

    if (assignErr || !todaysRitual) {
      logStep("No ritual assigned for today", { error: assignErr?.message });
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "No ritual for today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const dayNumber = todaysRitual.day_number;
    const ritualDate = todaysRitual.ritual_date;

    logStep("Ritual found", { dayNumber, ritualDate });

    // Check if notification was already sent today
    const todayStart = new Date(cyprusTime.getFullYear(), cyprusTime.getMonth(), cyprusTime.getDate()).toISOString();
    const { data: existingNotification } = await supabase
      .from("notification_audit_log")
      .select("id")
      .eq("notification_type", MESSAGE_TYPES.DAILY_RITUAL)
      .gte("sent_at", todayStart)
      .limit(1);

    if (existingNotification && existingNotification.length > 0) {
      logStep("Ritual notification already sent today, skipping");
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Already sent today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // FETCH EDITABLE TEMPLATE from automated_message_templates
    // Look for templates with message_type = 'daily_ritual' or automation_key = 'daily_ritual'
    const { data: templates } = await supabase
      .from("automated_message_templates")
      .select("*")
      .or("message_type.eq.daily_ritual,automation_key.eq.daily_ritual")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });

    let template = templates && templates.length > 0 ? (templates.find(t => t.is_default) || templates[0]) : null;

    logStep("Template selection", { 
      found: !!template, 
      templateName: template?.template_name,
      templateId: template?.id
    });

    // Prepare placeholder replacements
    const placeholders = {
      day_number: String(dayNumber),
      ritual_date: ritualDate,
    };

    // Build notification content - USE TEMPLATE if available
    let dashboardSubject: string;
    let dashboardContent: string;
    let emailSubject: string;

    if (template) {
      dashboardSubject = replacePlaceholders(template.dashboard_subject || template.subject || DEFAULT_DASHBOARD_SUBJECT, placeholders);
      dashboardContent = replacePlaceholders(template.dashboard_content || template.content || buildDefaultDashboardContent(), placeholders);
      emailSubject = replacePlaceholders(template.email_subject || template.subject || DEFAULT_EMAIL_SUBJECT, placeholders);
      logStep("Using template content", { subject: dashboardSubject });
    } else {
      dashboardSubject = DEFAULT_DASHBOARD_SUBJECT;
      dashboardContent = buildDefaultDashboardContent();
      emailSubject = DEFAULT_EMAIL_SUBJECT;
      logStep("Using default hardcoded content (no template found)");
    }

    // Get all users with their preferences
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id, notification_preferences');

    const profilesMap = new Map(allProfiles?.map(p => [p.user_id, p.notification_preferences as Record<string, any>]) || []);

    // Filter users who have ritual dashboard notifications enabled (default true)
    const usersForDashboard = allProfiles?.filter(p => {
      const prefs = p.notification_preferences as Record<string, any> || {};
      return canSend(prefs, "morning_daily_digest", "dashboard");
    }).map(p => p.user_id) || [];

    if (usersForDashboard.length === 0) {
      logStep("No users subscribed to Ritual dashboard notifications");
    } else {
      logStep(`Sending Ritual dashboard notifications to ${usersForDashboard.length} users`);
    }

    // Insert dashboard notifications
    if (usersForDashboard.length > 0) {
      await supabase.from('user_system_messages').insert(usersForDashboard.map(userId => ({
        user_id: userId,
        message_type: MESSAGE_TYPES.DAILY_RITUAL,
        subject: dashboardSubject,
        content: dashboardContent,
        is_read: false,
      })));

      logStep("Dashboard notifications inserted", { count: usersForDashboard.length });
    }

    // Paginate through ALL users (listUsers defaults to 50 per page)
    const allAuthUsers: any[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage });
      if (!pageData?.users?.length) break;
      allAuthUsers.push(...pageData.users);
      if (pageData.users.length < perPage) break;
      page++;
    }
    const usersData = { users: allAuthUsers };

    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const authUser of usersData?.users || []) {
      if (!authUser.email) continue;

      const prefs = profilesMap.get(authUser.id) || {};

      if (!canSend(prefs, "morning_daily_digest", "email")) {
        logStep(`Skipping Ritual email for ${authUser.email} (opted out)`);
        emailsSkipped++;
        continue;
      }

      try {
        let emailHtml: string;
        if (template && template.email_content) {
          emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
${replacePlaceholders(template.email_content, placeholders)}
${getEmailFooter(authUser.email, 'ritual')}
</div>`;
        } else {
          emailHtml = buildDefaultEmailHtml(authUser.email);
        }

        const emailResult = await resendClient.emails.send({
          from: 'SmartyGym <notifications@smartygym.com>',
          to: [authUser.email],
          subject: emailSubject,
          headers: getEmailHeaders(authUser.email, 'ritual'),
          html: emailHtml,
        });

        if (emailResult.error) {
          logStep("Email API error", { email: authUser.email, error: emailResult.error });
          await logEmailDelivery({
            userId: authUser.id,
            toEmail: authUser.email,
            messageType: MESSAGE_TYPES.DAILY_RITUAL,
            status: "failed",
            errorMessage: typeof emailResult.error === 'string' ? emailResult.error : JSON.stringify(emailResult.error),
          });
        } else {
          emailsSent++;
          await logEmailDelivery({
            userId: authUser.id,
            toEmail: authUser.email,
            messageType: MESSAGE_TYPES.DAILY_RITUAL,
            status: "sent",
            resendId: emailResult.data?.id ?? null,
          });
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      } catch (e) {
        logStep("Email send error", { email: authUser.email, error: e });
        await logEmailDelivery({
          userId: authUser.id,
          toEmail: authUser.email,
          messageType: MESSAGE_TYPES.DAILY_RITUAL,
          status: "failed",
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Add audit log entry with automation_key for proper history tracking
    // Use 'daily_ritual' which matches the database constraint
    const { error: auditError } = await supabase.from('notification_audit_log').insert({
      notification_type: 'daily_ritual',
      message_type: MESSAGE_TYPES.DAILY_RITUAL,
      recipient_count: usersForDashboard.length,
      success_count: emailsSent,
      failed_count: emailsSkipped,
      subject: dashboardSubject,
      content: `Ritual notification sent - ${emailsSent} emails, ${usersForDashboard.length} dashboard messages. Template: ${template?.template_name || 'default'}`,
      sent_at: new Date().toISOString(),
      metadata: {
        automation_key: 'morning_ritual_notification',
        template_id: template?.id || null,
        template_name: template?.template_name || 'default',
        ritual: { dayNumber, date: ritualDate }
      }
    });

    if (auditError) {
      logStep("WARNING: Failed to insert audit log", { error: auditError.message });
    }

    logStep(`✅ Notifications complete: ${usersForDashboard.length} dashboard, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({
        success: true,
        dashboardNotifications: usersForDashboard.length,
        emailsSent,
        emailsSkipped,
        templateUsed: template?.template_name || 'default',
        ritual: { dayNumber, date: ritualDate }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
