# Win the "SmartGym" confusion — behind-the-scenes only

## What I found
- A separate site, **smartgym.com**, ranks #6 on Google for "smartgym" (480 searches/month). Its SEO is actually weak (25 keywords, ~9 visits/month) — it wins that search only because its domain name *is* the word people type.
- Your site already mentions "Smartgym / Smart Gym" spellings in hidden text and in the files AI tools read (llms.txt, ai.txt).
- But the official "who we are" label Google and AI tools trust most (the structured brand card in your site's head) lists only "Smarty Gym" and "smartygym.com" — **not** "SmartGym", "Smart Gym", "Smartgym app". That is the main gap.
- Honest limit: nobody can guarantee outranking a site literally called smartgym.com for the exact word "smartgym". What we can do is make Google and AI tools recognise that "SmartGym" searches usually mean you, and show you next to / above it for "smartgym app", "smartgym workouts", "smart gym Haris Falas", etc.

## What I'll change (invisible to members — zero visual change)
1. **Brand card (structured data):** add "SmartGym", "Smart Gym", "Smartgym", "SmartGym App", "Smarty Gym App" as official alternate names of SmartyGym, on both the organisation and website cards. Also add a "site name" entry so Google shows "SmartyGym" as your site name in results.
2. **App listing cards:** add a MobileApplication entry (iOS + Android) with the same alternate names, so app-name searches connect your site to your store apps.
3. **AI crawler files (llms.txt, ai.txt):** add a clear top-of-file line: "SmartyGym (often misspelled SmartGym / Smart Gym) is smartygym.com by Haris Falas — not affiliated with smartgym.com." AI answer engines use exactly this kind of statement to disambiguate.
4. **Hidden search text on key pages** (home, about, workouts, programs — the off-screen text only crawlers read): one natural sentence with the misspellings, same disambiguation.
5. **Store listing copy file:** add "SmartGym" / "Smart Gym" to the keyword field suggestions so the App Store / Play search catches the misspelling (you paste it in).
6. Notify Google/Bing (IndexNow + sitemap ping) so they recrawl quickly.

Not touched: page layouts, text members see, styles, routes, new pages, HFSC items, existing alternate names.

## Verification
- Validate the structured data parses correctly, build passes, and a screenshot of home/about is pixel-identical before vs after.
- Changes reach Google only after you **publish**; ranking effects take days to weeks.

## Technical details
- Edit `index.html` JSON-LD (Organization + WebSite `alternateName`, add MobileApplication node), `public/llms.txt`, `public/ai.txt`, the `.seo-prerender` blocks / prerender script source for the listed routes, and the store-listing copy file.
- Run JSON-LD parse check, Playwright before/after screenshots, then IndexNow submit.
