## Goal

A new **Payments** section in the admin panel where all Stripe configuration lives, plus a per-platform kill switch (iOS / Android) so you can hide in-app purchasing during App Store and Play Store review, then turn it back on after approval.

## Note on old memberships

You have no Gold, Platinum or Lifetime products on sale — they can't be purchased anywhere. Two existing members are still grandfathered on old plans, and the webhook keeps recognising their old price IDs purely so they keep their access. The admin Payments screen will show **only the active product** (Premium Monthly €9.99/mo) and the corporate plans. No legacy clutter.

## How the kill switch behaves

When a platform is toggled **OFF**, every purchase CTA on that platform (Premium membership, standalone workouts, standalone programs, shop, corporate) is replaced with a neutral message:

> "Purchases are managed on our website. Visit smartygym.com to upgrade."

No price, no Stripe button, no checkout link — nothing a reviewer can flag under Guideline 3.1.1. Toggled **ON**, everything works exactly as today.

Web is never affected — it always sells normally.

## What gets built

### 1. Setting storage
Two rows in the existing `system_settings` table:
- `payments_enabled_ios` → true / false
- `payments_enabled_android` → true / false

Readable by everyone (purchase buttons render before login), writable by admins only.

### 2. Admin panel — new "Payments" section
Added to the admin nav with a credit-card icon.

**Platform tabs**
- **iOS** — master toggle + live status badge ("Visible to Apple reviewers: NO / YES") + a short note on Guideline 3.1.1
- **Android** — same toggle and badge for Google Play
- **Web** — informational only, always on

**Stripe Configuration panel**
- Active product: Premium Monthly €9.99/mo, with product ID and price ID
- Corporate plans (Dynamic / Power / Elite / Enterprise) with their price IDs
- Webhook endpoint URL and the events it listens to
- Secret status: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` shown as configured / missing (values never displayed)
- Quick links to the existing Stripe revenue and subscription-sync tools

### 3. Frontend enforcement
A new `usePaymentsEnabled()` hook detects the platform via the existing Capacitor helpers and reads the matching setting. Wired into every purchase entry point:
- `PurchaseButton.tsx` (standalone workouts/programs) — replaces today's blanket iOS hide with the toggle
- `SmartyPremium.tsx` (membership checkout)
- `SmartyCorporate.tsx` / `CorporateAdmin.tsx`
- Shop buy buttons and any premium upsell CTA that routes to checkout

A shared `<PaymentsDisabledNotice />` keeps the wording identical everywhere.

### 4. Server-side enforcement
A UI-only toggle can be bypassed, so each checkout function (`create-lifetime-checkout`, `create-individual-purchase-checkout`, `create-corporate-checkout`, `create-checkout`) will read an `x-smarty-platform` header sent by the client, check the matching setting, and return a clean 403 if that platform is disabled. The payment path genuinely closes, not just the button.

## Technical notes

- No changes to Stripe products, prices, or webhook logic. Pricing stays €9.99/mo.
- Existing premium and grandfathered users are unaffected — the toggle blocks *new purchases only*, never access to owned content.
- Admins get no bypass, so you can see exactly what a reviewer sees on a real device.
- Takes effect instantly with no app rebuild, because the value is read from the backend at runtime — you flip it the moment Apple approves.
- `capacitor.config.ts` and the native projects are untouched.

## Order of work

1. Migration: add the two settings rows plus read/write policies.
2. Build `usePaymentsEnabled()` and `<PaymentsDisabledNotice />`.
3. Build the admin Payments section (Stripe config panel + platform tabs).
4. Wire the hook into all purchase CTAs.
5. Add the platform header and server-side guard to the checkout functions.
6. Verify: toggle iOS off, confirm every purchase surface shows the website message and a forced checkout call is rejected.