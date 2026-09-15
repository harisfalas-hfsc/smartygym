/**
 * Centralized admin-analytics counting rules.
 * Every analytics screen MUST use these helpers so that numbers match the
 * live product (e.g. /workouts library, subscription pages, etc.).
 */
import { supabase } from "@/integrations/supabase/client";

// ---------- Bot / preview traffic exclusions ----------
// Keep this list in sync between the overview card, Website tab and Social tab.
const BOT_PATTERNS = [
  "%lovable%",
  "%bot%",
  "%crawler%",
  "%spider%",
  "%scraper%",
  "%headless%",
  "%python%",
  "%curl%",
  "%meta-external%",
  "%adsbot%",
  "%facebookexternalhit%",
  "%semrush%",
  "%ahrefs%",
  "%playstore-google%",
  // Automated scraper that spoofs a long-obsolete desktop Chrome build.
  // It is responsible for the vast majority of recorded "visits" and is not a human.
  "%Chrome/126.0.0.0%",
] as const;

const ADMIN_PATH_PATTERNS = [
  "/admin%",
  "%/admin%",
  "/corporate-admin%",
] as const;

/**
 * Apply the canonical bot/preview filter to a social_media_analytics query.
 */
export function applyBotFilter<T extends { not: (col: string, op: string, val: string) => T }>(query: T): T {
  let q = query;
  for (const p of BOT_PATTERNS) {
    q = q.not("browser_info", "ilike", p);
  }
  for (const p of ADMIN_PATH_PATTERNS) {
    q = q.not("landing_page", "ilike", p);
  }
  return q;
}

export const TRACKING_EXCLUDED_ADMIN_PATH_PREFIXES = ["/admin", "/corporate-admin"] as const;

export interface StripePaymentTruth {
  id: string;
  amount: number;
  gross?: number;
  refunded?: number;
  currency?: string;
  date: string;
  customer?: string | null;
  email?: string | null;
  description?: string | null;
  productName?: string | null;
  productId?: string | null;
  contentType?: string | null;
  recurring?: boolean;
  category?: CurrentRevenueCategory | "premium" | "standalone" | "personal_training" | "corporate";
}

export type CurrentRevenueCategory = "premium_membership" | "standalone_workout" | "standalone_program" | "other_smartygym";

export const CURRENT_REVENUE_CATEGORY_LABELS: Record<CurrentRevenueCategory, string> = {
  premium_membership: "Premium Membership",
  standalone_workout: "Standalone Workout",
  standalone_program: "Standalone Training Program",
  other_smartygym: "Other SmartyGym Product",
};

export const CURRENT_REVENUE_CATEGORIES: CurrentRevenueCategory[] = [
  "premium_membership",
  "standalone_workout",
  "standalone_program",
  "other_smartygym",
];

export function normalizeRevenueCategory(payment: Pick<StripePaymentTruth, "category" | "contentType" | "productName" | "recurring">): CurrentRevenueCategory {
  const category = String(payment.category || "").toLowerCase();
  const contentType = String(payment.contentType || "").toLowerCase().replace(/[-\s]+/g, "_");
  const productName = String(payment.productName || "").toLowerCase();

  if (category === "standalone_workout" || contentType === "workout" || contentType === "micro_workout") return "standalone_workout";
  if (
    category === "standalone_program" ||
    contentType === "program" ||
    contentType === "training_program" ||
    productName.includes("training program")
  ) return "standalone_program";
  if (category === "other_smartygym") return "other_smartygym";
  if (category === "standalone") {
    if (productName.includes("workout")) return "standalone_workout";
    if (productName.includes("program")) return "standalone_program";
    return "other_smartygym";
  }
  return "premium_membership";
}

export interface StripeRevenueTruthData {
  totalCollected: number;
  totalRefunded: number;
  paymentCount: number;
  byMonth: Record<string, number>;
  byMonthByCategory: Record<string, Record<CurrentRevenueCategory, number>>;
  byCategory: Record<CurrentRevenueCategory, { amount: number; count: number }>;
  payments: StripePaymentTruth[];
  excludedNonSmartyGym?: number;
  skippedNonSmartyGym?: number;
  unmatchedSmartyGymMetadataWarnings?: number;
  unattributed?: number;
  unattributedAmount?: number;
}

