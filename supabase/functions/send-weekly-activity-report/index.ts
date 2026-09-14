import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function logStep(step: string, details?: any) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-WEEKLY-ACTIVITY-REPORT] ${step}${detailsStr}`);
}

interface UserActivityData {
  userId: string;
  email: string;
  fullName: string;
  workouts: { viewed: number; favorited: number; completed: number; rated: number };
  programs: { viewed: number; favorited: number; completed: number; rated: number; ongoing: number };
  checkins: { morning: number; night: number; total: number; avgScore: number };
  calculators: { oneRM: number; bmr: number; calories: number };
}

async function fetchUserActivity(supabase: any, userId: string, startDate: Date, endDate: Date): Promise<Omit<UserActivityData, 'userId' | 'email' | 'fullName'>> {
  // Fetch workout interactions
  const { data: workoutData } = await supabase
    .from("workout_interactions")
    .select("*")
    .eq("user_id", userId)
    .gte("updated_at", startDate.toISOString())
    .lte("updated_at", endDate.toISOString());

  const workouts = {
    viewed: workoutData?.filter((w: any) => w.has_viewed).length || 0,
    favorited: workoutData?.filter((w: any) => w.is_favorite).length || 0,
    completed: workoutData?.filter((w: any) => w.is_completed).length || 0,
    rated: workoutData?.filter((w: any) => w.rating && w.rating > 0).length || 0,
  };

  // Fetch program interactions
  const { data: programData } = await supabase
    .from("program_interactions")
    .select("*")
    .eq("user_id", userId)
    .gte("updated_at", startDate.toISOString())
    .lte("updated_at", endDate.toISOString());

  const programs = {
    viewed: programData?.filter((p: any) => p.has_viewed).length || 0,
    favorited: programData?.filter((p: any) => p.is_favorite).length || 0,
    completed: programData?.filter((p: any) => p.is_completed).length || 0,
    rated: programData?.filter((p: any) => p.rating && p.rating > 0).length || 0,
    ongoing: programData?.filter((p: any) => p.is_ongoing).length || 0,
  };

  // Fetch check-ins
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const { data: checkinData } = await supabase
    .from("smarty_checkins")
    .select("*")
    .eq("user_id", userId)
    .gte("checkin_date", startDateStr)
    .lte("checkin_date", endDateStr);

  const morningCount = checkinData?.filter((c: any) => c.morning_completed).length || 0;
  const nightCount = checkinData?.filter((c: any) => c.night_completed).length || 0;
  const scores = checkinData?.filter((c: any) => c.daily_smarty_score).map((c: any) => c.daily_smarty_score as number) || [];
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

  const checkins = {
    morning: morningCount,
    night: nightCount,
    total: morningCount + nightCount,
    avgScore,
  };

  // Fetch calculator usage
  const [oneRM, bmr, calories] = await Promise.all([
    supabase.from("onerm_history").select("id", { count: "exact" }).eq("user_id", userId)
      .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
    supabase.from("bmr_history").select("id", { count: "exact" }).eq("user_id", userId)
      .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
    supabase.from("calorie_history").select("id", { count: "exact" }).eq("user_id", userId)
      .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
  ]);

  const calculators = {
    oneRM: oneRM.count || 0,
    bmr: bmr.count || 0,
    calories: calories.count || 0,
  };

  return { workouts, programs, checkins, calculators };
}

function getMotivationalMessage(data: Omit<UserActivityData, 'userId' | 'email' | 'fullName'>): string {
  const totalWorkouts = data.workouts.completed;
  const totalPrograms = data.programs.completed;
  const totalCheckins = data.checkins.total;
  const avgScore = data.checkins.avgScore;

  if (totalWorkouts >= 7) {
    return `Outstanding week! You've crushed ${totalWorkouts} workouts. You're on fire! 🔥`;
  } else if (totalWorkouts >= 4) {
    return `Great progress! ${totalWorkouts} workouts completed. Keep up the momentum! 💪`;
  } else if (totalWorkouts >= 2) {
    return `Good start with ${totalWorkouts} workouts! Consistency is key - you're building great habits.`;
  } else if (totalCheckins >= 5) {
    return `You've completed ${totalCheckins} check-ins with an average score of ${avgScore}. Tracking is the first step to improvement!`;
  } else if (totalPrograms > 0) {
    return `You've completed ${totalPrograms} program${totalPrograms > 1 ? 's' : ''}. Structured training leads to lasting results!`;
  } else {
    return "Every journey starts with a single step. Start tracking your workouts this week and watch your progress grow!";
  }
}

