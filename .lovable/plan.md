Yes — this is easy and safe. Stripe prices are immutable, so I create **new prices on the existing four products** and point the app at them. No errors expected, no impact on existing corporate customers (they keep billing at their old price until they resubscribe).

## New pricing (yearly)
- Smarty Dynamic (10 users): €399 → **€699**
- Smarty Power (20 users): €499 → **€799**
- Smarty Elite (30 users): €599 → **€899**
- Smarty Enterprise (unlimited): €699 → **€999**

## Stripe work
1. Create four new recurring yearly EUR prices on the existing products (`prod_TZAT...` Dynamic/Power/Elite/Enterprise).
2. Set each new price as the product's default price.
3. Archive the four old prices so they can't be reused for new checkouts.

## Code changes
- `src/config/pricing.ts` — swap the four `corporate_*` price IDs to the new ones.
- `supabase/functions/create-corporate-checkout/index.ts` — same four hardcoded price IDs; redeploy the function.
- `src/pages/SmartyCorporate.tsx` — plan config `price` values and the four `€399/€499/€599/€699` card headlines; also the SEO summary line that says "from €399/year to €699/year".
- `src/components/admin/CorporateBrochure.tsx` — the four printed prices.
- `src/components/admin/analytics/CorporateAnalytics.tsx` — revenue map used for corporate revenue totals.

## Notes
- Existing active corporate subscriptions are untouched; only new checkouts use the new amounts.
- I'll verify after deploy that the checkout session for each plan resolves to the new price.
