import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapInEmailTemplateWithFooter, getEmailHeaders } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-WEEKLY-MOTIVATION] ${step}${detailsStr}`);
};

// Calculate progress towards a goal
const calculateProgress = (current: number | undefined, target: number | null, isDecrease: boolean = false): number | null => {
  if (!current || !target) return null;
  if (isDecrease) {
    const diff = current - target;
    if (diff <= 0) return 100;
    const startingPoint = target + 10;
    return Math.max(0, Math.min(100, ((startingPoint - current) / (startingPoint - target)) * 100));
  } else {
    if (current >= target) return 100;
    const startingPoint = target - 10;
    return Math.max(0, Math.min(100, ((current - startingPoint) / (target - startingPoint)) * 100));
  }
};

// Get days remaining until target date
const getDaysRemaining = (targetDate: string | null): number | null => {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const today = new Date();
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getEmailErrorMessage = (error: any): string => {
  if (!error) return "Unknown email error";
  if (typeof error === "string") return error;
  return error.message || error.error?.message || JSON.stringify(error);
};

const isTransientEmailError = (message: string) =>
  /Unexpected token '<'|<!DOCTYPE|rate|too many|429|quota|timeout|network|5\d\d|temporar/i.test(message);

const sendEmailWithRetry = async (
  sendOnce: () => Promise<any>,
  context: { userId: string; email: string },
) => {
  let lastResult: any = null;
  let lastError: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await sendOnce();
      lastResult = result;
      const apiErrorMessage = getEmailErrorMessage(result?.error);
      if (!result?.error) return result;
      if (!isTransientEmailError(apiErrorMessage) || attempt === 3) return result;
      logStep("Transient email API error, retrying", { ...context, attempt, error: apiErrorMessage });
    } catch (error: any) {
      lastError = error;
      const errorMessage = getEmailErrorMessage(error);
      if (!isTransientEmailError(errorMessage) || attempt === 3) throw error;
      logStep("Transient email send error, retrying", { ...context, attempt, error: errorMessage });
    }

    await delay(3000 * attempt);
  }

  if (lastError) throw lastError;
  return lastResult;
};

// Generate personalized content based on user's goals
const generatePersonalizedContent = (
  userName: string,
  hasGoals: boolean,
  goals: any,
  latestMeasurement: any,
  templateContent: string
): { content: string; ctaUrl: string; ctaText: string } => {
  const greeting = userName ? `Hi ${userName}!` : "Hi Smarty!";
  const baseUrl = "https://smartygym.com";
  
  if (!hasGoals) {
    // User has NO goals set
    return {
      content: `
        <p class="tiptap-paragraph">${greeting}</p>
        <p class="tiptap-paragraph">&nbsp;</p>
        <h3><strong>💪 Don't Forget to Set Your Goals!</strong></h3>
        <p class="tiptap-paragraph">&nbsp;</p>
        <p class="tiptap-paragraph">Setting clear fitness goals helps keep you motivated and on track. Let us help you achieve your dream physique!</p>
        <p class="tiptap-paragraph">&nbsp;</p>
        <p class="tiptap-paragraph">Define your targets for weight, body fat, or muscle mass, and we'll track your progress every step of the way. When you reach your goals, we'll celebrate together! 🎉</p>
        <p class="tiptap-paragraph">&nbsp;</p>
        <p class="tiptap-paragraph">Start your journey today and watch yourself transform!</p>
      `,
      ctaUrl: `${baseUrl}/calculator-history?tab=measurements`,
      ctaText: "Set Your Goals Now"
    };
  }

  // User HAS goals set - generate progress report
  const progressItems: string[] = [];
  const daysRemaining = getDaysRemaining(goals.target_date);
  
  // Weight goal
  if (goals.target_weight) {
    const currentWeight = latestMeasurement?.weight;
    const isDecrease = currentWeight ? currentWeight > goals.target_weight : false;
    const progress = calculateProgress(currentWeight, goals.target_weight, isDecrease);
    const progressText = progress !== null ? `${Math.round(progress)}% complete` : "No measurements yet";
    const currentText = currentWeight ? `${currentWeight} kg` : "Not measured";
    progressItems.push(`<li class="tiptap-list-item"><p class="tiptap-paragraph">🎯 <strong>Weight:</strong> ${currentText} → ${goals.target_weight} kg (${progressText})</p></li>`);
  }
  
  // Body fat goal
  if (goals.target_body_fat) {
    const currentBodyFat = latestMeasurement?.body_fat;
    const progress = calculateProgress(currentBodyFat, goals.target_body_fat, true); // Usually want to decrease
    const progressText = progress !== null ? `${Math.round(progress)}% complete` : "No measurements yet";
    const currentText = currentBodyFat ? `${currentBodyFat}%` : "Not measured";
    progressItems.push(`<li class="tiptap-list-item"><p class="tiptap-paragraph">🎯 <strong>Body Fat:</strong> ${currentText} → ${goals.target_body_fat}% (${progressText})</p></li>`);
  }
  
  // Muscle mass goal
  if (goals.target_muscle_mass) {
    const currentMuscleMass = latestMeasurement?.muscle_mass;
    const progress = calculateProgress(currentMuscleMass, goals.target_muscle_mass, false); // Want to increase
    const progressText = progress !== null ? `${Math.round(progress)}% complete` : "No measurements yet";
    const currentText = currentMuscleMass ? `${currentMuscleMass} kg` : "Not measured";
    progressItems.push(`<li class="tiptap-list-item"><p class="tiptap-paragraph">🎯 <strong>Muscle Mass:</strong> ${currentText} → ${goals.target_muscle_mass} kg (${progressText})</p></li>`);
  }

  const daysText = daysRemaining !== null 
    ? `<p class="tiptap-paragraph">📅 <strong>${daysRemaining} days remaining</strong> until your target date!</p>`
    : "";

  const progressList = progressItems.length > 0 
    ? `<ul class="tiptap-bullet-list">${progressItems.join("")}</ul>`
    : `<p class="tiptap-paragraph">You've set goals but haven't logged any measurements yet. Start tracking to see your progress!</p>`;

  return {
    content: `
      <p class="tiptap-paragraph">${greeting}</p>
      <p class="tiptap-paragraph">&nbsp;</p>
      <h3><strong>📊 Your Weekly Goal Progress</strong></h3>
      <p class="tiptap-paragraph">&nbsp;</p>
      <p class="tiptap-paragraph">Here's how you're doing on your fitness journey:</p>
      <p class="tiptap-paragraph">&nbsp;</p>
      ${progressList}
      <p class="tiptap-paragraph">&nbsp;</p>
      ${daysText}
      <p class="tiptap-paragraph">&nbsp;</p>
      <p class="tiptap-paragraph">Keep pushing, Smarty! Every workout brings you closer to your goals. 💪</p>
    `,
    ctaUrl: `${baseUrl}/calculator-history?tab=measurements`,
    ctaText: "View Your Progress"
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-weekly-motivation");
  if (frozen) return frozen;

  try {
    logStep("Function invoked - starting Monday motivational messages with personalized goals");
    logStep("Current time", { now: new Date().toISOString(), dayOfWeek: new Date().getDay() });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get automation rule configuration
    logStep("Fetching automation rule for monday_motivation");
    const { data: automationRule, error: ruleError } = await supabaseAdmin
      .from("automation_rules")
      .select("*")
      .eq("automation_key", "monday_motivation")
      .eq("is_active", true)
      .single();

    if (ruleError) {
      logStep("Error fetching automation rule", { error: ruleError.message });
    }

    if (!automationRule) {
      logStep("Monday motivation automation is disabled or not found");
      return new Response(
        JSON.stringify({ success: false, reason: "Automation disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Automation rule found", { 
      id: automationRule.id,
      sendsDashboard: automationRule.sends_dashboard_message, 
      sendsEmail: automationRule.sends_email,
      lastTriggered: automationRule.last_triggered_at,
      totalExecutions: automationRule.total_executions
    });

    // Get the motivational template (fallback only)
    logStep("Fetching motivational_weekly template for fallback");
    const { data: template, error: templateError } = await supabaseAdmin
      .from("automated_message_templates")
      .select("subject, content")
      .eq("message_type", "motivational_weekly")
      .eq("is_active", true)
      .single();

    if (templateError) {
      logStep("Error fetching template", { error: templateError.message });
    }

    // Use a default subject if no template
    const defaultSubject = "💪 Your Monday Motivation & Goal Progress";

    // Get ALL users
    logStep("Fetching all users");
    const { data: users, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name");

    if (usersError) {
      logStep("Error fetching users", { error: usersError.message });
      throw usersError;
    }

    logStep("Found users", { count: users?.length || 0 });

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users to send messages to" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let dashboardSent = 0;
    let emailsSent = 0;
    let skipped = 0;
    let failed = 0;
    let usersWithGoals = 0;
    let usersWithoutGoals = 0;
    const emailErrors: string[] = [];

    // Check for duplicates - don't send if already sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    logStep("Checking for messages already sent today", { todayStart: today.toISOString() });
    
    const { data: existingMessages, error: existingError } = await supabaseAdmin
      .from('user_system_messages')
      .select('user_id')
      .eq('message_type', MESSAGE_TYPES.MONDAY_MOTIVATION)
      .gte('created_at', today.toISOString());

    if (existingError) {
      logStep("Error checking existing messages", { error: existingError.message });
    }

    const alreadySentUserIds = new Set(existingMessages?.map(m => m.user_id) || []);
    logStep("Already sent today", { count: alreadySentUserIds.size });

    // Initialize Resend if sending emails
    let resend: Resend | null = null;
    if (automationRule.sends_email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        logStep("RESEND_API_KEY not configured - emails will not be sent");
      } else {
        resend = new Resend(resendApiKey);
      }
    }

    for (const user of users) {
      // Skip if already sent today
      if (alreadySentUserIds.has(user.user_id)) {
        skipped++;
        continue;
      }

      try {
        // Fetch user's goals
        const { data: userGoals, error: goalsError } = await supabaseAdmin
          .from("user_measurement_goals")
          .select("target_weight, target_body_fat, target_muscle_mass, target_date")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (goalsError) {
          logStep("Error fetching user goals", { userId: user.user_id, error: goalsError.message });
        }

        // Fetch latest measurement from user_activity_log
        const { data: latestActivity, error: activityError } = await supabaseAdmin
          .from("user_activity_log")
          .select("tool_result")
          .eq("user_id", user.user_id)
          .eq("content_type", "measurement")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activityError) {
          logStep("Error fetching latest measurement", { userId: user.user_id, error: activityError.message });
        }

        // Parse the latest measurement from tool_result
        let latestMeasurement: any = null;
        if (latestActivity?.tool_result) {
          const toolResult = latestActivity.tool_result as any;
          latestMeasurement = {
            weight: toolResult.weight,
            body_fat: toolResult.bodyFat || toolResult.body_fat,
            muscle_mass: toolResult.muscleMass || toolResult.muscle_mass
          };
        }

        // Determine if user has any goals set
        const hasGoals = userGoals && (
          userGoals.target_weight || 
          userGoals.target_body_fat || 
          userGoals.target_muscle_mass
        );

        if (hasGoals) {
          usersWithGoals++;
        } else {
          usersWithoutGoals++;
        }

        // Generate personalized content
        const { content, ctaUrl, ctaText } = generatePersonalizedContent(
          user.full_name || "",
          !!hasGoals,
          userGoals,
          latestMeasurement,
          template?.content || ""
        );

        const subject = hasGoals 
          ? "📊 Your Monday Goal Progress Report" 
          : "💪 Set Your Goals & Transform Your Fitness";

        // Get user notification preferences
        const { data: prefProfile } = await supabaseAdmin
          .from("profiles")
          .select("notification_preferences")
          .eq("user_id", user.user_id)
          .single();

        const userPrefs = (prefProfile?.notification_preferences as Record<string, any>) || {};

        // Check if user has opted out of all notifications
        if (userPrefs.opt_out_all === true) {
          skipped++;
          continue;
        }

        const { canSend } = await import("../_shared/notification-preferences.ts");

        // Send dashboard message
        if (automationRule.sends_dashboard_message && canSend(userPrefs, "monday_motivation", "dashboard")) {
          const { error: msgError } = await supabaseAdmin
            .from("user_system_messages")
            .insert({
              user_id: user.user_id,
              message_type: MESSAGE_TYPES.MONDAY_MOTIVATION,
              subject: subject,
              content: content,
              is_read: false,
            });

          if (msgError) {
            logStep("Dashboard message error", { userId: user.user_id, error: msgError.message });
            failed++;
          } else {
            dashboardSent++;
          }
        }

        // Send email
        if (automationRule.sends_email && resend) {
          const { data: userData, error: userDataError } = await supabaseAdmin.auth.admin.getUserById(user.user_id);
          
          if (userDataError) {
            logStep("Error fetching user email", { userId: user.user_id, error: userDataError.message });
            continue;
          }
          
          const userEmail = userData?.user?.email;

          if (userEmail) {
            // Skip obvious placeholder / junk addresses so they never count
            // against delivery health and never trigger Resend rate-limit errors.
            const lowerEmail = userEmail.toLowerCase();
            const isJunk = /@(example|test|invalid|localhost)\.|^noreply@|^no-reply@/.test(lowerEmail);
            if (isJunk) {
              logStep("Skipping junk/placeholder email", { userId: user.user_id, email: userEmail });
              continue;
            }
            try {
              // Check notification preferences - FIXED to use correct preference
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("notification_preferences")
                .eq("user_id", user.user_id)
                .single();

              const prefs = profile?.notification_preferences as any;
              if (!canSend(prefs, "monday_motivation", "email")) {
                logStep("Monday motivation email disabled for user", { userId: user.user_id });
                continue;
              }

              // Use the email utility with personalized CTA
              const emailHtml = wrapInEmailTemplateWithFooter(
                subject,
                content,
                userEmail,
                ctaUrl,
                ctaText
              );

              const sendOnce = () => resend.emails.send({
                from: "SmartyGym <notifications@smartygym.com>",
                reply_to: "smartygym@outlook.com",
                to: [userEmail],
                subject: subject,
                headers: getEmailHeaders(userEmail),
                html: emailHtml,
              });
              const emailResult = await sendEmailWithRetry(sendOnce, { userId: user.user_id, email: userEmail });
              
              if (emailResult.error) {
                logStep("Email API error", { userId: user.user_id, email: userEmail, error: emailResult.error });
                emailErrors.push(`${userEmail}: ${getEmailErrorMessage(emailResult.error)}`);
                await logEmailDelivery({
                  userId: user.user_id,
                  toEmail: userEmail,
                  messageType: "weekly-motivation",
                  status: "failed",
                  errorMessage: getEmailErrorMessage(emailResult.error),
                });
              } else {
                emailsSent++;
                await logEmailDelivery({
                  userId: user.user_id,
                  toEmail: userEmail,
                  messageType: "weekly-motivation",
                  status: "sent",
                  resendId: (emailResult as any)?.data?.id ?? null,
                });
              }
              // Rate limiting: delay after every attempted send, success or failure.
              await delay(1000);
            } catch (emailError: any) {
              const errorMsg = getEmailErrorMessage(emailError);
              logStep("Email send error", { userId: user.user_id, email: userEmail, error: errorMsg });
              emailErrors.push(`${userEmail}: ${errorMsg}`);
              await logEmailDelivery({
                userId: user.user_id,
                toEmail: userEmail,
                messageType: "weekly-motivation",
                status: "failed",
                errorMessage: errorMsg,
              });
          }
        }

        }
      } catch (error: any) {
        failed++;
        logStep("Error processing user", { userId: user.user_id, error: error.message });
      }
    }

    // Update automation rule execution count
    logStep("Updating automation rule stats");
    const { error: updateError } = await supabaseAdmin
      .from("automation_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        total_executions: (automationRule.total_executions || 0) + dashboardSent,
      })
      .eq("id", automationRule.id);

    if (updateError) {
      logStep("Error updating automation rule", { error: updateError.message });
    }

    // Log to audit
    logStep("Logging to audit");
    await supabaseAdmin.from('notification_audit_log').insert({
      notification_type: 'monday_motivation',
      message_type: MESSAGE_TYPES.MONDAY_MOTIVATION,
      recipient_count: users.length,
      success_count: dashboardSent,
      failed_count: failed,
      subject: defaultSubject,
      content: 'Personalized goal-based content',
      metadata: {
        emails_sent: emailsSent,
        skipped_already_sent: skipped,
        users_with_goals: usersWithGoals,
        users_without_goals: usersWithoutGoals,
        email_errors: emailErrors.length > 0 ? emailErrors : undefined
      }
    });

    logStep("Processing completed", { 
      totalUsers: users.length,
      dashboardSent, 
      emailsSent, 
      skipped,
      failed,
      usersWithGoals,
      usersWithoutGoals,
      emailErrors: emailErrors.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalUsers: users.length,
        dashboardSent, 
        emailsSent,
        skipped,
        failed,
        usersWithGoals,
        usersWithoutGoals,
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined
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
