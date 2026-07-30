# SmartyGym — Full-System QA Audit Report
Date: 2026-07-30 · Mode: independent QA, no UI/copy/pricing/business-logic changes

## Summary
| Severity | Count |
|---|---|
| Critical | 1 (fixed) |
| High | 2 |
| Medium | 4 |
| Low | 3 |

Fixed: 1 · Flagged for your review: 8 · Blocked (needs your credentials/live gateway): 3

---

## Bugs FIXED (1)

### [CRITICAL — FIXED] Shop page returned zero products for every user
- **What:** `public.shop_products` had the RLS policy *"Public can view shop products"* (`USING true`), but the table had **no SELECT grant** for `anon` or `authenticated`. Every read returned `401 / 42501 permission denied for table shop_products`.
- **Repro (before fix):** open `/shop` as visitor or logged-in user → console shows two `401` errors, product grid empty.
- **Fix:** migration `GRANT SELECT ON public.shop_products TO anon, authenticated;` — grants only, no policy/logic change.
- **Verified after fix:** anonymous REST read returns 200; `/shop` renders with no permission errors.
- **Why safe:** the existing policy already declared this data public; the grant just lets the policy work.

---

## Flagged, NOT changed (needs your decision)

### [HIGH] No `<h1>` on 7 main pages (SEO)
`/workout`, `/trainingprogram`, `/tools`, `/exerciselibrary`, `/blog`, `/community`, `/contact` render **no H1 at all** — desktop `DesktopPageIntro` uses `<h2>`, and the mobile cards also use `<h2>`.
- **Repro:** load any of those pages → `document.querySelector('h1')` is null.
- **Why not auto-fixed:** promoting `<h2>`→`<h1>` in `DesktopPageIntro.tsx` would create a *duplicate* H1 on `/daily-ritual` (which already has one), so the correct fix needs a per-page decision. Recommend: make the page title the H1 on both mobile and desktop and drop the ritual page's extra H1.

### [HIGH] Anonymous visitors trigger permission errors on `/community`
`workout_comments` is authenticated-only by policy (correct), but the Community page queries it while logged out → `42501 permission denied` in console and comments silently empty.
- **Repro:** open `/community` logged out → console: `Error fetching comments: permission denied for table workout_comments`.
- **Recommended fix (your call):** skip the comments query when there is no session, or make comments publicly readable. Both are product decisions, so untouched.

### [MEDIUM] `/wod-archive` never reaches network-idle
Page renders correctly (H1 "WOD ARCHIVE") but continuous network activity means it never settles within 25s. Suggests a polling/refetch loop worth profiling. No user-visible break observed.

### [MEDIUM] Test suite not runnable end-to-end
`vitest run` → 8 files pass (55 tests), 6 fail before executing:
- 3 Deno edge-function tests (`supabase/functions/**`) fail with `Only URLs with a scheme in: file and data are supported… Received protocol 'https:'` (Deno `https:` imports under Node/Vitest).
- 3 Playwright specs in `e2e/` are picked up by Vitest and crash (`playwright/lib/common/testType.js`).
Fix = test-config scoping, not app code; left alone to avoid touching config you may rely on.

### [MEDIUM] Email success logging is incomplete
`email_delivery_log` records the check-in reminders, new-content, weekly-motivation, SEO and health-audit emails, but **morning WOD / combined-morning sends are not written there** even though `notification_audit_log` marks them successful. Delivery reporting will under-count. Behaviour, not breakage — flagged only.

### [MEDIUM] 38 profiles have no `user_subscriptions` row
Current split: 1 `lifetime` active, 1 `legacy_premium` active (grandfathered €6.99), 19 `free` active, 3 `free` canceled — against 62 profiles. App logic treats a missing row as free (correct behaviour), but any admin metric that counts *rows* rather than *users* will under-report signups.

