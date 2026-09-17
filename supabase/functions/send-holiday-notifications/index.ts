import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cyprus timezone offset (EET = UTC+2, EEST = UTC+3)
function getCyprusDate(): Date {
  const now = new Date();
  const month = now.getUTCMonth();
  // DST in Cyprus: last Sunday of March to last Sunday of October
  const isDST = month >= 3 && month <= 9; // Simplified check
  const offsetHours = isDST ? 3 : 2;
  return new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
}

function getHolidayContent(holiday: 'new_year' | 'christmas'): { subject: string; message: string; emailHtml: string } {
  const currentYear = new Date().getFullYear();
  
  if (holiday === 'new_year') {
    return {
      subject: `🎊 Happy New Year from SmartyGym! Let's Make ${currentYear} Your Best Year Yet`,
      message: `🎊 Happy New Year!\n\nWishing you a wonderful ${currentYear} filled with health, strength, and personal growth!\n\nThis is your year to achieve your fitness goals. We're honored to be part of your journey. Let's make ${currentYear} your strongest, healthiest year yet!\n\n💪 Your SmartyGym Family`,
      emailHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #FF6B35; text-align: center;">🎊 Happy New Year!</h1>
          <p style="font-size: 16px; line-height: 1.6;">Dear SmartyGym Member,</p>
          <p style="font-size: 16px; line-height: 1.6;">Wishing you a wonderful <strong>${currentYear}</strong> filled with health, strength, and personal growth!</p>
          <p style="font-size: 16px; line-height: 1.6;">This is your year to achieve your fitness goals. We're honored to be part of your journey and can't wait to see what you accomplish.</p>
          <p style="font-size: 16px; line-height: 1.6;">Let's make ${currentYear} your strongest, healthiest year yet! 💪</p>
          <p style="font-size: 16px; line-height: 1.6; margin-top: 30px;">With gratitude,<br><strong>Your SmartyGym Family</strong></p>
        </div>
      `
    };
  } else {
    return {
      subject: `🎄 Merry Christmas from the SmartyGym Family!`,
      message: `🎄 Merry Christmas!\n\nWishing you and your loved ones a joyful and peaceful Christmas Day!\n\nTake time to relax, celebrate with family and friends, and enjoy this special day. Remember, rest is part of the journey too.\n\nThank you for being part of the SmartyGym family. We're grateful for you!\n\n🎁 Your SmartyGym Team`,
      emailHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #228B22; text-align: center;">🎄 Merry Christmas!</h1>
          <p style="font-size: 16px; line-height: 1.6;">Dear SmartyGym Member,</p>
          <p style="font-size: 16px; line-height: 1.6;">Wishing you and your loved ones a joyful and peaceful Christmas Day!</p>
          <p style="font-size: 16px; line-height: 1.6;">Take time to relax, celebrate with family and friends, and enjoy this special day. Remember, rest is part of the journey too.</p>
          <p style="font-size: 16px; line-height: 1.6;">Thank you for being part of the SmartyGym family. We're grateful for you! 🎁</p>
          <p style="font-size: 16px; line-height: 1.6; margin-top: 30px;">Warm wishes,<br><strong>Your SmartyGym Team</strong></p>
        </div>
      `
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-holiday-notifications");
  if (frozen) return frozen;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Determine which holiday (if any)
    const cyprusDate = getCyprusDate();
    const month = cyprusDate.getUTCMonth() + 1; // 1-12
    const day = cyprusDate.getUTCDate();

    console.log(`[Holiday Notifications] Checking date: ${day}/${month} (Cyprus time)`);

    let holiday: 'new_year' | 'christmas' | null = null;
    let messageType: string;

    if (month === 1 && day === 1) {
      holiday = 'new_year';
      messageType = 'new_year_wishes';
    } else if (month === 12 && day === 25) {
      holiday = 'christmas';
      messageType = 'christmas_wishes';
    } else {
      // Allow manual testing via request body
      const body = await req.json().catch(() => ({}));
      if (body.test_holiday === 'new_year') {
        holiday = 'new_year';
        messageType = 'new_year_wishes';
        console.log('[Holiday Notifications] Testing New Year notification');
      } else if (body.test_holiday === 'christmas') {
        holiday = 'christmas';
        messageType = 'christmas_wishes';
        console.log('[Holiday Notifications] Testing Christmas notification');
      } else {
        console.log('[Holiday Notifications] No holiday today');
        return new Response(
          JSON.stringify({ success: true, message: "No holiday today", date: `${day}/${month}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const content = getHolidayContent(holiday);
    const today = new Date().toISOString().split('T')[0];

    // Check for duplicate - already sent today
    const { data: existingAudit } = await supabase
      .from('notification_audit_log')
      .select('id')
      .eq('message_type', messageType)
      .gte('sent_at', `${today}T00:00:00Z`)
      .limit(1);

    if (existingAudit && existingAudit.length > 0) {
      console.log(`[Holiday Notifications] ${holiday} notification already sent today`);
      return new Response(
        JSON.stringify({ success: true, message: `${holiday} notification already sent today` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, full_name, notification_preferences');

    if (usersError) {
      console.error('[Holiday Notifications] Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`[Holiday Notifications] Found ${users?.length || 0} users`);

    let dashboardCount = 0;
    let emailCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const user of users || []) {
      try {
        const prefs = user.notification_preferences as Record<string, any> || {};
        
        // Skip if user has opted out of all notifications
        if (prefs.opt_out_all === true) {
          skippedCount++;
          continue;
        }

        // Send dashboard message
        const { error: msgError } = await supabase
          .from('user_system_messages')
          .insert({
            user_id: user.user_id,
            subject: content.subject.replace(/🎊|🎄/g, '').trim(),
            content: content.message,
            message_type: messageType,
            is_read: false
          });

        if (msgError) {
          console.error(`[Holiday Notifications] Dashboard error for ${user.user_id}:`, msgError);
          errors.push(`Dashboard: ${user.user_id}`);
        } else {
          dashboardCount++;
        }

        // Send email
        if (resend && prefs.opt_out_email !== true) {
          // Get user email from auth
          const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
          
          if (authUser?.user?.email) {
            try {
              const sendResult = await resend.emails.send({
                from: "SmartyGym <notifications@smartygym.com>",
                to: [authUser.user.email],
                subject: content.subject,
                html: content.emailHtml,
              });
              emailCount++;
              await logEmailDelivery({
                userId: user.user_id,
                toEmail: authUser.user.email,
                messageType: "holiday-notification",
                status: "sent",
                resendId: sendResult?.data?.id ?? null,
                metadata: { holiday },
              });
            } catch (emailErr) {
              console.error(`[Holiday Notifications] Email error for ${authUser.user.email}:`, emailErr);
              errors.push(`Email: ${authUser.user.email}`);
              await logEmailDelivery({
                userId: user.user_id,
                toEmail: authUser.user.email,
                messageType: "holiday-notification",
                status: "failed",
                errorMessage: emailErr instanceof Error ? emailErr.message : String(emailErr),
                metadata: { holiday },
              });
            }
          }
        }
      } catch (userError) {
        console.error(`[Holiday Notifications] Error processing user ${user.user_id}:`, userError);
        errors.push(`User: ${user.user_id}`);
      }
    }

    // Log to audit
    await supabase.from('notification_audit_log').insert({
      notification_type: 'dashboard_and_email',
      message_type: messageType,
      subject: content.subject,
      content: content.message,
      recipient_filter: 'all_users',
      recipient_count: users?.length || 0,
      success_count: dashboardCount + emailCount,
      failed_count: errors.length,
      metadata: { 
        holiday,
        dashboard_sent: dashboardCount, 
        emails_sent: emailCount, 
        skipped: skippedCount,
        errors: errors.slice(0, 10)
      }
    });

    console.log(`[Holiday Notifications] Complete - Dashboard: ${dashboardCount}, Emails: ${emailCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        holiday,
        dashboard_sent: dashboardCount,
        emails_sent: emailCount,
        skipped: skippedCount,
        errors: errors.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Holiday Notifications] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
