/**
 * Renders the per-route HTML body content + JSON-LD blocks that get injected
 * into the static index.html template by scripts/prerender.ts.
 *
 * The pre-rendered body is what Google sees BEFORE JavaScript hydrates.
 * React's createRoot replaces it after hydration, so the visible UI stays the
 * same for users.
 */
import {
  BASE_URL,
  canonicalUrlFor,
  attrEscape,
  htmlEscape,
  stripHtml,
  type SeoRoute,
} from "./seo-routes";

const AUTHOR = {
  name: "Haris Falas",
  jobTitle: "Sports Scientist & Strength and Conditioning Coach",
  url: `${BASE_URL}/coach-profile`,
  description: "BSc Sports Science, CSCS certified with 20+ years experience",
};

const ORG = {
  name: "SmartyGym",
  url: BASE_URL,
};

function person() {
  return {
    "@type": "Person",
    "@id": `${BASE_URL}/coach-profile#person`,
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    description: AUTHOR.description,
    url: AUTHOR.url,
  };
}

function breadcrumb(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE_URL}${it.path}`,
    })),
  };
}

function safeImg(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${BASE_URL}${url}`;
  return url;
}

function sectionHtml(label: string, raw: string | null | undefined): string {
  if (!raw || !stripHtml(raw)) return "";
  // Admin-authored HTML is already sanitized in the app; we trust it the same
  // way the React app does and insert as-is.
  return `<section class="seo-section"><h2>${htmlEscape(label)}</h2>${normalizeInternalLinks(raw)}</section>`;
}

/**
 * FAQ blocks for tool pages. Baked into the static prerendered HTML so
 * Google can show Featured Snippets and AI crawlers can answer questions
 * directly from the page, without waiting for client-side hydration.
 */
const TOOL_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  "/tools/1rm-calculator": [
    { q: "What is a 1RM calculator?", a: "A one-rep max (1RM) calculator estimates the maximum weight you can lift for a single repetition of a given exercise, based on the weight and reps you completed in a recent set." },
    { q: "Which formula does this 1RM calculator use?", a: "SmartyGym's 1RM calculator uses validated strength science formulas (Epley, Brzycki, Lombardi) so you get a reliable estimate without having to test a true one-rep max." },
    { q: "Is the SmartyGym 1RM calculator free?", a: "Yes. The 1RM calculator is 100% free, requires no signup, and works on any device at smartygym.com/tools/1rm-calculator." },
    { q: "How accurate is a 1RM estimator?", a: "Estimators are most accurate in the 2–10 rep range. Sets above 10 reps reduce accuracy because fatigue affects the bar speed and force output." },
  ],
  "/tools/bmr-calculator": [
    { q: "What does a BMR calculator do?", a: "A basal metabolic rate (BMR) calculator estimates how many calories your body burns at complete rest to keep basic functions running — heart, brain, breathing, temperature." },
    { q: "How is BMR different from TDEE?", a: "BMR is calories burned at rest. TDEE (total daily energy expenditure) is BMR plus everything you do — walking, training, digestion, NEAT. SmartyGym shows both." },
    { q: "Which BMR formula is most accurate?", a: "SmartyGym uses the Mifflin–St Jeor equation, the most accurate BMR formula for the general adult population according to peer-reviewed nutrition research." },
    { q: "Is the BMR calculator free?", a: "Yes. The BMR calculator is free, no signup, and works on any device at smartygym.com/tools/bmr-calculator." },
  ],
  "/tools/macro-calculator": [
    { q: "What is a macro calculator?", a: "A macro calculator gives you personalised daily protein, carbohydrate and fat targets based on your weight, height, age, activity level and goal (fat loss, maintenance or muscle gain)." },
    { q: "How does the SmartyGym macro calculator set protein?", a: "Protein is anchored to bodyweight (typically 1.6–2.2 g/kg depending on goal) so you preserve lean mass in a deficit and support muscle gain in a surplus." },
    { q: "Can I use the macro calculator while losing weight?", a: "Yes. Pick the 'fat loss' goal and the macro calculator applies an evidence-based caloric deficit and a protein floor to protect lean mass." },
    { q: "Is the macro calculator free?", a: "Yes. The macro calculator is free, requires no signup, and saves your results in your SmartyGym logbook if you're signed in." },
  ],
  "/tools/workout-timer": [
    { q: "What workout formats does the timer support?", a: "SmartyGym's free workout timer supports EMOM, AMRAP, Tabata, intervals, and standard work/rest circuits — built for real strength and metabolic training." },
    { q: "Does the workout timer keep the screen on?", a: "Yes. The timer uses the browser wake-lock API so your screen stays on during training, no separate app required." },
    { q: "Is the SmartyGym workout timer free?", a: "Yes. The workout timer is 100% free, runs in any browser, no signup, no ads." },
    { q: "Can I use the timer offline?", a: "The timer caches once loaded, so short connection drops do not interrupt your session." },
  ],
  "/tools/calorie-counter": [
    { q: "Where does the calorie data come from?", a: "SmartyGym's calorie counter pulls from the USDA FoodData Central database — over 300,000 verified foods with calories, protein, carbs, fat and fibre." },
    { q: "Is the calorie counter free?", a: "Yes. The calorie counter is 100% free, no signup, and you can search any food in seconds." },
    { q: "Does the calorie counter save my entries?", a: "Yes. Logged-in members can save daily entries to their SmartyGym logbook for trend tracking." },
    { q: "Can the calorie counter handle European foods?", a: "Yes. The USDA database covers globally common foods, and the counter supports both metric (grams, ml) and imperial (oz) units." },
  ],
  "/tools": [
    { q: "What free fitness tools does SmartyGym offer?", a: "SmartyGym offers a free 1RM calculator, BMR calculator, macro calculator, calorie counter and workout timer — all designed by Sports Scientist Haris Falas." },
    { q: "Do the SmartyGym tools require a subscription?", a: "No. Every Smarty Tool is free to use, no signup required, on any device at smartygym.com/tools." },
    { q: "Who built the SmartyGym fitness tools?", a: "All SmartyGym tools were designed by Haris Falas — BSc Sports Science, CSCS, with 20+ years of strength and conditioning experience." },
  ],
};