export async function fetchStripeRevenueTruth(): Promise<StripeRevenueTruthData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("get-stripe-revenue");
    if (error || !data || typeof data.totalCollected !== "number") {
      console.error("Failed to fetch Stripe revenue truth", error || data);
      return null;
    }
    const payments = (data.payments || []).map((payment: StripePaymentTruth) => ({
      ...payment,
      category: normalizeRevenueCategory(payment),
    }));
    const byCategory = CURRENT_REVENUE_CATEGORIES.reduce((acc, category) => {
      acc[category] = { amount: 0, count: 0 };
      return acc;
    }, {} as Record<CurrentRevenueCategory, { amount: number; count: number }>);
    const byMonthByCategory: Record<string, Record<CurrentRevenueCategory, number>> = {};

    payments.forEach((payment) => {
      const category = normalizeRevenueCategory(payment);
      byCategory[category].amount += Number(payment.amount) || 0;
      byCategory[category].count += 1;
      const month = payment.date?.slice(0, 7);
      if (month) {
        byMonthByCategory[month] = byMonthByCategory[month] || CURRENT_REVENUE_CATEGORIES.reduce((acc, c) => {
          acc[c] = 0;
          return acc;
        }, {} as Record<CurrentRevenueCategory, number>);
        byMonthByCategory[month][category] += Number(payment.amount) || 0;
      }
    });

    return {
      totalCollected: Number(data.totalCollected) || 0,
      totalRefunded: Number(data.totalRefunded) || 0,
      paymentCount: Number(data.paymentCount) || 0,
      byMonth: data.byMonth || {},
      byMonthByCategory,
      byCategory,
      payments,
      excludedNonSmartyGym: Number(data.excludedNonSmartyGym ?? data.skippedNonSmartyGym) || 0,
      skippedNonSmartyGym: Number(data.skippedNonSmartyGym ?? data.excludedNonSmartyGym) || 0,
      unmatchedSmartyGymMetadataWarnings: Number(data.unmatchedSmartyGymMetadataWarnings ?? data.unattributed) || 0,
      unattributed: Number(data.unattributed ?? data.unmatchedSmartyGymMetadataWarnings) || 0,
      unattributedAmount: Number(data.unattributedAmount) || 0,
    };
  } catch (error) {
    console.error("Failed to fetch Stripe revenue truth", error);
    return null;
  }
}

// ---------- Workout library counting ----------

export interface WorkoutLibraryCounts {
  /** Visible non-WOD library workouts — matches the public /workouts page. */
  availableWorkouts: number;
  /** Visible workouts including active WODs. */
  visibleWorkoutsIncludingWOD: number;
  /** Currently active Workout-of-the-Day rows. */
  activeWODs: number;
  /** Hidden (admin-only / draft) workouts. */
  hiddenWorkouts: number;
  /** Raw row count in admin_workouts. */
  totalRows: number;
}

export async function fetchWorkoutLibraryCounts(): Promise<WorkoutLibraryCounts> {
  const [{ count: totalRows }, { count: visibleIncludingWOD }, { count: activeWODs }, { count: nonLibraryWODs }, { count: hidden }] =
    await Promise.all([
      supabase.from("admin_workouts").select("id", { count: "exact", head: true }),
      supabase
        .from("admin_workouts")
        .select("id", { count: "exact", head: true })
        .neq("is_visible", false),
      supabase
        .from("admin_workouts")
        .select("id", { count: "exact", head: true })
        .eq("is_workout_of_day", true),
      supabase
        .from("admin_workouts")
        .select("id", { count: "exact", head: true })
        .eq("is_workout_of_day", true)
        .neq("wod_source", "library"),
      supabase
        .from("admin_workouts")
        .select("id", { count: "exact", head: true })
        .eq("is_visible", false),
    ]);

  const visibleIncludingWODNum = visibleIncludingWOD ?? 0;
  const activeWODsNum = activeWODs ?? 0;
  const nonLibraryWODsNum = nonLibraryWODs ?? 0;

  return {
    totalRows: totalRows ?? 0,
    visibleWorkoutsIncludingWOD: visibleIncludingWODNum,
    activeWODs: activeWODsNum,
    hiddenWorkouts: hidden ?? 0,
    // Library = visible workouts, excluding only non-library WODs (AI-generated daily WODs).
    // Library-sourced WODs ARE existing library workouts temporarily promoted, so they count.
    // This matches the public /workouts page filter exactly.
    availableWorkouts: Math.max(visibleIncludingWODNum - nonLibraryWODsNum, 0),
  };
}

