# Compliance Audit & Repair for the 536 Existing Workouts

Short answer: **yes, this can be done** — but as two separate jobs, not one. First a free audit that judges every workout against today's rules, then a repair job that only touches what actually fails, cheapest method first.

## Why two jobs

The audit costs nothing and changes nothing. It tells us exactly how many workouts fail, on what, and which ones need a paid AI rewrite. Without it, any cost estimate is guesswork. With it, you decide what to repair and approve the spend with real numbers in front of you.

## Job 1 — Audit (free, read-only, no risk)

Runs every published workout through the same rule code the generators use today:

- Structure: the strict 5-section format and the content wrapper
- Exercise selection: banned movements (bosu-loaded, pistol/elevated single-leg squats, lever/gymnastic complexity, unstable surfaces), and whether exercises sit in the right category pool
- Category and format rules: sets-and-reps-only categories, no machines inside Tabata/AMRAP/For Time, Pilates and Micro restrictions, Challenge restrictions
- Prescriptions: sets, reps, tempo, rest present on every line
- Duration: prescribed work vs the stated duration
- Exercise density and library linking

Output: a report per workout with a pass/fail and the exact reasons, plus a summary by category, and a split into "fixable automatically" vs "needs a rewrite". Nothing is written to your live content.

Cost: 0 credits (no AI). Time: minutes.

## Job 2 — Repair (only after you see the audit)

Three tiers, applied in this order so the cheap ones absorb most of the work:

1. **Automatic repair, no AI** — formatting, section structure, wrapper, missing prescriptions that can be derived, exercise re-linking, swapping a banned exercise for its simplest legal equivalent. Free, deterministic, reversible.
2. **AI rewrite of a single section** — when only one part is wrong (e.g. an illegal Main Workout block for the format). One short AI call instead of a full workout.
3. **Full AI regeneration** — only for workouts that fail on structure and content together. Keeps the name, category, difficulty, duration, equipment and price; replaces the body.

Every repair runs in small batches with a pause between them, so you can stop at any point.

## Cost and time

Rough, to be replaced by exact numbers after the audit:

- Tier 1 (automatic): free. Expect this to cover the majority of older workouts, since most legacy issues are formatting and linking.
- Tier 2/3 (AI): roughly 3–5 credits per workout at current pricing. So if 100 workouts need AI, that is roughly 300–500 credits; if 300 do, roughly 900–1,500.
- Time: audit minutes; automatic repair minutes; AI repair around 40–60 seconds per workout, run in background batches — 100 workouts is roughly 1–2 hours of unattended running.

You approve the AI spend after the audit, and you can cap it (for example: repair Strength and Challenge only, or only the ones failing on banned exercises).

## Safety

- The audit writes nothing.
- Before any repair, every affected workout's current content is copied into a backup table with a timestamp, so any workout or the whole batch can be restored exactly.
- Nothing is deleted and no workout is hidden. Names, categories, prices, Stripe links, images and purchase history are never touched.
- Repairs are validated before saving: a repaired workout that does not pass the rules is not written, it is flagged for review instead.
- Batches are small and stoppable; one failure never cascades.
- Training program generation is not touched at all.

## Technical notes

- Audit and repair reuse the existing engine modules (`validate.server.ts`, `enforce.server.ts`, `pack.server.ts`, `exercise-selection.ts`) — no new rules, no changes to the generators, no new philosophy.
- New edge function `audit-workout-compliance` (read-only) writing results to a new `workout_compliance_audit` table.
- New edge function `repair-workout-compliance` running tiers 1–3 in batches with job tracking, reusing `generateWorkoutContent` for tier 3 so repaired workouts come off the identical engine as new ones.
- New `workout_content_backup` table (workout id, html snapshot, timestamp, job id) plus a restore path.
- Admin UI: a Compliance panel showing the audit summary, failures by rule, and buttons to run tier 1, then approve tier 2/3 batches.

## Proposed first step

Build and run Job 1 only. It costs nothing, and then you get the real numbers — how many of the 536 actually fail, on what, and what the AI portion would cost — before deciding on any repair.