const HTML_CANONICAL_PREFIXES = [
  "/blog", "/workout", "/trainingprogram", "/tools", "/coach-profile", "/coach-cv",
  "/the-smarty-method", "/about", "/about-smartygym", "/best-online-fitness-platform",
  "/why-invest-in-smartygym", "/wod-archive", "/daily-ritual", "/exerciselibrary",
  "/community", "/shop", "/contact", "/faq", "/smarty-plans", "/joinpremium",
  "/join-premium", "/corporate", "/corporate-wellness",
];

function normalizeInternalLinks(html: string): string {
  return html.replace(/href=(["'])(.*?)\1/gi, (_match, quote: string, href: string) => {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return `href=${quote}${href}${quote}`;
    try {
      const url = href.startsWith("http") ? new URL(href) : new URL(href, BASE_URL);
      if (url.hostname && !["smartygym.com", "www.smartygym.com"].includes(url.hostname)) return `href=${quote}${href}${quote}`;
      let path = url.pathname.replace(/\/+$/g, "") || "/";
      // Strip any stale "" suffix; clean URL is the new canonical.
      if (path.endsWith("") && path !== "/") path = path.slice(0, -"".length);
      if (path === "/") return `href=${quote}${href}${quote}`;
      if (!HTML_CANONICAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return `href=${quote}${href}${quote}`;
      const canonicalPath = `${path}${url.search}${url.hash}`;
      const nextHref = href.startsWith("http") ? `${BASE_URL}${canonicalPath}` : canonicalPath;
      return `href=${quote}${attrEscape(nextHref)}${quote}`;
    } catch {
      return `href=${quote}${href}${quote}`;
    }
  });
}

/** Build a list of JSON-LD blocks + the crawlable body HTML for a route. */
export function renderRouteBody(route: SeoRoute): {
  bodyHtml: string;
  jsonLd: unknown[];
} {
  const canonical = canonicalUrlFor(route.path);
  const jsonLd: unknown[] = [];

  // Per-item structured data authored in seo_metadata, if any.
  if ((route as any).extraJsonLd) {
    const extra = (route as any).extraJsonLd;
    if (Array.isArray(extra)) jsonLd.push(...extra);
    else jsonLd.push(extra);
  }

  if (route.kind === "blog-article") {
    const a = (route.payload || {}) as any;
    const published = a.published_at || a.created_at;
    const modified = a.updated_at || published;
    const img = safeImg(a.image_url);
    const plainContent = stripHtml(a.content || "");
    const wordCount = plainContent ? plainContent.split(/\s+/).filter(Boolean).length : undefined;
    const keywords = Array.isArray((route as any).keywords) && (route as any).keywords.length
      ? (route as any).keywords
      : [a.category, "SmartyGym", "Haris Falas", "fitness", "health"].filter(Boolean);
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: route.description,
      datePublished: published,
      dateModified: modified,
      image: img,
      author: person(),
      publisher: { "@type": "Organization", name: ORG.name, url: ORG.url },
      mainEntityOfPage: canonical,
      articleSection: a.category,
      keywords: Array.isArray(keywords) ? keywords.join(", ") : undefined,
      wordCount,
      inLanguage: "en",
      url: canonical,
    });
    jsonLd.push(
      breadcrumb([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: a.title, path: route.path },
      ]),
    );
    const dateLabel = published
      ? new Date(published).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";
    const author = a.author_name || AUTHOR.name;
    const credentials = a.author_credentials
      ? `<p class="seo-author-credentials">${htmlEscape(
          String(a.author_credentials),
        )}</p>`
      : "";
    const cover = img
      ? `<img src="${attrEscape(img)}" alt="${attrEscape(
          a.title || "",
        )}" width="1200" height="630" loading="eager" />`
      : "";
    return {
      bodyHtml: `
<main class="seo-prerender seo-article">
  <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/blog">Blog</a> &rsaquo; <span>${htmlEscape(a.title || "")}</span>
  </nav>
  <article>
    <header>
      <p class="seo-eyebrow">${htmlEscape(a.category || "Fitness")}</p>
      <h1>${htmlEscape(a.title || "")}</h1>
      <p class="seo-byline">By <a href="/coach-profile">${htmlEscape(author)}</a>${
        dateLabel ? ` &middot; <time datetime="${attrEscape(published)}">${htmlEscape(dateLabel)}</time>` : ""
      }${a.read_time ? ` &middot; ${htmlEscape(String(a.read_time))}` : ""}</p>
      ${credentials}
      <p class="seo-excerpt">${htmlEscape(stripHtml(a.excerpt) || "")}</p>
      ${cover}
    </header>
    <div class="seo-article-body">${normalizeInternalLinks(a.content || "")}</div>
    <aside class="seo-related-resources">
      <h2>Related SmartyGym Resources</h2>
      <ul>
        <li><a href="/wod-archive">Try today&rsquo;s Workout of the Day</a></li>
        <li><a href="/trainingprogram">Explore training programs by Coach Haris Falas</a></li>
        <li><a href="/tools">Use the free SmartyGym fitness tools</a></li>
        <li><a href="/blog">Read more articles on strength, fat loss and recovery</a></li>
        <li><a href="/joinpremium">Join SmartyGym &mdash; train anywhere, anytime</a></li>
      </ul>
    </aside>
    <aside class="seo-disclaimer">
      <p><strong>Disclaimer:</strong> This article is for educational purposes only and does not replace medical advice. If you have pain, injury, or a medical condition, consult a qualified professional before starting any exercise program.</p>
    </aside>
    <aside class="seo-cta">
      <p><a href="/joinpremium"><strong>Start training with SmartyGym &mdash; 100% human-designed by Coach Haris Falas.</strong></a></p>
    </aside>
  </article>
</main>`,
      jsonLd,
    };
  }

  if (route.kind === "workout") {
    const w = (route.payload || {}) as any;
    const img = safeImg(w.image_url);
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ExercisePlan",
      "@id": canonical,
      name: w.name,
      description: stripHtml(w.description) || route.description,
      image: img,
      activityDuration: w.duration,
      exerciseType: w.format,
      category: w.category,
      intensity: w.difficulty_stars
        ? `${w.difficulty_stars}/6 stars`
        : w.difficulty,
      workLocation: "Online / Home / Gym",
      isAccessibleForFree: !w.is_premium,
      author: person(),
      provider: { "@type": "Organization", name: ORG.name, url: ORG.url },
      identifier: w.id,
    });
    jsonLd.push(
      breadcrumb([
        { name: "Home", path: "/" },
        { name: "Smarty Workouts", path: "/workout" },
        { name: w.name, path: route.path },
      ]),
    );
    const metaRow = [
      w.category && `<li><strong>Category:</strong> ${htmlEscape(w.category)}</li>`,
      w.duration && `<li><strong>Duration:</strong> ${htmlEscape(w.duration)}</li>`,
      w.format && `<li><strong>Format:</strong> ${htmlEscape(w.format)}</li>`,
      w.difficulty && `<li><strong>Difficulty:</strong> ${htmlEscape(w.difficulty)}</li>`,
      w.equipment && `<li><strong>Equipment:</strong> ${htmlEscape(w.equipment)}</li>`,
    ]
      .filter(Boolean)
      .join("");
    const cover = img
      ? `<img src="${attrEscape(img)}" alt="${attrEscape(
          w.name || "",
        )}" width="1200" height="630" loading="eager" />`
      : "";
    return {
      bodyHtml: `
<main class="seo-prerender seo-workout">
  <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/workout">Smarty Workouts</a> &rsaquo; <span>${htmlEscape(w.name || "")}</span>
  </nav>
  <article>
    <header>
      <h1>${htmlEscape(w.name || "")}</h1>
      <ul class="seo-meta">${metaRow}</ul>
      ${cover}
      <p class="seo-excerpt">${htmlEscape(stripHtml(w.description) || "")}</p>
      <p class="seo-author">By <a href="/coach-profile">${htmlEscape(AUTHOR.name)}</a> &middot; ${htmlEscape(AUTHOR.jobTitle)}</p>
    </header>
    ${sectionHtml("Warm-Up", w.warm_up)}
    ${sectionHtml("Activation", w.activation)}
    ${sectionHtml("Main Workout", w.main_workout)}
    ${sectionHtml("Finisher", w.finisher)}
    ${sectionHtml("Cool-Down", w.cool_down)}
    ${sectionHtml("Instructions", w.instructions)}
    ${sectionHtml("Tips", w.tips)}
    ${sectionHtml("Notes", w.notes)}
    ${w.is_premium ? `<p class="seo-access">This workout is part of SmartyGym Premium. Full workout structure is available to members and standalone buyers.</p>` : ""}
  </article>
</main>`,
      jsonLd,
    };
  }

  if (route.kind === "program") {
    const p = (route.payload || {}) as any;
    const img = safeImg(p.image_url);
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "Course",
      "@id": canonical,
      name: p.name,
      description: stripHtml(p.description) || route.description,
      image: img,
      provider: { "@type": "Organization", name: ORG.name, url: ORG.url },
      instructor: person(),
      courseMode: "Online",
      isAccessibleForFree: !p.is_premium,
      timeRequired: p.weeks ? `P${p.weeks}W` : undefined,
      educationalLevel: p.difficulty || undefined,
      identifier: p.id,
    });
    // Additional ExercisePlan schema (per SEO spec) so search and AI
    // crawlers also surface programs as exercise plans, not only courses.
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ExercisePlan",
      "@id": `${canonical}#exerciseplan`,
      name: p.name,
      description: stripHtml(p.description) || route.description,
      image: img,
      activityDuration: p.weeks ? `${p.weeks} weeks` : undefined,
      exerciseType: p.category,
      category: p.category,
      intensity: p.difficulty_stars ? `${p.difficulty_stars}/6 stars` : p.difficulty,
      workLocation: "Online / Home / Gym",
      isAccessibleForFree: !p.is_premium,
      author: person(),
      provider: { "@type": "Organization", name: ORG.name, url: ORG.url },
      identifier: p.id,
    });
    jsonLd.push(
      breadcrumb([
        { name: "Home", path: "/" },
        { name: "Smarty Programs", path: "/trainingprogram" },
        { name: p.name, path: route.path },
      ]),
    );
    const metaRow = [
      p.category && `<li><strong>Category:</strong> ${htmlEscape(p.category)}</li>`,
      p.weeks && `<li><strong>Duration:</strong> ${htmlEscape(String(p.weeks))} weeks</li>`,
      p.days_per_week && `<li><strong>Frequency:</strong> ${htmlEscape(String(p.days_per_week))} days/week</li>`,
      p.difficulty && `<li><strong>Difficulty:</strong> ${htmlEscape(p.difficulty)}</li>`,
      p.equipment && `<li><strong>Equipment:</strong> ${htmlEscape(p.equipment)}</li>`,
    ]
      .filter(Boolean)
      .join("");
    const cover = img
      ? `<img src="${attrEscape(img)}" alt="${attrEscape(
          p.name || "",
        )}" width="1200" height="630" loading="eager" />`
      : "";
    return {
      bodyHtml: `
<main class="seo-prerender seo-program">
  <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/trainingprogram">Smarty Programs</a> &rsaquo; <span>${htmlEscape(p.name || "")}</span>
  </nav>
  <article>
    <header>
      <h1>${htmlEscape(p.name || "")}</h1>
      <ul class="seo-meta">${metaRow}</ul>
      ${cover}
      <p class="seo-excerpt">${htmlEscape(stripHtml(p.description) || "")}</p>
      <p class="seo-author">Designed by <a href="/coach-profile">${htmlEscape(AUTHOR.name)}</a> &middot; ${htmlEscape(AUTHOR.jobTitle)}</p>
    </header>
    ${sectionHtml("Overview", p.overview)}
    ${sectionHtml("Target Audience", p.target_audience)}
    ${sectionHtml("Program Structure", p.program_structure)}
    ${sectionHtml("Weekly Schedule", p.weekly_schedule)}
    ${sectionHtml("Progression Plan", p.progression_plan)}
    ${sectionHtml("Nutrition Tips", p.nutrition_tips)}
    ${sectionHtml("Expected Results", p.expected_results)}
    ${p.is_premium ? `<p class="seo-access">This program is part of SmartyGym Premium. Full week-by-week structure is available to members and standalone buyers.</p>` : ""}
  </article>
</main>`,
      jsonLd,
    };
  }

  if (route.path === "/blog") {
    const articles = Array.isArray((route.payload as any)?.articles)
      ? ((route.payload as any).articles as any[])
      : [];
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": canonical,
      name: "SmartyGym Fitness Blog Articles",
      description: route.description,
      url: canonical,
      author: person(),
      publisher: { "@type": "Organization", name: ORG.name, url: ORG.url },
      inLanguage: "en-GB",
      blogPost: articles.slice(0, 50).map((article) => ({
        "@type": "BlogPosting",
        headline: article.title,
        url: `${BASE_URL}/blog/${article.slug}`,
        description: article.excerpt,
        articleSection: article.category,
        author: person(),
        datePublished: article.published_at,
        dateModified: article.updated_at || article.published_at,
      })),
    });
    jsonLd.push(
      breadcrumb([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
      ]),
    );
    const articleList = articles
      .slice(0, 80)
      .map(
        (article) => `<li>
          <a href="/blog/${attrEscape(String(article.slug || ""))}">${htmlEscape(String(article.title || ""))}</a>
          ${article.category ? `<span>${htmlEscape(String(article.category))}</span>` : ""}
          ${article.excerpt ? `<p>${htmlEscape(String(article.excerpt))}</p>` : ""}
        </li>`,
      )
      .join("");
    return {
      bodyHtml: `
<main class="seo-prerender seo-blog-index">
  <article>
    <header>
      <h1>Fitness Blog Articles by Haris Falas</h1>
      <p class="seo-excerpt">${htmlEscape(route.description)}</p>
      <p>Human-written fitness, nutrition, recovery and healthy aging articles by Sports Scientist <a href="/coach-profile">Haris Falas</a>.</p>
    </header>
    <section class="seo-section">
      <h2>Latest SmartyGym Articles</h2>
      <ul class="seo-article-list">${articleList}</ul>
    </section>
  </article>
</main>`,
      jsonLd,
    };
  }

  // Static / category pages — a clean, crawlable shell.
  // Tool routes get extra WebApplication + FAQPage schema so the static
  // prerendered HTML carries them (not just client-side after hydration).
  if (route.path.startsWith("/tools/") || route.path === "/tools") {
    const toolFaq = TOOL_FAQS[route.path];
    if (toolFaq) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "@id": canonical,
        name: route.title.replace(/\s*\|\s*SmartyGym.*$/, "").trim(),
        description: route.description,
        url: canonical,
        applicationCategory: "HealthApplication",
        applicationSubCategory: "Fitness Calculator",
        operatingSystem: "Web Browser",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        author: person(),
        creator: { "@type": "Person", name: AUTHOR.name },
        provider: { "@type": "Organization", name: ORG.name, url: ORG.url },
        publisher: { "@type": "Organization", name: ORG.name, url: ORG.url },
        inLanguage: ["en-GB", "en-US"],
      });
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: toolFaq.map((q) => ({
          "@type": "Question",
          name: q.q,
          acceptedAnswer: { "@type": "Answer", text: q.a },
        })),
      });
    }
  }

  jsonLd.push({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": canonical,
    url: canonical,
    name: route.title,
    description: route.description,
    isPartOf: { "@type": "WebSite", name: ORG.name, url: ORG.url },
    publisher: { "@type": "Organization", name: ORG.name, url: ORG.url },
  });
  return {
    bodyHtml: `
<main class="seo-prerender seo-page">
  <article>
    <header>
      <h1>${htmlEscape(route.title.replace(/\s*\|\s*SmartyGym.*$/, ""))}</h1>
      <p class="seo-excerpt">${htmlEscape(route.description)}</p>
    </header>
    <p>This page is part of <a href="/">SmartyGym</a>, the online fitness platform by Sports Scientist <a href="/coach-profile">Haris Falas</a>. 100% human-designed training — no AI-generated workouts. Often searched as SmartGym, Smartgym or Smart Gym — you are in the right place; not affiliated with smartgym.com.</p>
    <nav class="seo-nav" aria-label="Explore SmartyGym">
      <ul>
        <li><a href="/workout">Smarty Workouts</a></li>
        <li><a href="/trainingprogram">Smarty Training Programs</a></li>
        <li><a href="/workout/wod">Workout of the Day</a></li>
        <li><a href="/blog">SmartyGym Blog</a></li>
        <li><a href="/tools">Smarty Tools</a></li>
        <li><a href="/exerciselibrary">Exercise Library</a></li>
      </ul>
    </nav>
  </article>
</main>`,
    jsonLd,
  };
}

