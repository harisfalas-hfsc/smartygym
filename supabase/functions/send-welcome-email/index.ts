import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";
import { getAdminNotificationEmail } from "../_shared/admin-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-welcome-email");
  if (frozen) return frozen;

  try {
    logStep("Function invoked - starting welcome email process");

    let record: any;
    try {
      const body = await req.json();
      record = body.record;
      logStep("Request body parsed", { hasRecord: !!record });
    } catch (parseError) {
      logStep("Failed to parse request body", { error: String(parseError) });
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!record || !record.user_id) {
      logStep("No user_id in record", { record });
      return new Response(
        JSON.stringify({ error: "No user_id provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing new user", { userId: record.user_id, fullName: record.full_name });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user email and check confirmation status
    logStep("Fetching user email from auth");
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
    if (userError) {
      logStep("Error fetching user", { error: userError.message });
      throw userError;
    }
    
    const userEmail = userData.user.email;
    if (!userEmail) {
      logStep("User email not found");
      throw new Error("User email not found");
    }

    // Safety net: skip if user email is not confirmed
    if (!userData.user.email_confirmed_at) {
      logStep("User email not confirmed yet, skipping welcome email", { email: userEmail });
      return new Response(
        JSON.stringify({ success: false, reason: "Email not confirmed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userName = record.full_name || "there";
    logStep("User details fetched", { email: userEmail, name: userName });

    // Get automation rule configuration
    logStep("Fetching automation rule");
    const { data: automationRule, error: ruleError } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("automation_key", "welcome_message")
      .eq("is_active", true)
      .single();

    if (ruleError) {
      logStep("Error fetching automation rule", { error: ruleError.message });
    }

    if (!automationRule) {
      logStep("Welcome automation is disabled or not configured");
      return new Response(
        JSON.stringify({ success: false, reason: "Welcome automation disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Automation rule found", { 
      sendsDashboard: automationRule.sends_dashboard_message, 
      sendsEmail: automationRule.sends_email 
    });

    // Get welcome message template
    logStep("Fetching welcome template");
    const { data: template, error: templateError } = await supabaseAdmin
      .from("automated_message_templates")
      .select("subject, content")
      .eq("message_type", MESSAGE_TYPES.WELCOME)
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    if (templateError) {
      logStep("Error fetching template", { error: templateError.message });
    }

    if (!template) {
      logStep("No active welcome template found");
      return new Response(
        JSON.stringify({ success: false, reason: "No welcome template configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Template found", { subject: template.subject });

    // Check if user already received welcome message
    logStep("Checking for existing welcome message");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_system_messages')
      .select('id')
      .eq('user_id', record.user_id)
      .eq('message_type', MESSAGE_TYPES.WELCOME)
      .limit(1);

    if (existingError) {
      logStep("Error checking existing messages", { error: existingError.message });
    }

    if (existing && existing.length > 0) {
      logStep("User already received welcome message, skipping");
      return new Response(
        JSON.stringify({ success: false, reason: "Welcome message already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let dashboardSent = false;
    let emailSent = false;

    // Send dashboard message immediately using upsert to prevent duplicates
    // The database has a unique index on (user_id, message_type) WHERE message_type = 'welcome'
    if (automationRule.sends_dashboard_message) {
      logStep("Sending dashboard message (with conflict handling)");
      const { data: insertData, error: msgError } = await supabaseAdmin
        .from("user_system_messages")
        .insert({
          user_id: record.user_id,
          message_type: MESSAGE_TYPES.WELCOME,
          subject: template.subject,
          content: template.content,
          is_read: false,
        })
        .select('id')
        .maybeSingle();

      if (msgError) {
        // Check if it's a duplicate key error (race condition - another instance won)
        if (msgError.code === '23505') {
          logStep("Welcome message already exists (race condition prevented)", { userId: record.user_id });
          return new Response(
            JSON.stringify({ success: false, reason: "Welcome message already sent (concurrent request)" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        logStep("Error inserting dashboard message", { error: msgError.message });
      } else if (insertData) {
        dashboardSent = true;
        logStep("Dashboard message sent successfully");
      } else {
        logStep("No insert occurred (duplicate prevented)");
        return new Response(
          JSON.stringify({ success: false, reason: "Welcome message already sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send email immediately
    if (automationRule.sends_email) {
      logStep("Sending welcome email");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (!resendApiKey) {
        logStep("RESEND_API_KEY not configured");
      } else {
        const resend = new Resend(resendApiKey);
        const footer = getEmailFooter(userEmail);
        
        try {
          const emailResult = await resend.emails.send({
            from: "SmartyGym <notifications@smartygym.com>",
            reply_to: "support@smartygym.com",
            to: [userEmail],
            subject: template.subject,
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
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(15,23,42,0.08);">
                        <tr>
                          <td style="background: linear-gradient(135deg, #0F172A 0%, #1e3a8a 50%, #29B6D2 100%); padding: 36px 32px; text-align: center;">
                            <img src="https://smartygym.com/smarty-gym-logo.png" alt="SmartyGym" width="160" style="display:block; margin: 0 auto 14px auto; max-width:160px; height:auto;" />
                            <p style="color: #29B6D2; margin: 0; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">100% Human · 0% AI</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 36px 32px 16px 32px;">
                            <p style="font-size: 17px; line-height: 1.6; margin: 0 0 12px 0; color: #0F172A;">Hi ${userName} 👋</p>
                            <p style="font-size: 16px; line-height: 1.7; margin: 0 0 14px 0; color: #334155;">You just joined a community built around one belief: <strong>aging is not optional — how you age is</strong>.</p>
                            <p style="font-size: 16px; line-height: 1.7; margin: 0 0 8px 0; color: #334155;">Every workout, program and tool here is designed by <strong>Coach Haris Falas</strong> — no algorithms guessing your training. Just real coaching, refined over decades.</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 8px 32px;">
                            <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border-left: 5px solid #EF4444; border-radius: 10px; padding: 18px 20px; margin-bottom: 8px;">
                              <p style="font-size: 16px; font-weight: bold; color: #991B1B; margin: 0 0 6px 0;">⚠️ Before your first workout — PAR-Q Health Check</p>
                              <p style="font-size: 14px; color: #7F1D1D; margin: 0 0 14px 0; line-height: 1.6;">A 2-minute mandatory safety questionnaire. It keeps your training smart and your body safe.</p>
                              <a href="https://smartygym.com/disclaimer#parq" style="display: inline-block; background: #DC2626; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">🩺 Take the PAR-Q Now</a>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 24px 32px 8px 32px;">
                            <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 18px 0; text-align: center;">✨ Your SmartyGym Toolkit</h2>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 10px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🌅</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Daily Smarty Ritual</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">A short, guided start to set the tone of your day.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F0F9FF; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🔥</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Workout of the Day</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">A fresh, human-designed session published every day.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🏋️</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">500+ Workouts</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Strength, cardio, mobility, Pilates, recovery and more.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F0F9FF; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">📋</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Training Programs</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Structured plans built on the 84-day periodization cycle.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">📚</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Exercise Library</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Detailed technique, cues and progressions for every move.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F0F9FF; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🧮</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Smart Tools</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Macro calculator, calorie counter, timer and more.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🎯</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Logbook & Goals</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Track progress, hit milestones, build streaks.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F0F9FF; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">📝</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Blog & Knowledge</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Science-backed articles on strength, nutrition and longevity.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC; border-radius:10px;">
                                    <tr>
                                      <td width="56" style="padding:14px 0 14px 16px; vertical-align:top; font-size:26px;">🤝</td>
                                      <td style="padding:14px 16px;">
                                        <p style="margin:0 0 3px 0; font-weight:bold; color:#0F172A; font-size:15px;">Community</p>
                                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.5;">Train together, share wins, stay accountable.</p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 28px 32px 8px 32px; text-align:center;">
                            <a href="https://smartygym.com/userdashboard" style="display: inline-block; background: linear-gradient(135deg, #29B6D2 0%, #1e88e5 100%); color: #ffffff; padding: 15px 34px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(41,182,210,0.35);">🚀 Open Your Dashboard</a>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 18px 32px 32px 32px; text-align:center;">
                            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 8px 0;">💡 <strong>Quick tip:</strong> start with today's Workout of the Day and let the ritual build itself.</p>
                            <p style="font-size: 16px; color: #0F172A; margin: 18px 0 0 0; font-weight: bold;">Your Gym Re-imagined. Anywhere, Anytime.</p>
                            <p style="font-size: 14px; color: #64748B; margin: 4px 0 0 0;">— Coach Haris Falas & the SmartyGym team</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 32px 32px 32px;">
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
          emailSent = true;
          logStep("Email sent successfully", { emailId: emailResult?.data?.id });
          await logEmailDelivery({
            userId: record.user_id,
            toEmail: userEmail,
            messageType: MESSAGE_TYPES.WELCOME,
            status: "sent",
            resendId: emailResult?.data?.id ?? null,
          });
        } catch (emailError: any) {
          logStep("Error sending email", { error: emailError.message || String(emailError) });
          await logEmailDelivery({
            userId: record.user_id,
            toEmail: userEmail,
            messageType: MESSAGE_TYPES.WELCOME,
            status: "failed",
            errorMessage: emailError?.message || String(emailError),
          });
        }
      }
    }

    // ADMIN ALERT: notify admin inbox of every new member (free or paid)
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const adminEmail = await getAdminNotificationEmail(supabaseAdmin);
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("full_name")
          .eq("user_id", record.user_id).maybeSingle();
        const u: any = userData.user;
        const meta = u.user_metadata || {};
        const fullName = (prof as any)?.full_name || meta.full_name || meta.name || "—";
        const provider = u.app_metadata?.provider || "email";
        const esc = (s: any) => String(s ?? "—").replace(/[&<>"]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
        const row = (k: string, v: any) => `<tr><td style="padding:6px 12px;color:#64748b">${k}</td><td style="padding:6px 12px;font-weight:600">${esc(v)}</td></tr>`;
        const adminResult = await new Resend(resendKey).emails.send({
          from: "SmartyGym Alerts <notifications@smartygym.com>",
          to: [adminEmail],
          subject: `🆕 New SmartyGym member: ${fullName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px">
            <h2 style="color:#0F172A">New member signed up</h2>
            <table style="border-collapse:collapse;background:#f8fafc;width:100%">
              ${row("Name", fullName)}
              ${row("Email", userEmail)}
              ${row("Sign-up method", provider)}
              ${row("Registered", new Date(u.created_at).toLocaleString("en-GB", { timeZone: "Asia/Nicosia" }) + " (Cyprus)")}
              ${row("Email confirmed", new Date(u.email_confirmed_at).toLocaleString("en-GB", { timeZone: "Asia/Nicosia" }) + " (Cyprus)")}
              ${row("Plan", "Free (paid purchases are notified by Stripe)")}
              ${row("User ID", record.user_id)}
            </table>
            <p><a href="https://smartygym.com/admin" style="color:#29B6D2">Open Admin Panel → Users</a></p>
          </div>`,
        });
        await logEmailDelivery({
          userId: record.user_id, toEmail: adminEmail, messageType: "admin_alert",
          status: "sent", resendId: adminResult?.data?.id ?? null,
          metadata: { alert: "new_member", member_email: userEmail },
        });
      }
    } catch (adminErr: any) {
      logStep("Admin new-member alert failed", { error: adminErr?.message || String(adminErr) });
    }

    // Update automation rule execution count
    logStep("Updating automation rule stats");
    const { error: updateError } = await supabaseAdmin
      .from("automation_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        total_executions: (automationRule.total_executions || 0) + 1,
      })
      .eq("id", automationRule.id);

    if (updateError) {
      logStep("Error updating automation rule", { error: updateError.message });
    }

    // Log to audit
    logStep("Logging to audit");
    await supabaseAdmin.from('notification_audit_log').insert({
      notification_type: 'welcome_email',
      message_type: MESSAGE_TYPES.WELCOME,
      subject: template.subject,
      content: template.content,
      recipient_count: 1,
      success_count: (dashboardSent ? 1 : 0) + (emailSent ? 1 : 0),
      failed_count: (!dashboardSent && automationRule.sends_dashboard_message ? 1 : 0) + (!emailSent && automationRule.sends_email ? 1 : 0),
      metadata: {
        user_id: record.user_id,
        user_email: userEmail,
        dashboard_sent: dashboardSent,
        email_sent: emailSent
      }
    });

    logStep("Welcome message process completed", { dashboardSent, emailSent });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome message sent", 
        dashboardSent, 
        emailSent 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("FATAL ERROR", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
