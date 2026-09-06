/**
 * Self-service actions the support flow is allowed to perform on the customer's
 * behalf — everything here is already inside the customer's own access level,
 * so doing it automatically is safe and honest.
 *
 * Rule: NEVER write a reply claiming an action was taken unless the action here
 * actually returned `performed: true`.
 */

const UNSUBSCRIBE_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bun-?subscribe\b/i,
  /\bopt[\s-]?out\b/i,
  /\bstop\b[^.!?]{0,40}\b(e-?mails?|notifications?|messages?|newsletter)\b/i,
  /\bremove (me|my e-?mail|my address)\b[^.]*\b(list|mailing|database|e-?mails?)\b/i,
  /\btake me off\b/i,
  /\bno (more|longer) (want |wish )?(to )?(receive )?(any )?(e-?mails?|notifications?)/i,
  /\bδιαγρα(φ|ψ)/i, // "delete/remove" in Greek
];

export function detectsUnsubscribeRequest(text: string): boolean {
  if (!text) return false;
  return UNSUBSCRIBE_PATTERNS.some((re) => re.test(text));
}

const FLAT_EMAIL_KEYS = [
  "email_notifications",
  "newsletter",
  "promotional_emails",
  "email_wod",
  "email_ritual",
  "email_monday_motivation",
  "email_new_workout",
  "email_new_program",
  "email_new_article",
  "email_weekly_activity",
  "email_checkin_reminders",
  "email_scheduled_workout_reminders",
  "email_scheduled_program_reminders",
  "email_goal_achievement",
  "email_welcome_onboarding",
  "checkin_reminders",
];

const AUTOMATION_KEYS = [
  "morning_daily_digest",
  "monday_motivation",
  "new_workout",
  "new_program",
  "new_article",
  "weekly_activity_report",
  "checkin_reminder",
  "scheduled_workout_reminder",
  "scheduled_program_reminder",
  "goal_achievement",
  "welcome_onboarding",
  "general_announcement",
];

export interface UnsubscribeResult {
  performed: boolean;
  alreadyUnsubscribed: boolean;
  target: "user" | "newsletter" | "none";
  error?: string;
}

/**
 * Turns every optional email off for this address — exactly the same end state
 * the customer would reach by flipping the switches in their own settings.
 * Essential account mail (purchases, renewals, security) is unaffected.
 */
export async function unsubscribeEmailEverywhere(
  supabaseAdmin: any,
  email: string,
): Promise<UnsubscribeResult> {
  const lower = email.toLowerCase();
  try {
    // Newsletter list (works for guests with no account too).
    const { data: subscriber } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, active")
      .eq("email", lower)
      .maybeSingle();

    if (subscriber?.active) {
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ active: false })
        .eq("email", lower);
    }

    // Registered account.
    let page = 1;
    let user: any = null;
    while (page <= 20 && !user) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      user = (data?.users || []).find((u: any) => u.email?.toLowerCase() === lower) || null;
      if (!data?.users?.length || data.users.length < 200) break;
      page++;
    }

    if (!user) {
      return {
        performed: Boolean(subscriber?.active),
        alreadyUnsubscribed: Boolean(subscriber && !subscriber.active),
        target: subscriber ? "newsletter" : "none",
      };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("notification_preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    const current = (profile?.notification_preferences as Record<string, any>) || {};

    if (current.opt_out_all === true) {
      return { performed: false, alreadyUnsubscribed: true, target: "user" };
    }

    const next: Record<string, any> = { ...current, opt_out_all: true };
    for (const key of FLAT_EMAIL_KEYS) next[key] = false;
    for (const key of AUTOMATION_KEYS) {
      const node = current[key];
      next[key] = {
        ...(node && typeof node === "object" ? node : {}),
        email: false,
      };
    }
    next.opted_out_at = new Date().toISOString();
    next.opted_out_source = "support_request";

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ notification_preferences: next })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return { performed: true, alreadyUnsubscribed: false, target: "user" };
  } catch (e: any) {
    console.error("[self-service] unsubscribe failed:", e?.message || e);
    return { performed: false, alreadyUnsubscribed: false, target: "none", error: String(e?.message || e) };
  }
}
