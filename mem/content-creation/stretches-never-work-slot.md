---
name: Stretches are never work-slot exercises
description: Stretch/mobility/joint-circle drills may never be dosed as work in Main Workout or Finisher outside MOBILITY & STABILITY, RECOVERY and PILATES
type: feature
---
A stretch, joint circle, CARs drill, foam-rolling or breathing cue is preparation or
recovery vocabulary. It belongs in 🔥 Activation or 🧘 Cool Down and may NEVER be
dosed as work (reps/sets/time) inside 💪 Main Workout or ⚡ Finisher.

Exempt categories (stretch IS their training content): MOBILITY & STABILITY, RECOVERY, PILATES.
Every other category — STRENGTH, MUSCLE BUILDING, CARDIO, METABOLIC, CALORIE BURNING,
CHALLENGE, MICRO-WORKOUTS — is a hard error.

Single source: `workSlotPrepViolation()` in
`supabase/functions/_shared/workout-engine/doctrine.ts` (uses `WORK_SLOT_PREP_RE` =
`STRETCH_RE` + `CONDITIONING_LOW_STIMULUS_RE`). Enforced in three places:
pool selection (`pool.server.ts`), generation validation (`validate.server.ts`),
and the compliance auditor (`compliance.ts`, code `WORK_SLOT_PREP`).

Applied live 2026-09-19: 32 workouts, 69 content-only swaps, backup reason
`pre-work-slot-stretch-repair-2026-09-19`.
