# Repair the Full Library — One Job, 536 Workouts

One background job repairs everything the audit flagged: 425 not compliant, 109 with minor issues. You press start once; it runs on its own, batch after batch, and you watch progress in the admin panel.

## How the one job runs

- A single job row holds the queue, the position, the counters and the state (running / paused / done). Only one run can be active at a time.
- Each pass takes a small batch of workouts, repairs them, records the outcome, and schedules the next pass. A crash, a timeout or a closed browser does not lose progress — the job resumes exactly where it stopped.
- You can pause and resume at any moment from the panel.
- It stops itself automatically if AI credits run out or AI is blocked, and tells you why. Nothing is half-written.

## What it does to each workout

Cheapest method first, per workout, based on its audit result:

1. **Automatic, no AI (45 workouts)** — corrects exercise names against the library, removes exercise links from the Soft Tissue section, fixes an illegal format label, restores a missing section heading, and strips a Finisher from the categories that must never have one.
2. **Section rewrite with AI (210 workouts)** — when only one section is wrong, only that section is regenerated, through the same engine, same rules, same reference list.
3. **Full content rebuild with AI (176 workouts)** — the workout body is regenerated from its own category, format, difficulty, duration, equipment and focus, on the same engine that builds new workouts today.

After every repair the workout is re-audited. If it does not pass, the original content stays and the workout is marked "needs review" — nothing worse than before is ever saved.

## Safety

- A timestamped copy of the current content is saved before each change; one button restores a workout or the entire job.
- Names, categories, difficulty, duration, prices, Stripe links, images, purchase history and visibility are never touched — only the workout body.
- Training program generation is not touched at all.
- Nothing is deleted or hidden.

## Cost and time

- Tier 1: free.
- Tier 2 and 3: 386 AI repairs, roughly 1,100–1,700 credits in total.
- Roughly 40–60 seconds each, run in bounded batches — about 5–7 hours unattended.
- A hard credit guard: the job pauses and reports instead of silently spending past what is available.

## What you will see

In Admin → Settings → System, under the audit: a Repair panel with a start button, a live progress bar, counters for repaired / unchanged / needs review, and the list of anything that ended in "needs review" so it can be handled individually.

## Technical notes

- New table `workout_repair_jobs` (queue, cursor, counters, status, pause reason) plus reuse of the existing `workout_content_backup` table.
- New edge function `repair-workout-compliance`: single-flight lock, bounded batch per invocation, idempotent per-workout progress, self-scheduled next pass with cooldown, halt on 402/403 and on repeated 429.
- Repairs reuse `generateWorkoutContent`, `enforceWorkout` and the shared `exercise-selection.ts` policy — no new rules, no changes to the generators or to the philosophy.
- Re-verification calls the same `auditWorkout` used by the audit, so the pass criteria are identical.
- Model and settings unchanged from the live generator.
