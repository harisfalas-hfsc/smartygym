---
name: Billing Cron Job Registry
description: The complete set of billing automations, their schedules, and the rule that scheduling must always be verified against cron.job
type: feature
---

## Verification rule (important)

An edge function existing in `supabase/functions/` does **not** mean it runs.
Before stating any billing automation is working, verify with:

```sql
select m.job_name, j.jobid is not null as scheduled, j.active
from public.cron_job_metadata m
left join cron.job j on j.jobname = m.job_name
where m.category = 'billing';
```

On 28 Jul 2026 an audit found five billing functions written but **never scheduled**,
so none had ever run. All are now registered and confirmed active.

## Registered billing jobs (verified 28 Jul 2026)

| Job | Schedule | Edge function | Purpose |
|---|---|---|---|
| `sync-stripe-subscriptions-6h` | `15 */6 * * *` | `sync-stripe-subscriptions` | Reconciles plan, status and period dates against live Stripe |
| `check-failed-renewals-job` | `0 */6 * * *` | `check-failed-renewals` | Detects failed renewal charges and notifies |
| `auto-finalize-stripe-invoices-4h` | `40 */4 * * *` | `auto-finalize-draft-invoices` | Finalizes draft / force-pays open renewal invoices |
| `send-renewal-reminders-daily` | `0 9 * * *` | `send-renewal-reminders` | 3-days-before renewal notice (email + dashboard) |
| `expire-subscriptions-daily` | `0 3 * * *` | `expire-subscriptions` | Downgrades expired admin-granted grants only |
| `send-subscription-expired-daily` | `0 10 * * *` | `send-subscription-expired-notifications` | Notifies members whose access just ended |
| `backfill-subscription-payment-methods-weekly` | `0 4 * * 0` | `backfill-subscription-payment-methods` | Ensures every active subscription has a default card |

All are invoked via `net.http_post` with the `x-cron-secret` header.

## Template dependencies

`send-renewal-reminders` aborts silently if either is missing:
- an active `automation_rules` row with `automation_key = 'subscription_expiration'`
- an active `automated_message_templates` row with `message_type = 'renewal_reminder'` (placeholders `{planName}`, `{date}`)

The `renewal_reminder` template did not exist until 28 Jul 2026 and was created then.

## Known data hazard

Stripe's current API stores `current_period_start/end` on the **subscription item**,
not the subscription root. Any code reading `sub.current_period_end` directly will
write NULL. Always fall back: `sub.items.data[0].current_period_end ?? sub.current_period_end`.
This caused every subscription row to show "not available" in the admin panel.
