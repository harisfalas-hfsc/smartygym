// Daily job: pings search engines that the sitemap has refreshed and
// re-queues any content updated in the last 24 hours into the IndexNow queue.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITEMAP_URL = "https://smartygym.com/sitemap.xml";

function workoutSlug(cat: string | null): string | null {
  if (!cat) return null;
  const u = cat.toUpperCase().trim();
  const map: Record<string, string> = {
    "STRENGTH": "strength",
    "CALORIE BURNING": "calorie-burning",
    "METABOLIC": "metabolic",
    "CARDIO": "cardio",
    "MOBILITY & STABILITY": "mobility",
    "CHALLENGE": "challenge",
    "PILATES": "pilates",
    "RECOVERY": "recovery",
    "MICRO-WORKOUTS": "micro-workouts",
  };
  return map[u] || null;
}
function programSlug(cat: string | null): string | null {
  if (!cat) return null;
  const u = cat.toUpperCase().trim();
  const map: Record<string, string> = {
    "CARDIO ENDURANCE": "cardio-endurance",
    "FUNCTIONAL STRENGTH": "functional-strength",
    "MUSCLE HYPERTROPHY": "muscle-hypertrophy",
    "WEIGHT LOSS": "weight-loss",
    "LOW BACK PAIN": "low-back-pain",
    "MOBILITY & STABILITY": "mobility-stability",
  };
  return map[u] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const queued: { url: string; content_type: string; content_id: string }[] = [];

  // Canonical public URL slug — must match src/lib/seo-slugs.ts slugifyContentName
  const nameSlug = (value: string | null | undefined): string =>
    (String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")) || "content";

  const [w, p, b] = await Promise.all([
    supabase
      .from("admin_workouts")
      .select("id, name, category, updated_at, is_visible")
      .eq("is_visible", true)
      .gte("updated_at", since),
    supabase
      .from("admin_training_programs")
      .select("id, name, category, updated_at, is_visible")
      .eq("is_visible", true)
      .gte("updated_at", since),
    supabase
      .from("blog_articles")
      .select("id, slug, updated_at, is_published")
      .eq("is_published", true)
      .gte("updated_at", since),
  ]);

  for (const row of w.data || []) {
    const slug = workoutSlug(row.category);
    if (slug && row.id)
      queued.push({
        url: `https://smartygym.com/workout/${slug}/${nameSlug(row.name || row.id)}.html`,
        content_type: "workout",
        content_id: row.id,
      });
  }
  for (const row of p.data || []) {
    const slug = programSlug(row.category);
    if (slug && row.id)
      queued.push({
        url: `https://smartygym.com/trainingprogram/${slug}/${nameSlug(row.name || row.id)}.html`,
        content_type: "program",
        content_id: row.id,
      });
  }
  for (const row of b.data || []) {
    if (row.slug)
      queued.push({ url: `https://smartygym.com/blog/${row.slug}.html`, content_type: "article", content_id: String(row.id) });
  }

  if (queued.length > 0) {
    await supabase.from("indexnow_queue").insert(queued);
  }

  // Sitemap notifications.
  // - Google deprecated /ping?sitemap= in June 2023 (returns 404). Replaced
  //   with a Search Console API resubmit via the Lovable connector gateway.
  // - Bing still accepts the legacy ping endpoint.
  const pings: Record<string, number | string> = {};

  // Google: Search Console sitemap (re)submit
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GSC_API_KEY = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
    if (!LOVABLE_API_KEY || !GSC_API_KEY) {
      pings["google_search_console"] = "missing_credentials";
    } else {
      const siteUrl = encodeURIComponent("https://smartygym.com/");
      const feedpath = encodeURIComponent(SITEMAP_URL);
      const res = await fetch(
        `https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/${siteUrl}/sitemaps/${feedpath}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GSC_API_KEY,
          },
        },
      );
      pings["google_search_console"] = res.status;
    }
  } catch (e) {
    pings["google_search_console"] = `error:${String(e)}`;
  }

  // Bing: legacy /ping?sitemap= was deprecated (returns 410). Bing now relies
  // entirely on IndexNow, which is already pinged every 5 min by the
  // process-indexnow-queue-frequent cron — no separate sitemap ping needed.
  pings["bing"] = "uses_indexnow";

  return new Response(
    JSON.stringify({
      success: true,
      queued_for_indexnow: queued.length,
      sitemap_pings: pings,
      window_since: since,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});