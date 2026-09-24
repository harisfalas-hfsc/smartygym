# Competitor SEO update, done out of sight only

Competitors: Fitness Blender, Darebee, Les Mills, Nike Training Club, Freeletics, FIIT, FitOn, BetterMe, Peloton.

## What members will see: nothing, on desktop or mobile
- Zero visible changes across the whole website, desktop and mobile. Layouts, design, styles, visible text, images, buttons, menus, routes and navigation all stay exactly as they are.
- No new pages, no new sections, no new links or banners.
- Everything added is hidden and read only by search engines and AI tools: page head tags, structured data, hidden crawler-only text, and the files AI tools read.
- Your existing SEO setup is kept. Every change only adds to it and never replaces anything.

## Step 1: Research (read-only, no changes)
- For each competitor, use Semrush to pull their top Google keywords and the gaps: keywords they rank for that SmartyGym doesn't.
- Fetch each homepage and a few key pages (workouts, programs, app). Record their title and description patterns, their structured data types (Organization, WebSite, MobileApplication, ExercisePlan, VideoObject, HowTo, BreadcrumbList, Course, Review/AggregateRating and others), and what their AI-crawler files contain.
- Build one keyword list sorted by relevance to SmartyGym. Examples: "free home workouts", "workout app", "no equipment workouts", "HIIT workouts", "workout plan", "strength training program".

## Step 2: Add what's missing, out of sight only
1. **Keywords:** add the relevant competitor keyword phrases to the existing page titles' keyword meta, descriptions where it fits naturally, and the text only search engines read on the home, workouts, programs, blog, tools and exercise library pages.
2. **Structured data:** add only the types competitors use that SmartyGym lacks, based on what Step 1 finds. Likely candidates are `ExercisePlan` on workout pages, `Course` on programs, `HowTo` on exercises, `BreadcrumbList` sitewide, and `SoftwareApplication`/`MobileApplication` offers. Existing entries stay as they are.
3. **Files AI tools read** (llms.txt, llms-full, ai.txt): add a "what SmartyGym offers" section that uses the same kinds of phrases competitors are known for, such as free workouts, a workout app, and structured programs. Also add plain "compared with Fitness Blender / Darebee / Peloton..." lines that stick to facts only.
4. **Sitemap and image data:** check that everything is complete, then ping Google and Bing after you publish.

## Honest limits
- I will not copy competitors' sentences word for word. That is copyright infringement, and Google also penalizes duplicate text. I'll use their keywords and phrase patterns, written in your own voice.
- Some of these are huge brands (Nike, Peloton). Rankings improve over weeks, and there's no guarantee of beating them on broad terms. The realistic wins are specific phrases.

## Checks after the changes
- All structured data parses correctly, and the code check and tests pass.
- Before-and-after screenshots of the home, workouts, programs and blog pages, on both desktop and mobile, are identical. If anything visible differs, it gets rolled back.
- None of this reaches Google until you publish.

## Technical details
- Files: `index.html` JSON-LD and meta, the `.seo-prerender` hidden blocks in the prerender script, per-route Helmet SEO components (additive only), `public/llms.txt`, `public/ai.txt`, `scripts/generate-llms-full.ts`, and the sitemap generator.
- Not touched: visible JSX, CSS, routes, HFSC items, existing schema entries.
