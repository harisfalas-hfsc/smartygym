import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";
import { canSend } from "../_shared/notification-preferences.ts";
import { isUnroutableEmail } from "../_shared/list-all-users.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, details?: any) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-MORNING-NOTIFICATIONS] ${step}${detailsStr}`);
}

// Replace placeholders in template content
function replacePlaceholders(template: string, data: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

// CRITICAL: Strip any "Day X" references from content (AGGRESSIVE sanitizer)
// This ensures users NEVER see "Day 43", "Day {day_number}", etc.
// Catches plain text, HTML-wrapped, and placeholder patterns
function stripDayReferences(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // Remove HTML-wrapped patterns like "<strong>Day 43</strong>"
  result = result.replace(/<strong>\s*Day\s*\d+\s*<\/strong>/gi, '<strong>Daily</strong>');
  result = result.replace(/<strong>\s*Day\s*\{day_number\}\s*<\/strong>/gi, '<strong>Daily</strong>');
  
  // Remove patterns like "Day 43", "Day 1", "Day {day_number}" (plain text)
  result = result.replace(/Day\s*\{day_number\}/gi, 'Daily');
  result = result.replace(/Day\s+\d+/gi, 'Daily');
  result = result.replace(/Day\d+/gi, 'Daily');
  
  // Fix resulting grammar: "for Daily" -> "for Today", etc.
  result = result.replace(/(for|on|is)\s+Daily/gi, '$1 Today');
  
  // Clean up any double spaces
  result = result.replace(/\s{2,}/g, ' ');
  
  return result;
}

function compactDashboardNotificationHtml(html: string): string {
  if (!html) return html;

  return html
    .replace(/&nbsp;|\u00a0/gi, " ")
    .replace(/<hr[^>]*>/gi, "")
    .replace(/<p\b[^>]*>\s*(?:<[^>]+>\s*)*[━─—–\-_\s]{8,}(?:\s*<\/[^>]+>)*\s*<\/p>/gi, "")
    .replace(/<(?:strong|b)\b[^>]*>\s*[━─—–\-_\s]{8,}\s*<\/(?:strong|b)>/gi, "")
    .replace(/<p[^>]*>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, "")
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br />")
    .replace(/(\r?\n\s*){2,}/g, "\n")
    .trim();
}

// Strip "Good Morning, Smarty!" greeting from template content to prevent duplicates
// The main email wrapper already includes this greeting, so we remove it from sections
function stripMorningGreeting(html: string): string {
  if (!html) return html;
  
  // Remove various patterns of the morning greeting
  const patterns = [
    // Tiptap style: <p class="tiptap-paragraph"><strong>🌅 Good Morning, Smarty!</strong></p>
    /<p[^>]*class="[^"]*tiptap-paragraph[^"]*"[^>]*>\s*<strong>\s*🌅?\s*Good\s*Morning,?\s*Smarty!?\s*<\/strong>\s*<\/p>\s*/gi,
    // Email style: <h1...>🌅 Good Morning, Smarty!</h1>
    /<h1[^>]*>\s*🌅?\s*Good\s*Morning,?\s*Smarty!?\s*<\/h1>\s*/gi,
    // Plain heading without emoji
    /<h1[^>]*>\s*Good\s*Morning,?\s*Smarty!?\s*<\/h1>\s*/gi,
    // Paragraph style with strong
    /<p[^>]*>\s*<strong>\s*🌅?\s*Good\s*Morning,?\s*Smarty!?\s*<\/strong>\s*<\/p>\s*/gi,
    // Paragraph style without strong
    /<p[^>]*>\s*🌅?\s*Good\s*Morning,?\s*Smarty!?\s*<\/p>\s*/gi,
    // Just the text in a div
    /<div[^>]*>\s*🌅?\s*Good\s*Morning,?\s*Smarty!?\s*<\/div>\s*/gi,
  ];
  
  let result = html;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  
  // Clean up any resulting double empty paragraphs or excess whitespace at the start
  result = result.replace(/^(\s*<p[^>]*>\s*<\/p>\s*)+/gi, '');
  
  return result.trim();
}

// Resend has strict rate limits (2 req/sec on free tier, sometimes stricter).
// We MUST throttle BEFORE each request + retry rate-limit errors.
// CRITICAL: 650ms was NOT enough - all emails failed at same timestamp.
// Increasing to 1000ms minimum to ensure we never exceed 1 req/sec.
const BASE_SEND_DELAY_MS = 1000; // 1 request per second (safe margin)
const MAX_RESEND_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 2000; // Start with 2 second backoff on rate limit

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(err: any): boolean {
  const msg = (err?.message ?? "").toString().toLowerCase();
  const status = err?.statusCode ?? err?.status ?? err?.code;
  return status === 429 || msg.includes("too many requests") || msg.includes("rate limit");
}

async function sendResendEmailWithRetry(
  resendClient: Resend,
  payload: Record<string, any>,
  context: { toEmail: string }
): Promise<any> {
  let lastResult: any = null;

  for (let attempt = 1; attempt <= MAX_RESEND_ATTEMPTS; attempt++) {
    // CRITICAL: Wait BEFORE sending to prevent rate limit burst
    if (attempt > 1) {
      const backoffMs = INITIAL_BACKOFF_MS * attempt;
      logStep("⏳ Rate limited, waiting before retry", {
        to: context.toEmail,
        attempt,
        backoffMs,
      });
      await sleep(backoffMs);
    }
    
    const result = await resendClient.emails.send(payload as any);
    lastResult = result;

    if (!result?.error) return result;

    if (!isRateLimitError(result.error) || attempt === MAX_RESEND_ATTEMPTS) {
      return result;
    }
  }

  return lastResult;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const unauthorized = requireServiceRole(req, corsHeaders);
    if (unauthorized) return unauthorized;

    const frozen = await freezeGuard(corsHeaders, "send-morning-notifications");
    if (frozen) return frozen;

    logStep("Starting combined morning notification delivery (7:00 AM Cyprus time)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Get today's date in Cyprus timezone with dynamic DST handling
    const now = new Date();
    const month = now.getUTCMonth() + 1; // 1-12
    // Cyprus DST: April-October = UTC+3, November-March = UTC+2
    const cyprusOffset = (month >= 4 && month <= 10) ? 3 : 2;
    const cyprusTime = new Date(now.getTime() + cyprusOffset * 60 * 60 * 1000);
    const todayStr = cyprusTime.toISOString().split('T')[0];

    logStep("Looking for today's content", { todayStr });

    // ============================================
    // FETCH TEMPLATES FROM DATABASE
    // Priority: 1) automation_key match + is_active, 2) is_default + is_active
    // ============================================
    const { data: templates } = await supabase
      .from("automated_message_templates")
      .select("*")
      .in("message_type", ["morning_wod", "morning_wod_recovery", "morning_ritual"])
      .eq("is_active", true);

    // Helper to find best template: prioritize automation_key match, then is_default
    const findBestTemplate = (messageType: string, automationKey: string) => {
      const templatesForType = templates?.filter(t => t.message_type === messageType) || [];
      
      // First: find by automation_key match
      const byAutomationKey = templatesForType.find(t => t.automation_key === automationKey);
      if (byAutomationKey) return byAutomationKey;
      
      // Second: find by is_default
      const defaultTemplate = templatesForType.find(t => t.is_default === true);
      if (defaultTemplate) return defaultTemplate;
      
      // Third: any active template for this type
      return templatesForType[0] || null;
    };

    // Get the BEST template for each type (prioritizing automation_key match)
    const wodTemplate = findBestTemplate("morning_wod", "morning_wod");
    const wodRecoveryTemplate = findBestTemplate("morning_wod_recovery", "morning_wod_recovery");
    const ritualTemplate = findBestTemplate("morning_ritual", "morning_ritual");

    logStep("Templates loaded (automation_key priority)", { 
      hasWodTemplate: !!wodTemplate, 
      hasWodRecoveryTemplate: !!wodRecoveryTemplate,
      hasRitualTemplate: !!ritualTemplate,
      wodTemplateId: wodTemplate?.id,
      wodRecoveryTemplateId: wodRecoveryTemplate?.id,
      ritualTemplateId: ritualTemplate?.id
    });

    // ============================================
    // FETCH TODAY'S WODs
    // ============================================
    let todaysWods: any[] = [];
    const { data: wodsData, error: wodError } = await supabase
      .from("admin_workouts")
      .select("*")
      .eq("is_workout_of_day", true)
      .eq("generated_for_date", todayStr);

    if (!wodError && wodsData && wodsData.length > 0) {
      todaysWods = wodsData;
    } else {
      // Fallback: check for any active WODs
      const { data: activeWods } = await supabase
        .from("admin_workouts")
        .select("*")
        .eq("is_workout_of_day", true)
        .limit(2);
      
      if (activeWods && activeWods.length > 0) {
        todaysWods = activeWods;
      }
    }

    const bodyweightWod = todaysWods.find(w => w.equipment === "BODYWEIGHT");
    const equipmentWod = todaysWods.find(w => w.equipment === "EQUIPMENT");
    const category = todaysWods[0]?.category || "Fitness";
    const format = todaysWods[0]?.format || "CIRCUIT";
    const difficulty = todaysWods[0]?.difficulty || "Intermediate";
    const difficultyStars = todaysWods[0]?.difficulty_stars || 3;
    const hasWods = todaysWods.length > 0;

    // Determine if this is a recovery day (only 1 workout OR category is RECOVERY)
    const isRecoveryDay = todaysWods.length === 1 || category?.toUpperCase() === "RECOVERY";

    logStep("WODs found", { 
      hasWods,
      isRecoveryDay,
      workoutCount: todaysWods.length,
      bodyweight: bodyweightWod?.name, 
      equipment: equipmentWod?.name,
      category
    });

    // ============================================
    // FETCH TODAY'S RITUAL
    // ============================================
    // Today's ritual is the one assigned by the rotation cron — pulled via join.
    let todaysRitual: any = null;
    const { data: ritualAssignment } = await supabase
      .from("daily_ritual_assignments")
      .select("ritual_id, daily_smarty_rituals(*)")
      .eq("ritual_date", todayStr)
      .maybeSingle();

    if (ritualAssignment?.daily_smarty_rituals) {
      todaysRitual = ritualAssignment.daily_smarty_rituals;
    }

    const hasRitual = !!todaysRitual;

    logStep("Ritual found", { hasRitual, dayNumber: todaysRitual?.day_number });

    // ============================================
    // ALERT ADMIN IF NO WODs
    // ============================================
    if (!hasWods) {
      logStep("⚠️ No WODs found for today - alerting admin");
      
      await supabase.from("user_system_messages").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        message_type: "admin_alert",
        subject: "⚠️ No WOD Found for Today",
        content: `No Workout of the Day was found for ${todayStr}. Please check the WOD generator.`,
        is_read: false,
      });
    }

    // Skip if neither WODs nor Ritual exists
    if (!hasWods && !hasRitual) {
      logStep("No content found for today - skipping notifications");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No content found for today - no notifications sent",
          todayStr 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ============================================
    // PREVENT DUPLICATE NOTIFICATIONS
    // ============================================
    // Check for existing WOD or ritual audit entries (using constraint-valid types)
    const { data: existingAudit } = await supabase
      .from("notification_audit_log")
      .select("id")
      .in("notification_type", ["wod", "daily_ritual"])
      .gte("sent_at", todayStr)
      .lt("sent_at", todayStr + "T23:59:59")
      .limit(1);

    if (existingAudit && existingAudit.length > 0) {
      logStep("⚠️ Morning notifications already sent today - skipping to prevent duplicates");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Morning notifications already sent today - skipping duplicates",
          todayStr 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ============================================
    // GET ALL USER PROFILES
    // ============================================
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, notification_preferences");

    if (!allProfiles || allProfiles.length === 0) {
      logStep("No user profiles found");
      return new Response(
        JSON.stringify({ success: true, message: "No user profiles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    logStep(`Processing morning notifications for ${allProfiles.length} users`);

    // ============================================
    // BUILD NOTIFICATION CONTENT FROM TEMPLATES
    // Using channel-specific fields: dashboard_content, email_content
    // ============================================
    
    // Prepare placeholder data for WOD
    const wodPlaceholders = {
      category: category,
      bodyweight_name: bodyweightWod?.name || "Bodyweight Workout",
      equipment_name: equipmentWod?.name || "Equipment Workout",
      workout_name: todaysWods[0]?.name || "Today's Workout",
      format: format,
      difficulty: difficulty,
      difficulty_stars: difficultyStars,
    };

    // Prepare placeholder data for Ritual
    const ritualPlaceholders = {
      day_number: todaysRitual?.day_number || 1,
    };

    // ============================================
    // BUILD DASHBOARD CONTENT (use dashboard_content field)
    // ============================================
    let wodDashboardContent: string;
    let wodDashboardSubject: string;

    if (isRecoveryDay && wodRecoveryTemplate) {
      // Use recovery template - prefer dashboard_content if available
      wodDashboardContent = replacePlaceholders(
        wodRecoveryTemplate.dashboard_content || wodRecoveryTemplate.content, 
        wodPlaceholders
      );
      wodDashboardSubject = replacePlaceholders(
        wodRecoveryTemplate.dashboard_subject || wodRecoveryTemplate.subject, 
        wodPlaceholders
      );
      logStep("Using RECOVERY template for WOD dashboard notification");
    } else if (wodTemplate) {
      // Use regular 2-workout template
      wodDashboardContent = replacePlaceholders(
        wodTemplate.dashboard_content || wodTemplate.content, 
        wodPlaceholders
      );
      wodDashboardSubject = replacePlaceholders(
        wodTemplate.dashboard_subject || wodTemplate.subject, 
        wodPlaceholders
      );
      logStep("Using REGULAR template for WOD dashboard notification");
    } else {
      // Fallback to hardcoded content if no template exists
      logStep("No WOD template found - using fallback dashboard content");
      if (isRecoveryDay) {
        wodDashboardContent = `<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"><strong>🧘 TODAY'S RECOVERY WORKOUT</strong></p>
<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Today is <strong>Recovery</strong> day with one gentle workout:</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><strong>🧘 Recovery:</strong> ${todaysWods[0]?.name || "Recovery Workout"}</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">${format} | All Levels</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><a href="https://smartygym.com/workout/wod">View Today's Workout →</a></p>`;
        wodDashboardSubject = `🧘 Today's Recovery Workout: ${todaysWods[0]?.name || "Recovery"}`;
      } else {
        wodDashboardContent = `<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"><strong>🏆 TODAY'S WORKOUT OF THE DAY</strong></p>
<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Today is <strong>${category}</strong> day with TWO workout options:</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><strong>🏠 No Equipment:</strong> ${bodyweightWod?.name || "Bodyweight Workout"}</p>
<p class="tiptap-paragraph"><strong>🏋️ With Equipment:</strong> ${equipmentWod?.name || "Equipment Workout"}</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">${format} | ${difficulty} (${difficultyStars}⭐)</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><a href="https://smartygym.com/workout/wod">View Today's Workouts →</a></p>`;
        wodDashboardSubject = `🏆 Today's Workout of the Day: ${category}`;
      }
    }

    // ============================================
    // BUILD EMAIL CONTENT (use email_content field - can be different from dashboard)
    // ============================================
    let wodEmailContent: string;
    let wodEmailSubject: string;

    if (isRecoveryDay && wodRecoveryTemplate) {
      // Check if template has specific email content, otherwise use content
      wodEmailContent = wodRecoveryTemplate.email_content || wodRecoveryTemplate.content;
      wodEmailSubject = wodRecoveryTemplate.email_subject || wodRecoveryTemplate.subject;
      wodEmailContent = replacePlaceholders(wodEmailContent, wodPlaceholders);
      wodEmailSubject = replacePlaceholders(wodEmailSubject, wodPlaceholders);
    } else if (wodTemplate) {
      wodEmailContent = wodTemplate.email_content || wodTemplate.content;
      wodEmailSubject = wodTemplate.email_subject || wodTemplate.subject;
      wodEmailContent = replacePlaceholders(wodEmailContent, wodPlaceholders);
      wodEmailSubject = replacePlaceholders(wodEmailSubject, wodPlaceholders);
    } else {
      // Fallback email content (styled for email)
      wodEmailSubject = isRecoveryDay 
        ? `🧘 Today's Recovery Workout: ${todaysWods[0]?.name || "Recovery"}`
        : `🏆 Today's Workout of the Day: ${category}`;
      wodEmailContent = ""; // Will be built inline below
    }

    // Build ritual content from template or fallback
    let ritualDashboardContent: string;
    let ritualDashboardSubject: string;
    let ritualEmailContent: string;
    let ritualEmailSubject: string;

    if (ritualTemplate) {
      ritualDashboardContent = replacePlaceholders(
        ritualTemplate.dashboard_content || ritualTemplate.content, 
        ritualPlaceholders
      );
      ritualDashboardSubject = replacePlaceholders(
        ritualTemplate.dashboard_subject || ritualTemplate.subject, 
        ritualPlaceholders
      );
      ritualEmailContent = replacePlaceholders(
        ritualTemplate.email_content || ritualTemplate.content, 
        ritualPlaceholders
      );
      ritualEmailSubject = replacePlaceholders(
        ritualTemplate.email_subject || ritualTemplate.subject, 
        ritualPlaceholders
      );
      logStep("Using template for Ritual notification");
    } else {
      // Fallback content - no greeting as main email wrapper has it
      ritualDashboardContent = `<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"><strong>🌅 YOUR DAILY SMARTY RITUAL</strong></p>
<p class="tiptap-paragraph"><strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong></p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Your Smarty Ritual is ready!</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph">Start your day with intention through our three wellness rituals:</p>
<p class="tiptap-paragraph">☀️ <strong>Morning</strong> - Energize your start</p>
<p class="tiptap-paragraph">🌤️ <strong>Midday</strong> - Recharge and refocus</p>
<p class="tiptap-paragraph">🌙 <strong>Evening</strong> - Wind down peacefully</p>
<p class="tiptap-paragraph"></p>
<p class="tiptap-paragraph"><a href="https://smartygym.com/daily-ritual">View Today's Ritual →</a></p>`;
      ritualDashboardSubject = `🌅 Your Daily Smarty Ritual`;
      ritualEmailContent = ""; // Will be built inline
      ritualEmailSubject = ritualDashboardSubject;
    }

    // ============================================
    // INSERT DASHBOARD NOTIFICATIONS (PREFERENCE-AWARE)
    // ============================================
    let wodDashboardSent = 0;
    let ritualDashboardSent = 0;
    let dashboardSkipped = 0;

    const dashboardInserts: { user_id: string; message_type: string; subject: string; content: string; is_read: boolean }[] = [];

    for (const profile of allProfiles) {
      const prefs = (profile.notification_preferences as Record<string, any>) || {};

      // Single dashboard gate for the combined Morning Daily Digest
      if (!canSend(prefs, "morning_daily_digest", "dashboard")) {
        dashboardSkipped++;
        continue;
      }

      if (hasWods) {
        dashboardInserts.push({
          user_id: profile.user_id,
          message_type: MESSAGE_TYPES.WOD_NOTIFICATION,
          subject: stripDayReferences(wodDashboardSubject),
          content: compactDashboardNotificationHtml(stripDayReferences(wodDashboardContent)),
          is_read: false,
        });
        wodDashboardSent++;
      }

      if (hasRitual) {
        dashboardInserts.push({
          user_id: profile.user_id,
          message_type: MESSAGE_TYPES.DAILY_RITUAL,
          subject: stripDayReferences(ritualDashboardSubject),
          content: compactDashboardNotificationHtml(stripDayReferences(ritualDashboardContent)),
          is_read: false,
        });
        ritualDashboardSent++;
      }
    }

    // Batch insert dashboard notifications
    if (dashboardInserts.length > 0) {
      await supabase.from('user_system_messages').insert(dashboardInserts);
    }

    logStep("Dashboard notifications inserted", { 
      wodDashboardSent, 
      ritualDashboardSent, 
      dashboardSkipped 
    });

    // ============================================
    // SEND EMAILS (PREFERENCE-AWARE) - Using email_content from templates
    // ============================================
    // Paginate through ALL users (listUsers defaults to 50 per page)
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage });
      if (!pageData?.users?.length) break;
      allUsers.push(...pageData.users);
      if (pageData.users.length < perPage) break;
      page++;
    }
    logStep("All users fetched via pagination", { totalUsers: allUsers.length, pages: page });
    const usersData = { users: allUsers };
    const profilesMap = new Map(allProfiles?.map(p => [p.user_id, p.notification_preferences]) || []);

    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;
    
    // Track email delivery for debugging
    const emailDeliveryLogs: { 
      message_type: string; 
      to_email: string; 
      user_id: string | null; 
      status: string; 
      error_message: string | null;
      resend_id: string | null;
      metadata: any;
    }[] = [];

    let userIndex = 0;
    const totalUsers = usersData?.users?.length || 0;
    
    for (const authUser of usersData?.users || []) {
      userIndex++;
      if (!authUser.email) continue;
      // Skip IANA-reserved/unroutable domains that Resend rejects (example.com, .test, etc.)
      if (isUnroutableEmail(authUser.email)) {
        emailsSkipped++;
        continue;
      }

      const prefs = (profilesMap.get(authUser.id) as Record<string, any>) || {};

      // Single email gate for the combined Morning Daily Digest
      const allowEmail = canSend(prefs, "morning_daily_digest", "email");
      const wantsWodEmail = allowEmail && hasWods;
      const wantsRitualEmail = allowEmail && hasRitual;

      if (!wantsWodEmail && !wantsRitualEmail) {
        emailsSkipped++;
        continue;
      }

      // CRITICAL: Throttle BEFORE sending each email to prevent rate limit bursts
      // This delay happens before the email is sent, not after
      if (emailsSent > 0 || emailsFailed > 0) {
        await sleep(BASE_SEND_DELAY_MS);
      }
      
      logStep(`Processing email ${userIndex}/${totalUsers}`, { email: authUser.email });

      try {
        // Build email HTML - use template email_content if available
        let wodSection = '';
        let ritualSection = '';

        if (wantsWodEmail) {
          // If template provided email_content, wrap it in a styled div
          // Strip any "Good Morning, Smarty!" greeting to prevent duplicates (wrapper already has it)
          const cleanedWodContent = stripMorningGreeting(wodEmailContent);
          if (cleanedWodContent && cleanedWodContent.trim() !== '') {
            wodSection = `
<div style="margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #29B6D2;">
  ${cleanedWodContent}
</div>`;
          } else {
            // Fallback to hardcoded email content
            if (isRecoveryDay) {
              wodSection = `
<div style="margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #29B6D2;">
  <h2 style="color: #29B6D2; margin: 0 0 15px 0; font-size: 20px;">🧘 TODAY'S RECOVERY WORKOUT</h2>
  <p style="margin: 10px 0; color: #333;">Today is <strong>Recovery</strong> day with one gentle workout:</p>
  <div style="margin: 15px 0;">
    <p style="margin: 8px 0; color: #333;"><strong>🧘 Recovery:</strong> ${todaysWods[0]?.name || "Recovery Workout"}</p>
  </div>
  <p style="margin: 10px 0; color: #666;"><strong>Format:</strong> ${format} | <strong>Difficulty:</strong> All Levels</p>
  <p style="margin: 15px 0 0 0;"><a href="https://smartygym.com/workout/wod" style="background: #29B6D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Today's Workout →</a></p>
</div>`;
            } else {
              wodSection = `
<div style="margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #29B6D2;">
  <h2 style="color: #29B6D2; margin: 0 0 15px 0; font-size: 20px;">🏆 TODAY'S WORKOUTS OF THE DAY</h2>
  <p style="margin: 10px 0; color: #333;">Today is <strong>${category}</strong> day with TWO workout options:</p>
  <div style="margin: 15px 0;">
    <p style="margin: 8px 0; color: #333;"><strong>🏠 No Equipment:</strong> ${bodyweightWod?.name || "Bodyweight Workout"}</p>
    <p style="margin: 8px 0; color: #333;"><strong>🏋️ With Equipment:</strong> ${equipmentWod?.name || "Equipment Workout"}</p>
  </div>
  <p style="margin: 10px 0; color: #666;"><strong>Format:</strong> ${format} | <strong>Difficulty:</strong> ${difficulty} (${difficultyStars}⭐)</p>
  <p style="margin: 15px 0 0 0;"><a href="https://smartygym.com/workout/wod" style="background: #29B6D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Today's Workouts →</a></p>
</div>`;
            }
          }
        }

        if (wantsRitualEmail) {
          // Strip any "Good Morning, Smarty!" greeting to prevent duplicates (wrapper already has it)
          const cleanedRitualContent = stripMorningGreeting(ritualEmailContent);
          if (cleanedRitualContent && cleanedRitualContent.trim() !== '') {
            ritualSection = `
<div style="margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #29B6D2;">
  ${cleanedRitualContent}
</div>`;
          } else {
            ritualSection = `
<div style="margin: 30px 0; padding: 25px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #29B6D2;">
  <h2 style="color: #29B6D2; margin: 0 0 15px 0; font-size: 20px;">🌅 YOUR DAILY SMARTY RITUAL</h2>
  <p style="margin: 10px 0; color: #333;">Your Smarty Ritual is ready!</p>
  <p style="margin: 10px 0; color: #666;">Start your day with intention through our three wellness rituals:</p>
  <div style="margin: 15px 0;">
    <p style="margin: 8px 0; color: #333;">☀️ <strong>Morning</strong> - Energize your start</p>
    <p style="margin: 8px 0; color: #333;">🌤️ <strong>Midday</strong> - Recharge and refocus</p>
    <p style="margin: 8px 0; color: #333;">🌙 <strong>Evening</strong> - Wind down peacefully</p>
  </div>
  <p style="margin: 15px 0 0 0;"><a href="https://smartygym.com/daily-ritual" style="background: #29B6D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Today's Ritual →</a></p>
</div>`;
          }
        }

        const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #29B6D2; margin-bottom: 10px;">🌅 Good Morning, Smarty!</h1>
<p style="font-size: 16px; color: #333; margin-bottom: 25px;">Your daily fitness content is ready and waiting for you!</p>
${wodSection}
${ritualSection}
<p style="margin-top: 30px; color: #666; font-size: 14px;">Choose based on your situation: at home, traveling, or at the gym!</p>
${getEmailFooter(authUser.email, 'wod')}
</div>`;

        // Build subject based on what content is included
        // Apply day sanitizer to ensure no "Day X" leaks through
        let finalEmailSubject: string;
        if (wantsWodEmail && wantsRitualEmail) {
          // Combined subject when both are included
          finalEmailSubject = isRecoveryDay 
            ? `🌅 Today's Recovery Workout and Daily Ritual`
            : `🌅 Today's Workout of the Day and Daily Ritual`;
        } else if (wantsWodEmail) {
          // WOD only - use template subject or generate one
          finalEmailSubject = wodEmailSubject || (isRecoveryDay 
            ? `🧘 Today's Recovery Workout: ${todaysWods[0]?.name || 'Recovery'}`
            : `🏆 Today's Workout of the Day: ${category}`);
        } else {
          // Ritual only
          finalEmailSubject = ritualEmailSubject || `🌅 Your Daily Smarty Ritual`;
        }
        
        // CRITICAL: Apply day sanitizer to subject and HTML to prevent any "Day X" from leaking
        finalEmailSubject = stripDayReferences(finalEmailSubject);
        const sanitizedEmailHtml = stripDayReferences(emailHtml);

        const emailResult = await sendResendEmailWithRetry(
          resendClient,
          {
            from: "SmartyGym <notifications@smartygym.com>",
            to: authUser.email,
            subject: finalEmailSubject,
            html: sanitizedEmailHtml,
            headers: getEmailHeaders(authUser.email, 'wod'),
          },
          { toEmail: authUser.email }
        );

        // Check for Resend API errors
        if (emailResult?.error) {
          emailsFailed++;
          logStep(`Failed to send email to ${authUser.email}`, { error: emailResult.error });

          // Log ALL failures for debugging
          emailDeliveryLogs.push({
            message_type: 'morning_combined',
            to_email: authUser.email,
            user_id: authUser.id,
            status: 'failed',
            error_message: emailResult.error.message || JSON.stringify(emailResult.error),
            resend_id: null,
            metadata: { wantsWodEmail, wantsRitualEmail, isRecoveryDay },
          });
        } else {
          emailsSent++;
          logStep(`✅ Email sent to ${authUser.email}`, { resendId: emailResult?.data?.id, index: userIndex });
        }
        
        // Note: Delay is now BEFORE the next email, not after this one
      } catch (emailError) {
        emailsFailed++;
        const errorMsg = emailError instanceof Error ? emailError.message : String(emailError);
        logStep(`Exception sending email to ${authUser.email}`, { error: errorMsg });
        
        // Log exception
        emailDeliveryLogs.push({
          message_type: 'morning_combined',
          to_email: authUser.email,
          user_id: authUser.id,
          status: 'failed',
          error_message: errorMsg,
          resend_id: null,
          metadata: { exception: true }
        });
      }
    }
    
    // Insert email delivery logs for debugging
    if (emailDeliveryLogs.length > 0) {
      await supabase.from('email_delivery_log').insert(emailDeliveryLogs);
      logStep("Email delivery logs inserted", { count: emailDeliveryLogs.length });
    }

    logStep("Email sending complete", { emailsSent, emailsFailed, emailsSkipped });

    // ============================================
    // CREATE AUDIT LOG (log each message_type separately for better history tracking)
    // ============================================
    const auditEntries = [];
    
    if (hasWods) {
      auditEntries.push({
        notification_type: 'wod', // Use 'wod' which matches the database constraint
        message_type: isRecoveryDay ? "morning_wod_recovery" : "morning_wod",
        subject: wodDashboardSubject,
        content: `WOD: ${category}, ${todaysWods.length} workout(s)`,
        recipient_count: wodDashboardSent + emailsSent + emailsFailed,
        success_count: wodDashboardSent + emailsSent,
        failed_count: emailsFailed,
        metadata: {
          todayStr,
          isRecoveryDay,
          workoutCount: todaysWods.length,
          wodDashboardSent,
          emailsSent,
          emailsFailed,
          usedTemplate: isRecoveryDay ? !!wodRecoveryTemplate : !!wodTemplate
        }
      });
    }

    if (hasRitual) {
      auditEntries.push({
        notification_type: 'daily_ritual', // Use 'daily_ritual' which matches the database constraint
        message_type: "morning_ritual",
        subject: ritualDashboardSubject,
        content: `Ritual for ${todayStr}`,
        recipient_count: ritualDashboardSent + emailsSent + emailsFailed,
        success_count: ritualDashboardSent + emailsSent,
        failed_count: emailsFailed,
        metadata: {
          todayStr,
          dayNumber: todaysRitual?.day_number,
          ritualDashboardSent,
          emailsSent,
          emailsFailed,
          usedTemplate: !!ritualTemplate
        }
      });
    }

    if (auditEntries.length > 0) {
      await supabase.from("notification_audit_log").insert(auditEntries);
    }

    logStep("✅ Morning notifications complete", {
      isRecoveryDay,
      wodDashboardSent,
      ritualDashboardSent,
      dashboardSkipped,
      emailsSent,
      emailsFailed,
      emailsSkipped
    });

    return new Response(
      JSON.stringify({
        success: true,
        isRecoveryDay,
        wodDashboardSent,
        ritualDashboardSent,
        dashboardSkipped,
        emailsSent,
        emailsFailed,
        emailsSkipped,
        todayStr
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("❌ Error in morning notifications", { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