export async function fetchAvailableProgramsCount(): Promise<number> {
  const { count } = await supabase
    .from("admin_training_programs")
    .select("id", { count: "exact", head: true })
    .neq("is_visible", false);
  return count ?? 0;
}

export async function fetchAvailableRitualsCount(): Promise<number> {
  const { count } = await supabase
    .from("daily_smarty_rituals")
    .select("id", { count: "exact", head: true })
    .neq("is_visible", false);
  return count ?? 0;
}

// ---------- Subscription / user counting ----------

export interface SubscriptionRow {
  user_id?: string | null;
  plan_type: string | null;
  status: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  subscription_source?: string | null;
  stripe_status?: string | null;
}

export interface PremiumCounts {
  /** Active Premium access rows, including manual/admin access. */
  activePremiumSubscribers: number;
  /** Active Premium with real Stripe billing evidence. */
  paidSubscribers: number;
  /** Active Premium access granted manually/admin-side. */
  manualSubscribers: number;
  /** Distinct user_ids that hold an active premium subscription. */
  distinctPremiumUsers: number;
}

export const CURRENT_PREMIUM_PLAN_TYPES = new Set(["premium", "legacy_premium", "lifetime", "gold", "platinum"]);

export function isCurrentPremiumAccess(s: SubscriptionRow | null | undefined): boolean {
  return !!s && s.status === "active" && !!s.plan_type && CURRENT_PREMIUM_PLAN_TYPES.has(s.plan_type);
}

export function isCurrentPremiumSubscription(s: SubscriptionRow | null | undefined): boolean {
  if (!isCurrentPremiumAccess(s)) return false;
  return s?.subscription_source !== "admin_grant" && (!!s?.stripe_subscription_id || (!!s?.stripe_customer_id && s?.subscription_source === "stripe"));
}

export function isManualPremiumAccess(s: SubscriptionRow | null | undefined): boolean {
  return isCurrentPremiumAccess(s) && !isCurrentPremiumSubscription(s);
}

export function normalizePlanLabel(s: Pick<SubscriptionRow, "plan_type" | "status"> | null | undefined): string {
  if (!s?.plan_type || s.plan_type === "free") return "Free";
  if (s.status === "active" && CURRENT_PREMIUM_PLAN_TYPES.has(s.plan_type)) return "Premium Access";
  if (CURRENT_PREMIUM_PLAN_TYPES.has(s.plan_type)) return "Former Premium";
  return s.plan_type.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function computePremiumCounts(subs: SubscriptionRow[] | null | undefined): PremiumCounts {
  const list = subs ?? [];
  const active = list.filter(isCurrentPremiumAccess);
  const paid = active.filter(isCurrentPremiumSubscription);
  const manual = active.filter(isManualPremiumAccess);
  const distinctUsers = new Set(active.map((s) => s.user_id).filter(Boolean));

  return {
    activePremiumSubscribers: active.length,
    paidSubscribers: paid.length,
    manualSubscribers: manual.length,
    distinctPremiumUsers: distinctUsers.size,
  };
}

/**
 * Non-premium users = total profile accounts minus distinct active premium users.
 * This matches "everyone who is NOT currently a paying / comp premium member".
 */
export function computeNonPremiumUsers(totalUsers: number, distinctPremiumUsers: number): number {
  return Math.max(totalUsers - distinctPremiumUsers, 0);
}

// ---------- Website visitors (filtered) ----------

/**
 * Canonical "real" website visitor count for a date window.
 * Excludes preview/Lovable traffic, bots, crawlers and known scrapers.
 * Used by the dashboard overview card, Website tab, Social tab and report export.
 */
export async function fetchFilteredVisitorCount(
  startDate: Date,
  endDate: Date = new Date(),
): Promise<number> {
  let query = supabase
    .from("social_media_analytics")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "visit")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  query = applyBotFilter(query as any) as typeof query;

  const { count } = await query;
  return count ?? 0;
}
