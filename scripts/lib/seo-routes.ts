/**
 * Single source of truth for every public, indexable URL on smartygym.com.
 *
 * Used by:
 *   - scripts/generate-sitemap.ts  (writes public/sitemap.xml)
 *   - scripts/prerender.ts         (writes dist/<path>/index.html with real SEO)
 *   - scripts/verify-prerender.ts  (safety checks before publish)
 *
 * Keeping one source guarantees the sitemap and the pre-rendered HTML can
 * never drift apart. Whenever a published blog article, visible workout, or
 * visible training program exists in the database, it appears in both.
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildUniqueContentSlugs,
  slugifyContentName,
} from "../../src/lib/seo-slugs";

export const BASE_URL = "https://smartygym.com";

/**
 * Canonical URL for a route path.
 *
 * Option A (current): Lovable hosting does not reliably serve the nested
 * `<path>/index.html` when the browser requests the clean URL — it falls
 * back to the SPA shell (which carries `noindex`). To guarantee Google
 * sees the prerendered HTML on first fetch, canonical points at the
 * `.html` sibling (which the host DOES serve as a real static file).
 * The clean URL still redirects to the `.html` URL client-side.
 */
export function canonicalUrlFor(path: string): string {
  if (path === "/" || path === "") return `${BASE_URL}/`;
  if (path.endsWith(".html")) return `${BASE_URL}${path}`;
  return `${BASE_URL}${path}.html`;
}

