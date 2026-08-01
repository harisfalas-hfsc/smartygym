## Goal

When a platform toggle is OFF in Admin → Payments, **no purchase of any kind** is possible from that platform — phone or tablet, native app or any browser, normal or desktop-site mode. When it is ON, everything works exactly as it does today and Stripe opens normally.

## Verified current state

- `payments_enabled_ios` and `payments_enabled_android` both exist in `system_settings` and are currently `true`.
- Detection in `src/utils/platform.ts`: iOS = UA contains `iPhone|iPad|iPod` or Capacitor native iOS; Android = UA contains `Android` or Capacitor native Android; everything else = `web` (always sells).
- Client enforcement via `usePaymentsEnabled` in `SmartyPremium`, `SmartyCorporate`, `PurchaseButton`, `ProductCard`.
- Server enforcement via `_shared/platform-payments.ts`, called by all four checkout functions (`create-checkout`, `create-lifetime-checkout`, `create-corporate-checkout`, `create-individual-purchase-checkout`), keyed on the `x-smarty-platform` header.

**Gaps against what you want:**
1. iPad Safari on iPadOS 13+ reports a Mac user agent → currently treated as `web` and can still buy.
2. Any iPhone/Android phone in "Request Desktop Site" mode drops its mobile identifier → currently treated as `web` and can still buy.
3. If the settings row can't be read, the client fails **open** (shows the buy button) instead of closed.
4. The disabled message only mentions upgrading, not standalone workout/program purchases.

## Plan

### 1. Detect every phone and tablet, in every mode

Rewrite detection in `src/utils/platform.ts` so a device is classified as `ios` or `android` regardless of browser or desktop-site mode:

**iOS** is true when any of these hold:
- Capacitor native platform is `ios`
- UA matches `iPhone|iPad|iPod`
- UA matches `Macintosh|Mac OS X` **and** `navigator.maxTouchPoints > 1` — this is the iPadOS/iOS desktop-mode signature; a real Mac reports 0 touch points

**Android** is true when any of these hold:
- Capacitor native platform is `android`
- UA matches `Android`
- UA matches `Linux` with `Mobile`/`Silk`, or the browser reports `navigator.userAgentData.mobile === true` on a non-Apple platform — this covers Chrome/Samsung/Firefox desktop-site mode on Android and Kindle/Fire tablets

Because Chromium's `userAgentData.mobile` and `maxTouchPoints` are not spoofed by desktop-site mode, this closes both the iPad and the desktop-mode escape routes. A genuine laptop or desktop keeps selling.

`platformHeader()` keeps sending the resulting `ios` / `android` / `web` value so the server enforcement stays in lockstep.

### 2. Fail closed

In `src/hooks/usePaymentsEnabled.ts`: on `ios` or `android`, if the settings read errors or returns no row, show the notice rather than the buy button. Same on the server — if the lookup fails for a mobile platform, return the 403 instead of allowing through. `web` is unconditionally enabled.

### 3. New message, covering all purchase types

`src/components/PaymentsDisabledNotice.tsx` — one message for iOS and Android, presented as a proper bordered notice rather than muted grey text:

> **In-app purchases are not available.**
> Memberships, workouts and training programs are purchased on our website. Visit **smartygym.com** from any computer to subscribe or buy, then sign in here with the same account and your access appears automatically.

`PAYMENTS_DISABLED_MESSAGE` in `supabase/functions/_shared/platform-payments.ts` gets the same wording so the server 403 and any error toast match exactly.

### 4. Full sweep of purchase entry points

Re-audit every place a purchase can start and confirm each one is gated by the hook and sends the platform header: `SmartyPremium`, `SmartyCorporate`, `PurchaseButton`, `ProductCard`, plus the homepage/mobile-menu Premium CTAs that route into `SmartyPremium`. Anything unguarded gets the notice added.

### 5. Verification

Playwright runs with the toggles OFF, using these profiles: iPhone Safari, iPhone desktop-site UA, Android Chrome, Android desktop-site UA, iPad Safari (Mac UA + touch points), and real desktop Chrome. Expected: notice on the five mobile/tablet profiles, working Stripe CTA on desktop. Then toggles ON and re-run: all six reach Stripe. Typecheck after edits; redeploy the four checkout functions.

### Technical notes

Files: `src/utils/platform.ts`, `src/hooks/usePaymentsEnabled.ts`, `src/components/PaymentsDisabledNotice.tsx`, `supabase/functions/_shared/platform-payments.ts` (+ redeploy of the four importing functions). No database schema or Stripe changes; toggle values untouched.
