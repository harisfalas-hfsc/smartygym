import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { canSend, AutomationKey } from "../_shared/notification-preferences.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NEW-CONTENT-NOTIFICATIONS] ${step}${detailsStr}`);
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string, messageType: string = "new-content", userId?: string): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    const sendResult = await resend.emails.send({
      from: "SmartyGym <notifications@smartygym.com>",
      to: [to],
      subject,
      headers: getEmailHeaders(to),
      html: html.replace('</body>', `${getEmailFooter(to)}</body>`),
    });
    await logEmailDelivery({
      userId: userId ?? null,
      toEmail: to,
      messageType,
      status: "sent",
      resendId: (sendResult as any)?.data?.id ?? null,
    });
    return { success: true };
  } catch (error: any) {
    await logEmailDelivery({
      userId: userId ?? null,
      toEmail: to,
      messageType,
      status: "failed",
      errorMessage: error?.message || String(error),
    });
    return { success: false, error: error.message || String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-new-content-notifications");
  if (frozen) return frozen;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep("🚀 Starting new content notification processing");

    // Get pending notifications older than 5 minutes (buffered)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    logStep("📅 Looking for items older than", { fiveMinutesAgo });
    
    const { data: pendingItems, error: fetchError } = await supabase
      .from("pending_content_notifications")
      .select("*")
      .lt("created_at", fiveMinutesAgo);

    if (fetchError) {
      logStep("❌ Error fetching pending notifications", { error: fetchError.message });
      throw new Error(`Failed to fetch pending notifications: ${fetchError.message}`);
    }

    if (!pendingItems || pendingItems.length === 0) {
      logStep("📭 No pending content notifications to process");
      return new Response(JSON.stringify({ success: true, message: "No pending notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("📦 Found pending items", { count: pendingItems.length, items: pendingItems.map(i => ({ type: i.content_type, name: i.content_name })) });

    // Group by content type
    const workouts = pendingItems.filter(item => item.content_type === 'workout');
    const programs = pendingItems.filter(item => item.content_type === 'program');
    const articles = pendingItems.filter(item => item.content_type === 'article');

    const workoutCount = workouts.length;
    const programCount = programs.length;
    const articleCount = articles.length;

    logStep("📊 Content breakdown", { workoutCount, programCount, articleCount });

    // Paginate through ALL users (listUsers defaults to 50 per page)
    logStep("🔍 Fetching all users with preferences");
    const allAuthUsers: any[] = [];
    let usersPage = 1;
    const usersPerPage = 100;
    while (true) {
      const { data: pageData, error: pageError } = await supabase.auth.admin.listUsers({ page: usersPage, perPage: usersPerPage });
      if (pageError) { logStep("❌ Error fetching users", { error: pageError.message }); throw new Error(`Failed to fetch users: ${pageError.message}`); }
      if (!pageData?.users?.length) break;
      allAuthUsers.push(...pageData.users);
      if (pageData.users.length < usersPerPage) break;
      usersPage++;
    }

    const users = allAuthUsers;
    
    // Get all user preferences from profiles
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id, notification_preferences');
    
    const prefsMap = new Map(allProfiles?.map(p => [p.user_id, p.notification_preferences as Record<string, any>]) || []);
    
    logStep("👥 Found users to notify", { count: users.length });

    // Track statistics
    let dashboardSuccess = 0;
    let emailSuccess = 0;
    let dashboardFailed = 0;
    let dashboardSkipped = 0;
    let emailFailed = 0;
    let emailSkipped = 0;
    const emailErrors: { email: string; error: string }[] = [];
    const dashboardErrors: { user_id: string; error: string }[] = [];

    // Handle articles
    if (articleCount > 0) {
      const articleSubject = articleCount === 1 
        ? `📖 New Article: ${articles[0].content_name}`
        : `📖 ${articleCount} New Articles on SmartyGym!`;
      
      const articleDashboardContent = articleCount === 1
        ? `
          <p class="tiptap-paragraph">A new article has been published on the SmartyGym blog!</p>
          <p class="tiptap-paragraph"><strong>${articles[0].content_name}</strong></p>
          <p class="tiptap-paragraph">Expert insights on fitness, nutrition, and athletic performance.</p>
          <p class="tiptap-paragraph"><a href="/blog" style="color: #29B6D2; text-decoration: underline;">Read Article →</a></p>
        `
        : `
          <p class="tiptap-paragraph">${articleCount} new articles have been published on the SmartyGym blog!</p>
          <p class="tiptap-paragraph">Expert insights on fitness, nutrition, and athletic performance.</p>
          <p class="tiptap-paragraph"><a href="/blog" style="color: #29B6D2; text-decoration: underline;">Browse Articles →</a></p>
        `;
      
      const articleEmailHtml = buildEmailHtml(
        articleCount === 1 ? "New Article Published!" : `${articleCount} New Articles Published!`,
        articleCount === 1
          ? `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;">A new article has been published on the SmartyGym blog!</p>
            <p style="font-size: 18px; font-weight: bold; color: #29B6D2; margin-bottom: 15px;">${articles[0].content_name}</p>
            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Expert insights on fitness, nutrition, and athletic performance.</p>`
          : `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;"><strong>${articleCount} new articles</strong> have been published on the SmartyGym blog!</p>
            <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Expert insights on fitness, nutrition, and athletic performance.</p>`,
        [{ text: "Read Articles", url: "https://smartygym.com/blog" }]
      );

      // Send article notifications to users
      for (const user of users) {
        const prefs = prefsMap.get(user.id) || {};
        
        if (prefs.opt_out_all === true) {
          dashboardSkipped++;
          emailSkipped++;
          continue;
        }

        // Check dashboard_new_article preference (default true)
        if (canSend(prefs, "new_article", "dashboard")) {
          const { error: msgError } = await supabase.from("user_system_messages").insert({
            user_id: user.id,
            message_type: MESSAGE_TYPES.NEW_ARTICLE,
            subject: articleSubject,
            content: articleDashboardContent,
            is_read: false,
          });
          if (msgError) {
            dashboardFailed++;
            dashboardErrors.push({ user_id: user.id, error: msgError.message });
            logStep("❌ Article dashboard insert failed", { userId: user.id, error: msgError.message, code: msgError.code });
          } else {
            dashboardSuccess++;
          }
        } else {
          dashboardSkipped++;
        }

        // Check email_new_article preference (default true)
        if (user.email && canSend(prefs, "new_article", "email")) {
          const result = await sendEmail(user.email, articleSubject, articleEmailHtml);
          if (result.success) {
            emailSuccess++;
            await new Promise(resolve => setTimeout(resolve, 600));
          } else {
            emailFailed++;
            emailErrors.push({ email: user.email, error: result.error || "Unknown error" });
          }
        } else {
          emailSkipped++;
        }
      }

      logStep("📰 Article notifications sent", { articleCount, dashboardSuccess, emailSuccess });
    }

    // NOTE: WOD-only notifications are NOT handled here. The combined
    // morning notification (`send-morning-notifications`, 07:00 Cyprus)
    // delivers the Workout of the Day and the Daily Smarty Ritual together
    // in a single email + dashboard message. Any pending rows with
    // content_type='wod' are ignored to prevent duplicate user-facing emails.

    // Build notification content for workouts/programs
    let subject = "";
    let dashboardContent = "";
    let emailHtml = "";
    let messageType: string = MESSAGE_TYPES.CONTENT_UPDATE;

    if (workoutCount > 0 && programCount > 0) {
      // Mixed content
      subject = `🆕 New Content Added to SmartyGym!`;
      messageType = MESSAGE_TYPES.CONTENT_UPDATE;
      
      const workoutText = workoutCount === 1 
        ? `1 new workout` 
        : `${workoutCount} new workouts`;
      const programText = programCount === 1 
        ? `1 new training program` 
        : `${programCount} new training programs`;

      dashboardContent = `
        <p class="tiptap-paragraph">Great news! We've just added ${workoutText} and ${programText} to the SmartyGym library.</p>
        <p class="tiptap-paragraph">Explore our expanded collection of expert-designed content by Sports Scientist Haris Falas and take your training to the next level.</p>
        <p class="tiptap-paragraph"><a href="/workout" style="color: #29B6D2; text-decoration: underline;">Browse Workouts →</a></p>
        <p class="tiptap-paragraph"><a href="/trainingprogram" style="color: #29B6D2; text-decoration: underline;">Browse Training Programs →</a></p>
      `;

      emailHtml = buildEmailHtml(
        "New Content Added!",
        `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;">Great news! We've just added <strong>${workoutText}</strong> and <strong>${programText}</strong> to the SmartyGym library.</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Explore our expanded collection of expert-designed content by Sports Scientist Haris Falas and take your training to the next level.</p>`,
        [
          { text: "Browse Workouts", url: "https://smartygym.com/workout" },
          { text: "Browse Programs", url: "https://smartygym.com/trainingprogram" }
        ]
      );
    } else if (workoutCount > 0) {
      // Only workouts
      messageType = MESSAGE_TYPES.NEW_WORKOUT;
      
      if (workoutCount === 1) {
        const workout = workouts[0];
        subject = `🏋️ New Workout: ${workout.content_name}`;
        dashboardContent = `
          <p class="tiptap-paragraph">A new workout has been added to the SmartyGym library!</p>
          <p class="tiptap-paragraph"><strong>${workout.content_name}</strong>${workout.content_category ? ` in ${workout.content_category}` : ''}</p>
          <p class="tiptap-paragraph">Designed by Sports Scientist Haris Falas to help you achieve your fitness goals.</p>
          <p class="tiptap-paragraph"><a href="/workout" style="color: #29B6D2; text-decoration: underline;">View Workout →</a></p>
        `;
        emailHtml = buildEmailHtml(
          "New Workout Added!",
          `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;">A new workout has been added to the SmartyGym library!</p>
          <p style="font-size: 18px; font-weight: bold; color: #29B6D2; margin-bottom: 15px;">${workout.content_name}</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Designed by Sports Scientist Haris Falas to help you achieve your fitness goals.</p>`,
          [{ text: "View Workout", url: "https://smartygym.com/workout" }]
        );
      } else {
        subject = `🏋️ ${workoutCount} New Workouts Added!`;
        const categories = [...new Set(workouts.map(w => w.content_category).filter(Boolean))];
        const categoryText = categories.length > 0 ? ` across ${categories.join(', ')}` : '';
        
        dashboardContent = `
          <p class="tiptap-paragraph">${workoutCount} new workouts have been added to the SmartyGym library${categoryText}!</p>
          <p class="tiptap-paragraph">Expand your training options with our latest expert-designed workouts by Sports Scientist Haris Falas.</p>
          <p class="tiptap-paragraph"><a href="/workout" style="color: #29B6D2; text-decoration: underline;">Browse All Workouts →</a></p>
        `;
        emailHtml = buildEmailHtml(
          `${workoutCount} New Workouts Added!`,
          `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;"><strong>${workoutCount} new workouts</strong> have been added to the SmartyGym library${categoryText}!</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Expand your training options with our latest expert-designed workouts by Sports Scientist Haris Falas.</p>`,
          [{ text: "Browse All Workouts", url: "https://smartygym.com/workout" }]
        );
      }
    } else if (programCount > 0) {
      // Only programs
      messageType = MESSAGE_TYPES.NEW_PROGRAM;
      
      if (programCount === 1) {
        const program = programs[0];
        subject = `📚 New Training Program: ${program.content_name}`;
        dashboardContent = `
          <p class="tiptap-paragraph">A new training program has been added to the SmartyGym library!</p>
          <p class="tiptap-paragraph"><strong>${program.content_name}</strong>${program.content_category ? ` in ${program.content_category}` : ''}</p>
          <p class="tiptap-paragraph">Structured programming by Sports Scientist Haris Falas for maximum results.</p>
          <p class="tiptap-paragraph"><a href="/trainingprogram" style="color: #29B6D2; text-decoration: underline;">View Program →</a></p>
        `;
        emailHtml = buildEmailHtml(
          "New Training Program Added!",
          `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;">A new training program has been added to the SmartyGym library!</p>
          <p style="font-size: 18px; font-weight: bold; color: #29B6D2; margin-bottom: 15px;">${program.content_name}</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Structured programming by Sports Scientist Haris Falas for maximum results.</p>`,
          [{ text: "View Program", url: "https://smartygym.com/trainingprogram" }]
        );
      } else {
        subject = `📚 ${programCount} New Training Programs Added!`;
        const categories = [...new Set(programs.map(p => p.content_category).filter(Boolean))];
        const categoryText = categories.length > 0 ? ` across ${categories.join(', ')}` : '';
        
        dashboardContent = `
          <p class="tiptap-paragraph">${programCount} new training programs have been added to the SmartyGym library${categoryText}!</p>
          <p class="tiptap-paragraph">Transform your fitness with our latest structured programs by Sports Scientist Haris Falas.</p>
          <p class="tiptap-paragraph"><a href="/trainingprogram" style="color: #29B6D2; text-decoration: underline;">Browse All Programs →</a></p>
        `;
        emailHtml = buildEmailHtml(
          `${programCount} New Training Programs Added!`,
          `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;"><strong>${programCount} new training programs</strong> have been added to the SmartyGym library${categoryText}!</p>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Transform your fitness with our latest structured programs by Sports Scientist Haris Falas.</p>`,
          [{ text: "Browse All Programs", url: "https://smartygym.com/trainingprogram" }]
        );
      }
    }

    // Send workout/program notifications if there are any
    if (workoutCount > 0 || programCount > 0) {
      // Determine relevant automation keys
      const automationKeys: AutomationKey[] =
        workoutCount > 0 && programCount > 0
          ? ["new_workout", "new_program"]
          : workoutCount > 0
            ? ["new_workout"]
            : ["new_program"];

      // Send notifications to all users
      for (const user of users) {
        const prefs = prefsMap.get(user.id) || {};
        
        // Check if user has opted out of all notifications
        if (prefs.opt_out_all === true) {
          logStep("⏭️ User opted out of all notifications", { userId: user.id });
          dashboardSkipped++;
          emailSkipped++;
          continue;
        }

        // Check dashboard preferences - if ANY of the relevant prefs are enabled (default true)
        const dashboardEnabled = automationKeys.some((k) => canSend(prefs, k, "dashboard"));
        
        if (dashboardEnabled) {
          const { error: msgError } = await supabase
            .from("user_system_messages")
            .insert({
              user_id: user.id,
              message_type: messageType,
              subject: subject,
              content: dashboardContent,
              is_read: false,
            });

          if (msgError) {
            logStep("❌ Dashboard message failed", { userId: user.id, error: msgError.message, code: msgError.code });
            dashboardFailed++;
            dashboardErrors.push({ user_id: user.id, error: msgError.message });
          } else {
            dashboardSuccess++;
          }
        } else {
            logStep("⏭️ Dashboard disabled for user", { userId: user.id });
          dashboardSkipped++;
        }

        // Check email preferences
        if (user.email) {
          const emailEnabled = automationKeys.some((k) => canSend(prefs, k, "email"));

          if (emailEnabled) {
            const result = await sendEmail(user.email, subject, emailHtml);
            if (result.success) {
              emailSuccess++;
              // Rate limiting: 600ms delay to respect Resend's 2 requests/second limit
              await new Promise(resolve => setTimeout(resolve, 600));
            } else {
              emailFailed++;
              emailErrors.push({ email: user.email, error: result.error || "Unknown error" });
              logStep("❌ Email failed", { email: user.email, error: result.error });
            }
          } else {
            logStep("⏭️ Email disabled for user", { userId: user.id });
            emailSkipped++;
          }
        }
      }
    }

    // Delete processed pending notifications
    const idsToDelete = pendingItems.map(item => item.id);
    logStep("🗑️ Deleting processed items", { count: idsToDelete.length });
    
    const { error: deleteError } = await supabase
      .from("pending_content_notifications")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      logStep("⚠️ Warning: Failed to delete processed items", { error: deleteError.message });
    }

    // Log to audit
    logStep("📝 Logging to audit");
    await supabase.from("notification_audit_log").insert({
      notification_type: "automated",
      message_type: messageType || MESSAGE_TYPES.CONTENT_UPDATE,
      subject: subject || `Content notification (${articleCount} articles)`,
      content: dashboardContent || "Article notifications sent",
      recipient_count: users.length,
      success_count: dashboardSuccess + emailSuccess,
      failed_count: dashboardFailed + emailFailed,
      metadata: {
        workouts_count: workoutCount,
        programs_count: programCount,
        articles_count: articleCount,
        dashboard_success: dashboardSuccess,
        dashboard_failed: dashboardFailed,
        dashboard_skipped: dashboardSkipped,
        email_success: emailSuccess,
        email_failed: emailFailed,
        email_skipped: emailSkipped,
        email_errors: emailErrors.length > 0 ? emailErrors.slice(0, 10) : undefined,
        dashboard_errors: dashboardErrors.length > 0 ? dashboardErrors.slice(0, 10) : undefined,
      },
    });

    logStep("🎉 Completed notification processing", {
      totalUsers: users.length,
      dashboardSuccess,
      dashboardFailed,
      dashboardSkipped,
      emailSuccess,
      emailFailed,
      emailSkipped
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingItems.length,
        workouts: workoutCount,
        programs: programCount,
        articles: articleCount,
        dashboardSent: dashboardSuccess,
        dashboardFailed,
        dashboardSkipped,
        emailsSent: emailSuccess,
        emailsFailed: emailFailed,
        emailsSkipped: emailSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("💥 FATAL ERROR", { error: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEmailHtml(
  title: string,
  bodyContent: string,
  buttons: { text: string; url: string }[]
): string {
  const buttonHtml = buttons
    .map(
      (btn) => `
      <a href="${btn.url}" style="display: inline-block; background: linear-gradient(135deg, #29B6D2, #5CD3E8); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 10px; margin-bottom: 10px;">${btn.text}</a>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #29B6D2; margin: 0; font-size: 28px; font-weight: bold;">SmartyGym</h1>
                  <p style="color: #888888; margin: 5px 0 0 0; font-size: 14px;">Train Smarter, Live Stronger</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">${title}</h2>
                  ${bodyContent}
                  <div style="text-align: center; margin-top: 30px;">
                    ${buttonHtml}
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #888888; margin: 0; font-size: 12px;">
                    You're receiving this email because you're subscribed to SmartyGym notifications.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