export function canonicalPathFor(path: string): string {
  if (path === "/" || path === "") return "/";
  if (path.endsWith(".html")) return path;
  return `${path}.html`;
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://cvccrvyimyzrxcwzmxwk.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y2NydnlpbXl6cnhjd3pteHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTc2NjIsImV4cCI6MjA3NjE5MzY2Mn0.XU_h4CYRiQ7VN079laFHSVMrzB6urOhQZFoTagU_Wno";

export const MIN_EXPECTED_DYNAMIC_WORKOUTS = 100;
export const MIN_EXPECTED_DYNAMIC_PROGRAMS = 10;
export const MIN_EXPECTED_DYNAMIC_BLOG_ARTICLES = 1;

const STATIC_LEGACY_REDIRECTS: Array<{ from: string; to: string; status: 301 }> = [
  { from: "/blog/amrap-vs-emom-vs-tabata", to: "/blog/amrap-vs-emom-vs-tabata-which-is-best", status: 301 },
  { from: "/1rmcalculator", to: "/tools/1rm-calculator", status: 301 },
  { from: "/bmrcalculator", to: "/tools/bmr-calculator", status: 301 },
  { from: "/macrocalculator", to: "/tools/macro-calculator", status: 301 },
  { from: "/caloriecalculator", to: "/tools/macro-calculator", status: 301 },
  { from: "/workouttimer", to: "/tools/workout-timer", status: 301 },
  { from: "/caloriecounter", to: "/tools/calorie-counter", status: 301 },
];

export type RouteKind =
  | "static"
  | "workout-category"
  | "program-category"
  | "blog-article"
  | "workout"
  | "program";

export interface SeoRoute {
  /** URL path relative to BASE_URL, always starts with "/". */
  path: string;
  kind: RouteKind;
  /** Browser tab title, unique per page. */
  title: string;
  /** <=160 char description, unique per page. */
  description: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
  /** og:image absolute URL. */
  image?: string;
  /** Full attached row payload, used by pre-render to build body content. */
  payload?: Record<string, unknown>;
  /** Per-page keywords (from seo_metadata table when present). */
  keywords?: string[];
  /** Extra JSON-LD blocks (from seo_metadata table when present). */
  extraJsonLd?: unknown;
}

/** Public static routes (no DB-backed content). */
const STATIC_ROUTES: Array<
  Omit<SeoRoute, "kind" | "lastmod"> & { changefreq?: SeoRoute["changefreq"] }
> = [
  {
    path: "/",
    title: "SmartyGym | Online Fitness Platform by Haris Falas",
    description:
      "SmartyGym: 500+ expert-designed workouts, training programs and daily rituals by Sports Scientist Haris Falas. 100% human, 0% AI. Train anywhere, anytime.",
    changefreq: "daily",
    priority: "1.0",
  },
  {
    path: "/about",
    title: "About SmartyGym | Built by Sports Scientist Haris Falas",
    description:
      "Why SmartyGym exists: 100% human-designed training by Haris Falas (BSc Sports Science, CSCS) for busy adults who refuse generic AI workouts.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/contact",
    title: "Contact SmartyGym | Talk to Coach Haris Falas",
    description:
      "Get in touch with SmartyGym for support, partnerships, or coaching questions. Direct contact with Sports Scientist Haris Falas.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/faq",
    title: "SmartyGym FAQ | Subscription, Workouts and Programs",
    description:
      "Answers about SmartyGym subscriptions, workouts, programs, the WOD system, and access. Get clarity before you train.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/fitness-training",
    title: "Human-Designed Fitness Training Platform | SmartyGym",
    description:
      "A complete human-designed fitness training platform — workouts, programs, exercise library, tools, rituals, check-ins and community, all coach-crafted by Haris Falas.",
    changefreq: "weekly",
    priority: "0.95",
  },
  {
    path: "/glossary",
    title: "Fitness Training Glossary | SmartyGym",
    description:
      "Plain-language definitions of real strength, hypertrophy, conditioning and mobility terms — coach-written, not auto-generated.",
    changefreq: "monthly",
    priority: "0.75",
  },
  {
    path: "/research",
    title: "Training Research Digest | SmartyGym",
    description:
      "Evidence behind SmartyGym programming — progressive overload, volume, frequency, Zone 2, mobility, protein, sleep and adherence, in plain English.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/blog",
    title: "Fitness Blog Articles by Haris Falas | SmartyGym",
    description:
      "Evidence-based fitness blog articles by Sports Scientist Haris Falas: strength training, nutrition, recovery and healthy aging.",
    changefreq: "weekly",
    priority: "0.8",
  },
  {
    path: "/coach-profile",
    title: "Haris Falas | Coach Profile | SmartyGym",
    description:
      "Haris Falas — Sports Scientist (BSc), CSCS, EXOS Performance Specialist. 20+ years of strength and conditioning experience powering SmartyGym.",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/coach-cv",
    title: "Coach Haris Falas CV | Credentials and Experience",
    description:
      "Full CV of Haris Falas: Sports Science degree, CSCS, EXOS Performance Specialist, and 20+ years of coaching across performance and rehab.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/the-smarty-method",
    title: "The Smarty Method | Training Philosophy by Haris Falas",
    description:
      "The Smarty Method: how Haris Falas combines strength, metabolic conditioning, mobility and recovery to build lifelong fitness.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/best-online-fitness-platform",
    title: "Best Online Fitness Platform | SmartyGym vs Alternatives",
    description:
      "Why SmartyGym is the best online fitness platform for busy adults: 100% human-designed training, not AI-generated workouts.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/why-invest-in-smartygym",
    title: "Why Invest in SmartyGym | Long-Term Fitness Investment",
    description:
      "Why SmartyGym is a long-term investment in your health, performance and healthy aging — not just another fitness subscription.",
    changefreq: "monthly",
    priority: "0.6",
  },

  // Workout flows
  {
    path: "/workout",
    title: "Smarty Workouts | Online Workouts by Haris Falas",
    description:
      "Browse 500+ online workouts by Sports Scientist Haris Falas: strength, cardio, metabolic, mobility, pilates, recovery and challenges.",
    changefreq: "daily",
    priority: "0.9",
  },
  {
    path: "/workout/wod",
    title: "Workout of the Day | SmartyWOD by Haris Falas",
    description:
      "Today's Workout of the Day: two fresh, human-designed workouts (bodyweight + equipment) delivered every morning by Haris Falas.",
    changefreq: "daily",
    priority: "0.9",
  },
  {
    path: "/wod-archive",
    title: "WOD Archive | Past Workouts of the Day | SmartyGym",
    description:
      "Browse the SmartyGym WOD archive — every past Workout of the Day designed by Sports Scientist Haris Falas.",
    changefreq: "daily",
    priority: "0.7",
  },
  {
    path: "/daily-ritual",
    title: "Daily Smarty Ritual | Mobility, Activation and Mindset",
    description:
      "Your Daily Smarty Ritual: short mobility, activation and recovery routines you can do every single day.",
    changefreq: "daily",
    priority: "0.7",
  },

  // Training programs
  {
    path: "/trainingprogram",
    title: "Smarty Training Programs | Multi-Week Plans by Haris Falas",
    description:
      "Multi-week training programs by Haris Falas — strength, hypertrophy, weight loss, cardio endurance, mobility and low back care.",
    changefreq: "weekly",
    priority: "0.9",
  },

  // Subscription / plan pages
  {
    path: "/smarty-premium",
    title: "SmartyGym Premium | Full Access Membership",
    description:
      "Join SmartyGym Premium for full access to 500+ workouts, multi-week programs, the daily WOD and every Smarty tool.",
    changefreq: "weekly",
    priority: "0.9",
  },

  // Corporate
  {
    path: "/corporate",
    title: "SmartyGym Corporate | Wellness for Teams and Companies",
    description:
      "SmartyGym Corporate: human-designed online fitness for teams, with centralized billing and structured training for employees.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/corporate-wellness",
    title: "Corporate Wellness Programs | SmartyGym for Teams",
    description:
      "Build a stronger team with SmartyGym Corporate Wellness: structured workouts, programs and accountability for every employee.",
    changefreq: "monthly",
    priority: "0.7",
  },

  // Library + tools
  {
    path: "/exerciselibrary",
    title: "Exercise Library | Coaching Cues and Demos | SmartyGym",
    description:
      "SmartyGym Exercise Library: clear coaching cues, descriptions and demos for every exercise used across our workouts and programs.",
    changefreq: "weekly",
    priority: "0.7",
  },
  {
    path: "/tools",
    title: "Smarty Tools | Free Fitness and Nutrition Calculators",
    description:
      "Smarty Tools: free 1RM calculator, BMR calculator, macro calculator, calorie counter and workout timer — built by Haris Falas.",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/tools/1rm-calculator",
    title: "1RM Calculator | Estimate Your One-Rep Max | SmartyGym",
    description:
      "Free 1RM calculator by SmartyGym. Estimate your one-rep max across major lifts using validated formulas. No signup required.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/tools/bmr-calculator",
    title: "BMR Calculator | Basal Metabolic Rate | SmartyGym",
    description:
      "Free BMR calculator by SmartyGym. Calculate your basal metabolic rate and daily calorie needs with science-based formulas.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/tools/macro-calculator",
    title: "Macro Calculator | Protein, Carbs and Fat | SmartyGym",
    description:
      "Free macro calculator by SmartyGym. Get personalized protein, carb and fat targets for fat loss, maintenance or muscle gain.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/tools/workout-timer",
    title: "Workout Timer | Interval, EMOM and Tabata | SmartyGym",
    description:
      "Free interval timer by SmartyGym for EMOM, AMRAP, Tabata and circuits. Built for real training, by Haris Falas.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/tools/calorie-counter",
    title: "Calorie Counter | Food Lookup and Tracking | SmartyGym",
    description:
      "Free SmartyGym calorie counter. Search foods, log meals and stay on top of your daily nutrition.",
    changefreq: "monthly",
    priority: "0.6",
  },

  // Community + shop
  {
    path: "/community",
    title: "SmartyGym Community | Leaderboards and Member Activity",
    description:
      "Join the SmartyGym community: see leaderboards, member streaks and workouts completed across the platform.",
    changefreq: "daily",
    priority: "0.7",
  },
  {
    path: "/shop",
    title: "SmartyGym Shop | Standalone Workouts and Programs",
    description:
      "Buy individual SmartyGym workouts and training programs without a subscription. One-time payment, lifetime access.",
    changefreq: "weekly",
    priority: "0.6",
  },

  // Legal
  {
    path: "/privacy-policy",
    title: "Privacy Policy | SmartyGym",
    description:
      "How SmartyGym handles your personal data, cookies and account information.",
    changefreq: "yearly",
    priority: "0.3",
  },
  {
    path: "/termsofservice",
    title: "Terms of Service | SmartyGym",
    description:
      "The terms that govern your use of SmartyGym, including subscriptions, content access and acceptable use.",
    changefreq: "yearly",
    priority: "0.3",
  },
  {
    path: "/disclaimer",
    title: "Health and Fitness Disclaimer | SmartyGym",
    description:
      "Important health and fitness disclaimer for SmartyGym users — please read before starting any workout or program.",
    changefreq: "yearly",
    priority: "0.3",
  },

  // NOTE: utility, auth, redirect-only and thank-you routes are intentionally
  // excluded from the sitemap. They are either blocked by robots.txt or are
  // not meaningful indexable content. Submitting them was creating noise that
  // Google reports as "discovered, not indexed".
];

export const WORKOUT_CATEGORY_SLUGS = [
  "strength",
  "calorie-burning",
  "metabolic",
  "cardio",
  "mobility",
  "challenge",
  "pilates",
  "recovery",
  "micro-workouts",
];

export const PROGRAM_CATEGORY_SLUGS = [
  "cardio-endurance",
  "functional-strength",
  "muscle-hypertrophy",
  "weight-loss",
  "low-back-pain",
  "mobility-stability",
];

export const BLOG_CATEGORY_SLUGS = ["fitness", "nutrition", "wellness"];

const BLOG_CATEGORY_TITLE: Record<string, string> = {
  fitness: "Fitness Articles",
  nutrition: "Nutrition Articles",
  wellness: "Wellness Articles",
};

const WORKOUT_CATEGORY_TITLE: Record<string, string> = {
  strength: "Strength Workouts",
  "calorie-burning": "Calorie-Burning Workouts",
  metabolic: "Metabolic Workouts",
  cardio: "Cardio Workouts",
  mobility: "Mobility and Stability Workouts",
  challenge: "Challenge Workouts",
  pilates: "Pilates Workouts",
  recovery: "Recovery Workouts",
  "micro-workouts": "Micro-Workouts (5-Minute Exercise Snacks)",
};

const PROGRAM_CATEGORY_TITLE: Record<string, string> = {
  "cardio-endurance": "Cardio Endurance Programs",
  "functional-strength": "Functional Strength Programs",
  "muscle-hypertrophy": "Muscle Hypertrophy Programs",
  "weight-loss": "Weight Loss Programs",
  "low-back-pain": "Low Back Pain Programs",
  "mobility-stability": "Mobility and Stability Programs",
};

const WORKOUT_CATEGORY_TO_SLUG: Record<string, string> = {
  STRENGTH: "strength",
  "CALORIE BURNING": "calorie-burning",
  METABOLIC: "metabolic",
  CARDIO: "cardio",
  "MOBILITY & STABILITY": "mobility",
  MOBILITY: "mobility",
  CHALLENGE: "challenge",
  PILATES: "pilates",
  RECOVERY: "recovery",
  "MICRO-WORKOUTS": "micro-workouts",
};

const PROGRAM_CATEGORY_TO_SLUG: Record<string, string> = {
  "CARDIO ENDURANCE": "cardio-endurance",
  "FUNCTIONAL STRENGTH": "functional-strength",
  "MUSCLE HYPERTROPHY": "muscle-hypertrophy",
  "WEIGHT LOSS": "weight-loss",
  "LOW BACK PAIN": "low-back-pain",
  "MOBILITY & STABILITY": "mobility-stability",
};

export function workoutSlugFor(category: string | null | undefined): string | null {
  if (!category) return null;
  const up = category.toUpperCase().trim();
  if (WORKOUT_CATEGORY_TO_SLUG[up]) return WORKOUT_CATEGORY_TO_SLUG[up];
  for (const key of Object.keys(WORKOUT_CATEGORY_TO_SLUG)) {
    if (up.includes(key)) return WORKOUT_CATEGORY_TO_SLUG[key];
  }
  return null;
}

export function programSlugFor(category: string | null | undefined): string | null {
  if (!category) return null;
  const up = category.toUpperCase().trim();
  if (PROGRAM_CATEGORY_TO_SLUG[up]) return PROGRAM_CATEGORY_TO_SLUG[up];
  for (const key of Object.keys(PROGRAM_CATEGORY_TO_SLUG)) {
    if (up.includes(key)) return PROGRAM_CATEGORY_TO_SLUG[key];
  }
  return null;
}

function toIsoDate(value: unknown): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().split("T")[0];
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export interface SeoRouteBundle {
  routes: SeoRoute[];
  redirects: Array<{ from: string; to: string; status: 301 }>;
  counts: {
    static: number;
    workoutCategory: number;
    programCategory: number;
    workouts: number;
    programs: number;
    blogArticles: number;
    total: number;
  };
}

/**
 * Build the complete, authoritative list of public routes for the site.
 * Throws when dynamic counts look too small to publish safely.
 */
export async function buildSeoRoutes(): Promise<SeoRouteBundle> {
  const today = new Date().toISOString().split("T")[0];
  const routes: SeoRoute[] = [];
  const redirects: Array<{ from: string; to: string; status: 301 }> = [...STATIC_LEGACY_REDIRECTS];

  for (const r of STATIC_ROUTES) {
    routes.push({ ...r, kind: "static", lastmod: today });
  }

  for (const slug of WORKOUT_CATEGORY_SLUGS) {
    routes.push({
      path: `/workout/${slug}`,
      kind: "workout-category",
      title: `${WORKOUT_CATEGORY_TITLE[slug]} | SmartyGym`,
      description: `Browse all ${WORKOUT_CATEGORY_TITLE[slug].toLowerCase()} on SmartyGym, human-designed by Sports Scientist Haris Falas.`,
      lastmod: today,
      changefreq: "daily",
      priority: "0.8",
    });
  }

  for (const slug of PROGRAM_CATEGORY_SLUGS) {
    routes.push({
      path: `/trainingprogram/${slug}`,
      kind: "program-category",
      title: `${PROGRAM_CATEGORY_TITLE[slug]} | SmartyGym`,
      description: `Browse all ${PROGRAM_CATEGORY_TITLE[slug].toLowerCase()} on SmartyGym — multi-week, structured plans by Haris Falas.`,
      lastmod: today,
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  for (const slug of BLOG_CATEGORY_SLUGS) {
    routes.push({
      path: `/blog/category/${slug}`,
      kind: "static",
      title: `${BLOG_CATEGORY_TITLE[slug]} | SmartyGym Blog`,
      description: `Evidence-based ${slug} articles by Sports Scientist Haris Falas. Human-written, science-backed, no AI fluff.`,
      lastmod: today,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  let dynamicWorkouts = 0;
  let dynamicPrograms = 0;
  let dynamicBlog = 0;
  const blogIndexArticles: Record<string, unknown>[] = [];

  const [workoutsRes, programsRes, blogRes] = await Promise.all([
    (supabase as any).rpc("get_visible_workout_metadata", { _workout_id: null }),
    (supabase as any).rpc("get_visible_program_metadata", { _program_id: null }),
    supabase
      .from("blog_articles")
      .select(
        "id, slug, title, excerpt, content, category, image_url, author_name, author_credentials, read_time, published_at, created_at, updated_at, is_published",
      )
      .eq("is_published", true)
      .limit(2000),
  ]);

  // Per-item SEO overrides (title/description/keywords/json_ld) authored in
  // the seo_metadata table. We merge these on top of the generated defaults
  // so every blog article, workout and training program has its OWN unique
  // title, description, keyword set and structured data.
  const seoOverrides = new Map<string, {
    meta_title?: string | null;
    meta_description?: string | null;
    keywords?: string[] | null;
    json_ld?: unknown;
  }>();
  try {
    const { data: seoRows } = await (supabase as any)
      .from("seo_metadata")
      .select("content_type, content_id, meta_title, meta_description, keywords, json_ld")
      .in("content_type", ["workout", "program", "article", "blog"])
      .limit(10000);
    for (const row of (seoRows as any[]) || []) {
      seoOverrides.set(`${row.content_type}:${row.content_id}`, row);
    }
  } catch (e) {
    console.warn("[seo-routes] seo_metadata query failed:", (e as Error).message);
  }

  function applySeoOverride(
    type: "workout" | "program" | "article",
    id: string | null | undefined,
    route: SeoRoute,
  ): void {
    if (!id) return;
    const row =
      seoOverrides.get(`${type}:${id}`) ||
      (type === "article" ? seoOverrides.get(`blog:${id}`) : undefined);
    if (!row) return;
    if (row.meta_title) route.title = clamp(row.meta_title, 90);
    if (row.meta_description) route.description = clamp(row.meta_description, 160);
    if (Array.isArray(row.keywords) && row.keywords.length) {
      route.keywords = row.keywords.filter((k) => typeof k === "string" && k.trim().length > 0);
    }
    if (row.json_ld) route.extraJsonLd = row.json_ld;
  }

  if (workoutsRes.error) {
    console.warn("[seo-routes] workouts query error:", workoutsRes.error.message);
  } else if (workoutsRes.data) {
    const workoutSlugs = buildUniqueContentSlugs(workoutsRes.data as any[]);
    for (const w of workoutsRes.data as any[]) {
      const slug = workoutSlugFor(w.category);
      if (!slug || !w.id) continue;
      const workoutSlug = workoutSlugs.get(String(w.id)) || slugifyContentName(w.name || w.id);
      const cleanDesc = stripHtml(w.description);
      const titleParts = [
        w.name,
        "| Online Workout by Haris Falas | SmartyGym",
      ];
      const descParts = [
        w.duration ? `${w.duration} ${w.format || ""}`.trim() : w.format,
        `${w.difficulty || ""} workout`.trim(),
        cleanDesc || `${w.name} by Sports Scientist Haris Falas.`,
      ].filter(Boolean) as string[];
      routes.push({
        path: `/workout/${slug}/${workoutSlug}`,
        kind: "workout",
        title: clamp(titleParts.join(" "), 90),
        description: clamp(descParts.join(" — "), 160),
        image: w.image_url || undefined,
        lastmod: toIsoDate(w.updated_at) || toIsoDate(w.created_at) || today,
        changefreq: "weekly",
        priority: "0.7",
        payload: w,
      });
      applySeoOverride("workout", String(w.id), routes[routes.length - 1]);
      redirects.push({ from: `/workout/${slug}/${w.id}`, to: `/workout/${slug}/${workoutSlug}`, status: 301 });
      dynamicWorkouts++;
    }
  }

  if (programsRes.error) {
    console.warn("[seo-routes] programs query error:", programsRes.error.message);
  } else if (programsRes.data) {
    const programSlugs = buildUniqueContentSlugs(programsRes.data as any[]);
    for (const p of programsRes.data as any[]) {
      const slug = programSlugFor(p.category);
      if (!slug || !p.id) continue;
      const programSlug = programSlugs.get(String(p.id)) || slugifyContentName(p.name || p.id);
      const cleanDesc = stripHtml(p.description);
      const title = `${p.name} | Online Training Program by Haris Falas | SmartyGym`;
      const descBits = [
        p.weeks ? `${p.weeks}-week` : "",
        p.days_per_week ? `${p.days_per_week} days/week` : "",
        p.category || "",
        "program by Sports Scientist Haris Falas.",
        cleanDesc,
      ].filter(Boolean) as string[];
      routes.push({
        path: `/trainingprogram/${slug}/${programSlug}`,
        kind: "program",
        title: clamp(title, 90),
        description: clamp(descBits.join(" "), 160),
        image: p.image_url || undefined,
        lastmod: toIsoDate(p.updated_at) || toIsoDate(p.created_at) || today,
        changefreq: "weekly",
        priority: "0.7",
        payload: p,
      });
      applySeoOverride("program", String(p.id), routes[routes.length - 1]);
      redirects.push({ from: `/trainingprogram/${slug}/${p.id}`, to: `/trainingprogram/${slug}/${programSlug}`, status: 301 });
      dynamicPrograms++;
    }
  }

  if (blogRes.error) {
    console.warn("[seo-routes] blog query error:", blogRes.error.message);
  } else if (blogRes.data) {
    for (const b of blogRes.data as any[]) {
      if (!b.slug) continue;
      const cleanExcerpt = stripHtml(b.excerpt) || stripHtml(b.content);
      blogIndexArticles.push({
        slug: b.slug,
        title: b.title,
        excerpt: cleanExcerpt,
        category: b.category,
        published_at: b.published_at,
        updated_at: b.updated_at,
      });
      routes.push({
        path: `/blog/${b.slug}`,
        kind: "blog-article",
        title: clamp(`${b.title} | SmartyGym Blog`, 90),
        description: clamp(cleanExcerpt, 160),
        image: b.image_url || undefined,
        lastmod: toIsoDate(b.updated_at) || toIsoDate(b.created_at) || today,
        changefreq: "monthly",
        priority: "0.6",
        payload: b,
      });
      applySeoOverride("article", String(b.id), routes[routes.length - 1]);
      if (String(b.slug).endsWith("-which-is-best")) {
        redirects.push({
          from: `/blog/${String(b.slug).replace(/-which-is-best$/, "")}`,
          to: `/blog/${b.slug}`,
          status: 301,
        });
      }
      dynamicBlog++;
    }
    const blogRoute = routes.find((route) => route.path === "/blog");
    if (blogRoute) blogRoute.payload = { articles: blogIndexArticles };
  }

  if (
    dynamicWorkouts < MIN_EXPECTED_DYNAMIC_WORKOUTS ||
    dynamicPrograms < MIN_EXPECTED_DYNAMIC_PROGRAMS ||
    dynamicBlog < MIN_EXPECTED_DYNAMIC_BLOG_ARTICLES
  ) {
    throw new Error(
      `[seo-routes] unsafe dynamic counts: workouts=${dynamicWorkouts}, programs=${dynamicPrograms}, blog=${dynamicBlog}. Refusing to publish.`,
    );
  }

  return {
    routes,
    redirects: redirects.filter((rule) => rule.from !== rule.to),
    counts: {
      static: STATIC_ROUTES.length,
      workoutCategory: WORKOUT_CATEGORY_SLUGS.length,
      programCategory: PROGRAM_CATEGORY_SLUGS.length,
      workouts: dynamicWorkouts,
      programs: dynamicPrograms,
      blogArticles: dynamicBlog,
      total: routes.length,
    },
  };
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** HTML-attribute-safe escape (for content inside attribute values). */
export function attrEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** HTML-body-safe escape (for plain text inserted into element bodies). */
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export { stripHtml };