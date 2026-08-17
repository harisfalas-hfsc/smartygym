# Global Free Access Mode (App Store submission switch)

Yes, this is doable and it is safe to reverse. The key idea: **nothing is deleted or written to subscriptions, purchases or Stripe**. The switch is a single setting row that the app reads at runtime. Flip it on = everyone signed in sees everything, all purchase/premium UI disappears. Flip it off = the app goes back to reading the exact same Stripe/subscription data it always did, untouched.

## What the switch does when ON

- Any **signed-in** user is treated as premium (visitors/guests still see only public pages, exactly as today).
- The Smarty Premium page, Corporate pricing page and all "Upgrade / Join Premium / Buy" buttons are hidden, and their routes redirect to the dashboard.
- Premium badges, locks and "Included in Premium" labels stop rendering.
- Checkout backend functions refuse to start any checkout session (403), on every platform including the website — so a reviewer cannot reach a payment page by URL either.

## What it does NOT do

- Does not cancel, pause or modify any Stripe subscription.
- Does not change `user_subscriptions`, `user_purchases`, or `user_roles`.
- Does not stop renewals or webhooks — existing paying members keep billing normally in the background, and when you switch back their premium simply shows again.

## Where you control it

New card inside the existing **Admin → Payments** section (same place as the iOS/Android toggles):
a single master toggle "Free Access Mode — all content free for signed-in users", with a confirmation dialog and a plain-language note about what it hides.

## Your questions answered

- **Is the Smarty Premium page hidden?** Yes. While the mode is ON, `/smarty-premium` and the corporate pricing page are removed from all menus and, if someone types the URL, they redirect to the dashboard. Every other reference is hidden too — "Join Premium" CTAs, gold upgrade buttons, premium badges and locks, the "purchases are made on smartygym.com" notice, and pricing copy in FAQ/marketing pages visible inside the app.
- **Does pressing the button back restore everything?** Yes, exactly as before. The toggle is only an overlay; when it is OFF every path runs the same code as today, reading the same Stripe/subscription data, which is never modified while the mode is ON.
- **Immediate, or do I do it myself?** I build and ship the toggle **OFF**, so nothing changes for your live customers on release. Flipping it is your action from Admin → Payments, and it takes effect immediately for everyone — no redeploy and no publish needed, since the setting is read live from the database on page load.

## Technical section

1. **Setting**: new `system_settings` row `free_access_mode` (boolean). Public read (anon + authenticated), admin-only write, same pattern as `payments_enabled_ios`.
2. **Client**: new `useFreeAccessMode()` hook (same shape as `usePaymentsEnabled`). `AccessControlContext` reads it once at init and, when true, resolves any authenticated user's `userTier` to `premium` (guests unchanged). Because every gate in the app already flows through `userTier` / `canAccessContent` / `canInteract` / `AccessGate` / `PremiumContentGate`, this one change unlocks all workouts, programs, rituals, tools and interactions with no per-page edits.
3. **Purchase/premium UI**: gate `PurchaseButton`, premium CTA blocks, `SmartyPremium`, `/corporate` pricing and nav links on the flag. Routes render a redirect when the flag is on.
4. **Server enforcement**: extend `supabase/functions/_shared/platform-payments.ts` with a `free_access_mode` check so `create-checkout`, `create-individual-purchase-checkout`, corporate checkout and the customer-portal function return 403 while it is on. Fail-open only for `web` when the flag is off, i.e. current behaviour is unchanged.
5. **Content read path unchanged**: entitled reads still go through the base tables; we are only widening who counts as entitled, so no paywall-stripped RPC path is involved.

## Why reversing is safe

- The flag is read-only overlay logic: with it off, every code path is byte-identical to today's behaviour (a single `if (freeAccessMode)` short-circuit that is skipped).
- No migration touches existing rows; no data is written when the flag flips.
- Verification after flipping back: sign in as a free account and confirm premium content is locked and the purchase button returns; sign in as a paying account and confirm access is intact; confirm `create-checkout` returns a session URL again.

## The Apple "external purchase" point — YES, it is fixed in this plan

Apple rejects apps that even *mention or link to* buying somewhere else. That is exactly what your rejection screenshot shows: the "In-app purchases are not available… visit smartygym.com" notice.

So this is not a warning for you to handle — it is part of the work:

- The "In-app purchases are not available / purchased on our website / visit smartygym.com" notice is hidden while the mode is ON.
- Every price string (€9.99/month, corporate €699–€999, "Billed monthly", "Cancel anytime") is hidden while the mode is ON.
- Any FAQ, marketing or dashboard copy that mentions buying, subscribing, upgrading or smartygym.com purchases is hidden while the mode is ON.
- No external purchase link of any kind remains reachable inside the app.

All of it comes back automatically, unchanged, the moment you switch the mode OFF.
