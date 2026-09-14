import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const unauthorized = requireServiceRole(req, corsHeaders);
    if (unauthorized) return unauthorized;

    const frozen = await freezeGuard(corsHeaders, "send-renewal-reminders");
    if (frozen) return frozen;

    console.log("[SEND-RENEWAL-REMINDERS] Starting subscription expiration check");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get automation rule configuration
    const { data: automationRule } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("automation_key", "subscription_expiration")
      .eq("is_active", true)
      .single();

    if (!automationRule) {
      console.log("[SEND-RENEWAL-REMINDERS] Automation is disabled");
      return new Response(
        JSON.stringify({ success: false, reason: "Automation disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Get subscriptions expiring in exactly 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const startOfDay = new Date(threeDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(threeDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: expiringSubscriptions, error: subsError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, plan_type, current_period_end")
      .eq("status", "active")
      .neq("plan_type", "free")
      .gte("current_period_end", startOfDay.toISOString())
      .lte("current_period_end", endOfDay.toISOString());

    if (subsError) throw subsError;

    console.log(`[SEND-RENEWAL-REMINDERS] Found ${expiringSubscriptions?.length || 0} expiring subscriptions`);

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions expiring in 3 days" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get renewal reminder template
    const { data: template } = await supabaseAdmin
      .from("automated_message_templates")
      .select("subject, content")
      .eq("message_type", "renewal_reminder")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.log("[SEND-RENEWAL-REMINDERS] No active template found");
      return new Response(
        JSON.stringify({ success: false, reason: "No template configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let dashboardSent = 0;
    let emailsSent = 0;

    for (const subscription of expiringSubscriptions) {
      try {
        const renewalDate = new Date(subscription.current_period_end).toLocaleDateString();
        const planName = subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1);

        // Replace placeholders
        const subject = template.subject;
        const content = template.content
          .replace(/{planName}/g, planName)
          .replace(/{date}/g, renewalDate);

        // Check if already sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: existing } = await supabaseAdmin
          .from('user_system_messages')
          .select('id')
          .eq('user_id', subscription.user_id)
          .eq('message_type', MESSAGE_TYPES.RENEWAL_REMINDER)
          .gte('created_at', today.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[SEND-RENEWAL-REMINDERS] Skipping user ${subscription.user_id} - already notified today`);
          continue;
        }

        // Prepare properly formatted HTML content
        const formattedContent = `<p class="tiptap-paragraph"><strong>Subscription Renewal Reminder</strong></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Your <strong>${planName}</strong> membership will renew on <strong>${renewalDate}</strong>.</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">Your subscription will automatically renew to continue your access to all premium features.</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph">If you have any questions or need to make changes, please visit your account settings.</p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph"><a href="https://smartygym.com/userdashboard?tab=membership" style="display: inline-block; background: #29B6D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Manage Subscription</a></p><p class="tiptap-paragraph"></p><p class="tiptap-paragraph"><strong>The SmartyGym Team</strong></p>`;
        
        // Send dashboard message
        if (automationRule.sends_dashboard_message) {
          const { error: msgError } = await supabaseAdmin
            .from("user_system_messages")
            .insert({
              user_id: subscription.user_id,
              message_type: MESSAGE_TYPES.RENEWAL_REMINDER,
              subject: subject,
              content: formattedContent,
              is_read: false,
            });

          if (!msgError) dashboardSent++;
        }

        // Send email
        if (automationRule.sends_email) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(subscription.user_id);
          const userEmail = userData?.user?.email;

          if (userEmail) {
            try {
              const footer = getEmailFooter(userEmail);
              
              const emailResult = await resend.emails.send({
                from: "SmartyGym <notifications@smartygym.com>",
                reply_to: "support@smartygym.com",
                to: [userEmail],
                subject: subject,
                headers: getEmailHeaders(userEmail),
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
                            <tr>
                              <td style="padding: 32px;">
                                <h1 style="color: #29B6D2; margin-bottom: 20px;">Subscription Renewal Reminder</h1>
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Your <strong>${planName}</strong> membership will renew on <strong>${renewalDate}</strong>.</p>
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Your subscription will automatically renew to continue your access to all premium features.</p>
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">If you have any questions or need to make changes, please visit your account settings.</p>
                                <p style="margin-top: 24px;">
                                  <a href="https://smartygym.com/userdashboard?tab=membership" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Manage Subscription</a>
                                </p>
                                ${footer}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </body>
                  </html>
                `,
              });
              
              if (emailResult.error) {
                console.error(`[SEND-RENEWAL-REMINDERS] Email API error for ${userEmail}:`, emailResult.error);
                await logEmailDelivery({
                  userId: subscription.user_id,
                  toEmail: userEmail,
                  messageType: "renewal-reminder",
                  status: "failed",
                  errorMessage: emailResult.error.message || String(emailResult.error),
                });
              } else {
                emailsSent++;
                await logEmailDelivery({
                  userId: subscription.user_id,
                  toEmail: userEmail,
                  messageType: "renewal-reminder",
                  status: "sent",
                  resendId: (emailResult as any)?.data?.id ?? null,
                });
                // Rate limiting: 600ms delay to respect Resend's 2 requests/second limit
                await new Promise(resolve => setTimeout(resolve, 600));
              }
            } catch (emailError) {
              console.error(`[SEND-RENEWAL-REMINDERS] Email error for ${userEmail}:`, emailError);
              await logEmailDelivery({
                userId: subscription.user_id,
                toEmail: userEmail,
                messageType: "renewal-reminder",
                status: "failed",
                errorMessage: emailError instanceof Error ? emailError.message : String(emailError),
              });
            }
          }
        }

        console.log(`[SEND-RENEWAL-REMINDERS] Notified user ${subscription.user_id}`);
      } catch (error) {
        console.error(`[SEND-RENEWAL-REMINDERS] Error for user ${subscription.user_id}:`, error);
      }
    }

    // Update automation rule execution count
    await supabaseAdmin
      .from("automation_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        total_executions: (automationRule.total_executions || 0) + dashboardSent,
      })
      .eq("id", automationRule.id);

    // Log to audit
    await supabaseAdmin.from('notification_audit_log').insert({
      notification_type: 'subscription_expiration',
      message_type: 'renewal_reminder',
      recipient_count: expiringSubscriptions.length,
      success_count: dashboardSent,
      failed_count: 0,
      subject: template.subject,
      content: template.content,
    });

    console.log(`[SEND-RENEWAL-REMINDERS] Completed: ${dashboardSent} dashboard, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ success: true, dashboardSent, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SEND-RENEWAL-REMINDERS] ERROR:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