/** Inject route-specific SEO into the static index.html template. */
export function applyHeadOverrides(
  templateHtml: string,
  route: SeoRoute,
): string {
  const canonical = canonicalUrlFor(route.path);
  const title = route.title;
  const description = route.description;
  const image = safeImg(route.image);

  let html = templateHtml;

  // Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(title)}</title>`);

  // Description
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${attrEscape(description)}" />`,
  );

  // Keywords (per-page, from seo_metadata when present)
  if (route.keywords && route.keywords.length) {
    const kw = route.keywords.join(", ");
    if (/<meta\s+name=["']keywords["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']keywords["'][^>]*>/i,
        `<meta name="keywords" content="${attrEscape(kw)}" />`,
      );
    } else {
      html = html.replace(
        /<\/head>/i,
        `  <meta name="keywords" content="${attrEscape(kw)}" />\n</head>`,
      );
    }
  }

  // Canonical
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${attrEscape(canonical)}" />`,
    );
  } else {
    html = html.replace(
      /<\/head>/i,
      `  <link rel="canonical" href="${attrEscape(canonical)}" />\n</head>`,
    );
  }

  // Open Graph
  const ogReplacements: Array<[RegExp, string]> = [
    [/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${attrEscape(title)}" />`],
    [/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${attrEscape(description)}" />`],
    [/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${attrEscape(canonical)}" />`],
    [/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${attrEscape(title)}" />`],
    [/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${attrEscape(description)}" />`],
  ];
  const ogType =
    route.kind === "blog-article" || route.kind === "workout" || route.kind === "program"
      ? "article"
      : "website";
  ogReplacements.push([
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="${ogType}" />`,
  ]);

  for (const [re, repl] of ogReplacements) {
    if (re.test(html)) html = html.replace(re, repl);
    else html = html.replace(/<\/head>/i, `  ${repl}\n</head>`);
  }

  if (image) {
    if (/<meta\s+property=["']og:image["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta\s+property=["']og:image["'][^>]*>/i,
        `<meta property="og:image" content="${attrEscape(image)}" />`,
      );
    } else {
      html = html.replace(
        /<\/head>/i,
        `  <meta property="og:image" content="${attrEscape(image)}" />\n</head>`,
      );
    }
    if (/<meta\s+name=["']twitter:image["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']twitter:image["'][^>]*>/i,
        `<meta name="twitter:image" content="${attrEscape(image)}" />`,
      );
    } else {
      html = html.replace(
        /<\/head>/i,
        `  <meta name="twitter:image" content="${attrEscape(image)}" />\n</head>`,
      );
    }
  }

  return html;
}

export function injectJsonLd(html: string, blocks: unknown[]): string {
  if (!blocks.length) return html;
  const tags = blocks
    .map(
      (b) =>
        `<script type="application/ld+json" data-prerender="1">${JSON.stringify(b)}</script>`,
    )
    .join("\n");
  return html.replace(/<\/head>/i, `${tags}\n</head>`);
}

export function injectBody(html: string, bodyHtml: string): string {
  // The shell ships <div id="root"></div>. We embed the pre-rendered HTML
  // inside it so Google sees real content. React's createRoot replaces this
  // node's children on hydration, so users still get the full app.
  return html.replace(
    /<div id="root">\s*<\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );
}