function generateEmailHtml(data: UserActivityData, weekStart: string, weekEnd: string): string {
  const motivationalMessage = getMotivationalMessage(data);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Activity Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #29B6D2 0%, #1E9AB0 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">SmartyGym</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Your gym reimagined anywhere, anytime</p>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center;">
              <h2 style="color: #333333; margin: 0 0 10px 0; font-size: 24px;">📊 Your Weekly Activity Report</h2>
              <p style="color: #666666; margin: 0; font-size: 14px;">Week of ${weekStart} - ${weekEnd}</p>
              ${data.fullName ? `<p style="color: #666666; margin: 10px 0 0 0; font-size: 14px;">Hello, <strong>${data.fullName}</strong>!</p>` : ''}
            </td>
          </tr>

          <!-- Activity Summary -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <!-- Workouts -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #29B6D2; border-radius: 8px; margin-bottom: 15px; overflow: hidden;">
                <tr>
                  <td style="background-color: rgba(41, 182, 210, 0.1); padding: 12px 15px; border-bottom: 1px solid rgba(41, 182, 210, 0.3);">
                    <strong style="color: #333333;">💪 Smarty Workouts</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="25%" style="text-align: center; padding: 10px;">
                          <div style="color: #666666; font-size: 12px;">Viewed</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.workouts.viewed}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Favorited</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.workouts.favorited}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Completed</div>
                          <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${data.workouts.completed}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Rated</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.workouts.rated}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Programs -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #29B6D2; border-radius: 8px; margin-bottom: 15px; overflow: hidden;">
                <tr>
                  <td style="background-color: rgba(41, 182, 210, 0.1); padding: 12px 15px; border-bottom: 1px solid rgba(41, 182, 210, 0.3);">
                    <strong style="color: #333333;">📋 Smarty Programs</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="20%" style="text-align: center; padding: 10px;">
                          <div style="color: #666666; font-size: 12px;">Viewed</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.programs.viewed}</div>
                        </td>
                        <td width="20%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Favorited</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.programs.favorited}</div>
                        </td>
                        <td width="20%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Ongoing</div>
                          <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${data.programs.ongoing}</div>
                        </td>
                        <td width="20%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Completed</div>
                          <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${data.programs.completed}</div>
                        </td>
                        <td width="20%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Rated</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.programs.rated}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Check-ins -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #29B6D2; border-radius: 8px; margin-bottom: 15px; overflow: hidden;">
                <tr>
                  <td style="background-color: rgba(41, 182, 210, 0.1); padding: 12px 15px; border-bottom: 1px solid rgba(41, 182, 210, 0.3);">
                    <strong style="color: #333333;">✅ Smarty Check-ins</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="25%" style="text-align: center; padding: 10px;">
                          <div style="color: #666666; font-size: 12px;">Morning</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.checkins.morning}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Night</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.checkins.night}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Total</div>
                          <div style="font-size: 24px; font-weight: bold; color: #29B6D2;">${data.checkins.total}</div>
                        </td>
                        <td width="25%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Avg Score</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.checkins.avgScore}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Calculators -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #29B6D2; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: rgba(41, 182, 210, 0.1); padding: 12px 15px; border-bottom: 1px solid rgba(41, 182, 210, 0.3);">
                    <strong style="color: #333333;">🧮 Smarty Tools</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" style="text-align: center; padding: 10px;">
                          <div style="color: #666666; font-size: 12px;">1RM Calculations</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.calculators.oneRM}</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">BMR Calculations</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.calculators.bmr}</div>
                        </td>
                        <td width="34%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(41, 182, 210, 0.2);">
                          <div style="color: #666666; font-size: 12px;">Macro Calculations</div>
                          <div style="font-size: 24px; font-weight: bold; color: #333333;">${data.calculators.calories}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Motivational Message -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(41, 182, 210, 0.1) 0%, rgba(41, 182, 210, 0.05) 100%); border-radius: 8px; border: 1px solid rgba(41, 182, 210, 0.3);">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 5px 0; font-weight: bold; color: #333333;">📈 Your Progress Summary</p>
                    <p style="margin: 0; color: #666666;">${motivationalMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <a href="https://smartygym.com/userdashboard?tab=logbook" style="display: inline-block; background: linear-gradient(135deg, #29B6D2 0%, #1E9AB0 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Full Report in Dashboard</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; color: #29B6D2; font-weight: bold; font-size: 14px;">SmartyGym - Your gym reimagined anywhere, anytime</p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                <a href="https://smartygym.com/unsubscribe?email=${encodeURIComponent(data.email)}" style="color: #999999;">Unsubscribe</a> | 
                <a href="https://smartygym.com/privacy-policy" style="color: #999999;">Privacy Policy</a>
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

function generateDashboardMessage(data: UserActivityData, weekStart: string, weekEnd: string): string {
  const motivationalMessage = getMotivationalMessage(data);
  
  return `
<p class="tiptap-paragraph">Here's your weekly activity summary for ${weekStart} - ${weekEnd}:</p>

<p class="tiptap-paragraph"><strong>💪 Smarty Workouts:</strong> ${data.workouts.viewed} viewed, ${data.workouts.favorited} favorited, ${data.workouts.completed} completed, ${data.workouts.rated} rated</p>

<p class="tiptap-paragraph"><strong>📋 Smarty Programs:</strong> ${data.programs.viewed} viewed, ${data.programs.ongoing} ongoing, ${data.programs.completed} completed</p>

<p class="tiptap-paragraph"><strong>✅ Smarty Check-ins:</strong> ${data.checkins.total} total (${data.checkins.morning} morning, ${data.checkins.night} night), Avg Score: ${data.checkins.avgScore}</p>

<p class="tiptap-paragraph"><strong>🧮 Smarty Tools:</strong> ${data.calculators.oneRM} 1RM, ${data.calculators.bmr} BMR, ${data.calculators.calories} Macro calculations</p>

<p class="tiptap-paragraph"><strong>📈 Progress Summary:</strong> ${motivationalMessage}</p>

<p class="tiptap-paragraph"><a href="/userdashboard?tab=logbook" style="color: #D4AF37;">View your full activity report →</a></p>
  `.trim();
}

const handler = async (req: Request): Promise<Response> => {
  logStep("Starting weekly activity report generation");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-weekly-activity-report");
  if (frozen) return frozen;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate last week's date range (Monday to Sunday)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - 1); // Yesterday (Sunday)
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6); // 7 days ago (Monday)
    startDate.setHours(0, 0, 0, 0);

    const weekStart = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEnd = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    logStep(`Generating reports for week: ${weekStart} - ${weekEnd}`);

    // Paginate through ALL users (listUsers defaults to 50 per page)
    const allAuthUsers: any[] = [];
    let usersPage = 1;
    const usersPerPage = 100;
    while (true) {
      const { data: pageData, error: pageError } = await supabase.auth.admin.listUsers({ page: usersPage, perPage: usersPerPage });
      if (pageError) { logStep("Error fetching users", { error: pageError }); throw pageError; }
      if (!pageData?.users?.length) break;
      allAuthUsers.push(...pageData.users);
      if (pageData.users.length < usersPerPage) break;
      usersPage++;
    }

    const users = allAuthUsers;
    logStep(`Found ${users.length} total users`);

    let successCount = 0;
    let failCount = 0;
    let dashboardSent = 0;
    let emailsSent = 0;
    let skippedNoActivity = 0;
    let skippedPrefs = 0;

    for (const user of users) {
      if (!user.email) continue;

      try {
        // Get user profile with preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, notification_preferences")
          .eq("user_id", user.id)
          .single();

        const prefs = (profile?.notification_preferences as Record<string, any>) || {};

        // Check if user has opted out of all notifications
        if (prefs.opt_out_all === true) {
          logStep(`Skipping ${user.email} - opted out of all notifications`);
          skippedPrefs++;
          continue;
        }

        // Fetch user activity
        const activity = await fetchUserActivity(supabase, user.id, startDate, endDate);

        // Skip if user has no activity at all
        const hasActivity = 
          activity.workouts.viewed > 0 || 
          activity.workouts.completed > 0 ||
          activity.programs.viewed > 0 ||
          activity.programs.completed > 0 ||
          activity.checkins.total > 0 ||
          activity.calculators.oneRM > 0 ||
          activity.calculators.bmr > 0 ||
          activity.calculators.calories > 0;

        if (!hasActivity) {
          logStep(`Skipping ${user.email} - no activity`);
          skippedNoActivity++;
          continue;
        }

        const userData: UserActivityData = {
          userId: user.id,
          email: user.email,
          fullName: profile?.full_name || '',
          ...activity,
        };

        const subject = `📊 Your Weekly Activity Report (${weekStart} - ${weekEnd})`;

        const { canSend } = await import("../_shared/notification-preferences.ts");

        // Check dashboard preference (default: true)
        if (canSend(prefs, "weekly_activity_report", "dashboard")) {
          const dashboardContent = generateDashboardMessage(userData, weekStart, weekEnd);
          
          const { error: messageError } = await supabase
            .from("user_system_messages")
            .insert({
              user_id: user.id,
              message_type: MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT,
              subject: subject,
              content: dashboardContent,
              is_read: false,
            });

          if (messageError) {
            logStep(`Dashboard message error for ${user.email}`, { error: messageError });
          } else {
            dashboardSent++;
          }
        }

        // Check email preference (default: true)
        if (canSend(prefs, "weekly_activity_report", "email")) {
          const emailHtml = generateEmailHtml(userData, weekStart, weekEnd);
          
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "SmartyGym <notifications@smartygym.com>",
              to: [user.email],
              subject: `📊 Your Weekly Activity Report - SmartyGym`,
              html: emailHtml,
              headers: {
                "List-Unsubscribe": `<https://smartygym.com/unsubscribe?email=${encodeURIComponent(user.email)}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                "Reply-To": "smartygym@outlook.com",
              },
            }),
          });

          if (!emailResponse.ok) {
            const errorData = await emailResponse.text();
            logStep(`Email error for ${user.email}`, { error: errorData });
            failCount++;
          } else {
            emailsSent++;
          }
        }

        successCount++;
        logStep(`Report sent to ${user.email}`);

        // Rate limiting: 600ms between emails
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (userError) {
        logStep(`Error processing user ${user.email}`, { error: userError });
        failCount++;
      }
    }

    // Log to audit (capture errors so silent failures become visible)
    const { error: auditError } = await supabase.from('notification_audit_log').insert({
      notification_type: MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT,
      message_type: MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT,
      recipient_count: users.length,
      success_count: successCount,
      failed_count: failCount,
      subject: `📊 Your Weekly Activity Report`,
      content: `Weekly activity report sent - ${emailsSent} emails, ${dashboardSent} dashboard messages`,
      metadata: {
        period: `${weekStart} - ${weekEnd}`,
        emailsSent,
        dashboardSent,
        skippedNoActivity,
        skippedPrefs,
      }
    });
    if (auditError) {
      logStep("⚠️ Audit insert failed", { error: auditError.message, code: auditError.code });
    }

    logStep(`Weekly reports completed`, { 
      successCount, 
      failCount, 
      dashboardSent, 
      emailsSent, 
      skippedNoActivity, 
      skippedPrefs 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} weekly reports, ${failCount} failed`,
        period: `${weekStart} - ${weekEnd}`,
        dashboardSent,
        emailsSent,
        skippedNoActivity,
        skippedPrefs,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    logStep("Weekly report error", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
