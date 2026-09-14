import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { canSend } from "../_shared/notification-preferences.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * send-automated-messages
 *
 * Cron: every 10 minutes (send-automated-messages-job).
 *
 * Picks up admin-scheduled one-off / recurring templates in
 * `automated_message_templates` whose `next_scheduled_time` is now-or-past and
 * dispatches them to the configured `target_audience`. After dispatch, advances
 * `next_scheduled_time` according to `recurrence_pattern` (once -> NULL,
 * daily/every_2_days/every_3_days/weekly -> +interval). If no template is due,
 * the function exits cleanly with `{ processed: 0 }`.
 *
 * This function intentionally does NOT send normal automation flows (welcome,
 * weekly motivation, etc.) — those have their own dedicated functions.
 */

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

function advanceNextRun(currentIso: string | null, pattern: string | null): string | null {
  if (!pattern || pattern === "once") return null;
  const base = currentIso ? new Date(currentIso) : new Date();
  const next = new Date(base);
  switch (pattern) {
    case "daily": next.setUTCDate(next.getUTCDate() + 1); break;
    case "every_2_days": next.setUTCDate(next.getUTCDate() + 2); break;
    case "every_3_days": next.setUTCDate(next.getUTCDate() + 3); break;
    case "weekly": next.setUTCDate(next.getUTCDate() + 7); break;
    default: return null;
  }
  return next.toISOString();
}

function substitute(text: string, name: string): string {
  return (text || "")
    .replace(/\{\{name\}\}/g, name || "Smarty")
    .replace(/\[Name\]/g, name || "Smarty");
}

function htmlWrap(subject: string, content: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5"><tr><td style="padding:20px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px">
      <tr><td style="padding:40px;text-align:center">
        <img src="https://smartygym.com/smarty-gym-logo.png" alt="SmartyGym" style="height:60px;margin-bottom:20px;max-width:100%"/>
        <h1 style="color:#fff;font-size:24px;margin:0 0 20px 0">${subject}</h1>
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:24px;text-align:left;color:#ccc;font-size:14px;line-height:1.6">${content}</div>
        <a href="https://smartygym.com/userdashboard" style="display:inline-block;background:linear-gradient(135deg,#29B6D2 0%,#1E9CB8 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:14px;margin:20px 0">Go to Dashboard</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const frozen = await freezeGuard(corsHeaders, "send-automated-messages");
  if (frozen) return frozen;

  const supabase = createClient(PROJECT_URL, SERVICE_KEY);
  const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
  const nowIso = new Date().toISOString();

  // Pick templates that are scheduled, due, and still active.
  const { data: due, error } = await supabase
    .from("automated_message_templates")
    .select("*")
    .eq("is_active", true)
    .eq("status", "active")
    .not("next_scheduled_time", "is", null)
    .lte("next_scheduled_time", nowIso)
    .limit(20);

  if (error) {
    console.error("[send-automated-messages] template fetch failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let totalDashboard = 0;
  let totalEmails = 0;
  let totalFailed = 0;

  for (const tpl of due) {
    const audience: string = tpl.target_audience || "all";
    const automationKey: string | null = tpl.automation_key || null;

    // Build the recipient list from profiles + auth.users.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, notification_preferences");

    let authUsers: Array<{ id: string; email: string | null }> = [];
    let page = 1;
    while (true) {
      const { data, error: e } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (e || !data?.users?.length) break;
      authUsers.push(...data.users.map(u => ({ id: u.id, email: u.email ?? null })));
      if (data.users.length < 100) break;
      page++;
    }
    const emailMap = new Map(authUsers.map(u => [u.id, u.email]));

    // Premium / free filter
    let allowedIds: Set<string> | null = null;
    if (audience === "premium_users") {
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("status", "active")
        .in("plan_type", ["lifetime","premium","legacy_premium"]);
      allowedIds = new Set((subs ?? []).map((s: any) => s.user_id));
    } else if (audience === "free_users") {
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("status", "active")
        .in("plan_type", ["lifetime","premium","legacy_premium"]);
      const premium = new Set((subs ?? []).map((s: any) => s.user_id));
      allowedIds = new Set((profiles ?? []).filter(p => !premium.has(p.user_id)).map(p => p.user_id));
    }

    let sentDashboard = 0;
    let sentEmails = 0;
    let failed = 0;

    for (const profile of profiles ?? []) {
      if (allowedIds && !allowedIds.has(profile.user_id)) continue;
      const prefs = profile.notification_preferences as any;
      const name = profile.full_name || "Smarty";

      const dashboardSubject = tpl.dashboard_subject || tpl.subject;
      const dashboardContent = substitute(tpl.dashboard_content || tpl.content, name);
      const emailSubject = tpl.email_subject || tpl.subject;
      const emailContent = substitute(tpl.email_content || tpl.content, name);

      // Dashboard
      if (!automationKey || canSend(prefs, automationKey, "dashboard")) {
        const { error: e } = await supabase.from("user_system_messages").insert({
          user_id: profile.user_id,
          message_type: tpl.message_type,
          subject: dashboardSubject,
          content: dashboardContent,
          is_read: false,
        });
        if (e) failed++; else sentDashboard++;
      }

      // Email
      const recipient = emailMap.get(profile.user_id);
      if (resend && recipient && (!automationKey || canSend(prefs, automationKey, "email"))) {
        try {
          const result = await resend.emails.send({
            from: "SmartyGym <notifications@smartygym.com>",
            to: [recipient],
            subject: emailSubject,
            reply_to: "smartygym@outlook.com",
            html: htmlWrap(emailSubject, emailContent),
          });
          sentEmails++;
          await logEmailDelivery({
            userId: profile.user_id,
            toEmail: recipient,
            messageType: tpl.message_type,
            status: "sent",
            resendId: result?.data?.id ?? null,
          });
          await new Promise(r => setTimeout(r, 400));
        } catch (err) {
          failed++;
          await logEmailDelivery({
            userId: profile.user_id,
            toEmail: recipient,
            messageType: tpl.message_type,
            status: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    totalDashboard += sentDashboard;
    totalEmails += sentEmails;
    totalFailed += failed;

    // Advance schedule
    const nextRun = advanceNextRun(tpl.next_scheduled_time, tpl.recurrence_pattern);
    await supabase
      .from("automated_message_templates")
      .update({
        last_sent_at: nowIso,
        next_scheduled_time: nextRun,
        status: nextRun ? "active" : (tpl.recurrence_pattern === "once" ? "completed" : "active"),
      })
      .eq("id", tpl.id);

    await supabase.from("notification_audit_log").insert({
      notification_type: "automated",
      message_type: tpl.message_type,
      recipient_count: (profiles ?? []).length,
      success_count: sentDashboard + sentEmails,
      failed_count: failed,
      subject: tpl.subject,
      content: `Automated template "${tpl.template_name}" dispatched: ${sentDashboard} dashboard, ${sentEmails} emails`,
      sent_at: nowIso,
      metadata: { template_id: tpl.id, automation_key: automationKey, audience },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    processed: due.length,
    dashboard: totalDashboard,
    emails: totalEmails,
    failed: totalFailed,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});