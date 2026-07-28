---
name: Stripe Recurring Billing Hardening
description: Multi-layer defense ensuring monthly Gold and yearly Platinum renewals always auto-charge without manual intervention
type: feature
---
## Stripe Recurring Billing — Verified Architecture

VERIFICATION RULE: never claim a cron job or Stripe setting is active from code or
from this note alone. Confirm against `cron.job` (scheduled AND active) and against
the live Stripe object. Code existing on disk does NOT mean it is scheduled.

Five layers guarantee every active subscription auto-charges on renewal:

### Layer 1: Checkout (prevention)
`supabase/functions/create-checkout/index.ts` includes:
- `payment_method_collection: 'always'` — card captured upfront
- `subscription_data.payment_settings.save_default_payment_method: 'on_subscription'` — added 28 Jul 2026 after an audit found it MISSING (it had only ever been described in this note, never implemented). A missing default PM is the #1 cause of stuck draft renewal invoices.

### Layer 2: Stripe webhook (real-time sync)
`supabase/functions/stripe-webhook/index.ts` handles:
- `checkout.session.completed` → activates subscription
- `customer.subscription.updated` → syncs status changes
- `customer.subscription.deleted` → handles cancellation
- `invoice.payment_succeeded` → extends `current_period_end` in DB
- `invoice.payment_failed` → flags subscription for renewal-reminders

### Layer 3: Reconciliation cron (every 6 hours)
`sync-stripe-subscriptions-6h` → `sync-stripe-subscriptions` edge function:
- Reconciles plan_type, status, `current_period_start/end`, `cancel_at_period_end` for every row with a Stripe customer id
- Necessary because `check-subscription` only runs when that specific user logs in, so dormant customers' rows go stale
- Skips `subscription_source = 'admin_grant'` rows so complimentary access is never overridden
- Timestamp comparison is by epoch value, not string (Postgres `+00` vs Stripe ISO `Z` would otherwise mark every row changed each run)

### Layer 4: Self-healing cron (every 4 hours)
`auto-finalize-stripe-invoices-4h` cron → `auto-finalize-draft-invoices` edge function:
- Layer A: finalizes any DRAFT subscription_cycle/subscription_update invoices
- Layer B: force-pays any OPEN unpaid renewal invoices via `stripe.invoices.pay()`
- Catches transient Stripe hiccups within 4 hours max

### Layer 5: Weekly preventive backfill (Sundays 04:00 UTC)
`backfill-subscription-payment-methods-weekly` cron → `backfill-subscription-payment-methods` edge function:
- Was NOT actually scheduled until 28 Jul 2026 despite this note claiming otherwise; now registered and verified
- Walks every active/trialing subscription
- For any without `default_payment_method`, finds an attached card and sets it on both customer.invoice_settings AND subscription
- Idempotent — safe to run any time

### Manual investigation history
- Manolis Christofi (`cus_U7CTdKqa9gEq3U`, `sub_1T8yQgIxQYg9inGKcXc34Sa9`): April 18 2026 renewal required manual finalization. Backfill confirmed default PM was already set; the stuck invoice was a one-off Stripe transient. Layer 3 now catches this within 4 hours.