### [LOW] Cron job naming vs schedule mismatch
`cron-heartbeat-hourly` is registered as `0 12 * * *` (daily at noon), not hourly. Runs fine; the name is misleading.

### [LOW] Accessibility console errors on every page
`DialogContent requires a DialogTitle` + `Missing Description or aria-describedby` fire on the homepage and most pages (Radix dialog used by the Smarty Coach / popups). Screen-reader accessibility issue, no functional break.

### [LOW] React DOM prop warning on homepage
`React does not recognize the %s prop on a DOM element` on `/`. Harmless but indicates a prop leaking onto a DOM node.

---

## Section results

### 1. Front-end (visitor persona — fully tested)
- Crawled 15 seed pages + all 24 discovered internal links: **zero broken links, zero 404s** on real routes.
- Verified real route names: `/daily-ritual`, `/smarty-premium`, `/termsofservice` (earlier `/dailysmartyritual`, `/pricing`, `/terms` 404s were non-existent URLs, not app bugs — no link in the app points at them).
- Anonymous data access verified table-by-table: `blog_articles`, `exercises`, `admin_workouts`, `admin_training_programs`, `promo_banners`, `testimonials` all read correctly; `daily_smarty_rituals` correctly authenticated-only; `shop_products` was broken (fixed above).
- `/userdashboard` and `/admin` correctly redirect anonymous users to `/auth`.
- **Not tested:** free-user and premium-subscriber personas — creating accounts requires signing up against production auth and a live €9.99 card. See Blocked.

### 2. Subscription & payments
- Live Stripe price `price_1Tr93GIxQYg9inGKhIZLvoB2` confirmed **€9.99, recurring monthly** — matches `src/config/pricing.ts`.
- Two Stripe subscriptions exist: one grandfathered €6.99 (matches the DB `legacy_premium` row) and one canceled. **No orphaned subscriptions** — Stripe and the database agree.
- `user_has_active_premium_access` correctly grants for `lifetime`, `legacy_premium`, `premium`, admin, and corporate members.
- Retired price IDs are hard-blocked in `create-checkout` (HTTP 410) and duplicate-subscription checkout is blocked.
- **Blocked:** end-to-end checkout, renewal-cycle, declined-card, cancellation and expiry-downgrade tests all require charging a live card on the production Stripe account. Not safe to execute unattended.

### 3. Emails & notifications
Last 7 days, all `sent`, no failures: check-in reminders 812, new-content 232, weekly motivation 49, SEO weekly report 7, system health audit 7.
- **Blocked:** confirming inbox arrival, spam placement, and the exact content of billing emails (receipt, renewal reminder, failed payment, expiry, cancellation) requires a real mailbox and live billing events.

### 4. Cron jobs
All 40 registered jobs are live and running on schedule. Weekly jobs last fired 2026-07-26/27 as expected; 5-minute and hourly jobs are current. **Zero jobs with consecutive failures.** Verified in edge logs: `process-pending-notifications`, `send-new-content-notifications`, `send-scheduled-emails`, `send-renewal-reminders`, `run-system-health-audit` all completing cleanly. Only issue = the naming mismatch above.

### 5. Admin panel
- Admin routes are correctly inaccessible to non-admins (redirect to `/auth`).
- **Blocked:** toggling admin settings and cross-checking revenue/subscriber/churn figures in the admin dashboard requires an admin session in production; changing settings there would alter live configuration, which is out of scope for this audit.

---

## Blocked items (need you)
1. Live premium checkout, renewal, failed-payment, cancellation and expiry flows — needs a live/sandbox card on the production Stripe account.
2. Actual email inbox delivery and spam placement for billing emails.
3. Admin-panel settings persistence and revenue-figure cross-check — needs an admin session and would mutate production settings.

## Change log
| Change | Type | Reason |
|---|---|---|
| `GRANT SELECT ON public.shop_products TO anon, authenticated` | DB migration | Policy already declared products public; missing grant made `/shop` empty for all users |

Nothing else was modified.
