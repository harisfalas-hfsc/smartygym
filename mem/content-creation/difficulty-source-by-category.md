---
name: Difficulty source by category
description: In strength/hypertrophy/conditioning, difficulty is load-sets-reps-rest-density, never exotic exercise variations; the library difficulty tag no longer filters those pools
type: feature
---

Doctrine §16 — where difficulty comes from:

- STRENGTH, MUSCLE BUILDING, CARDIO, METABOLIC, CALORIE BURNING, CHALLENGE:
  difficulty is a PRESCRIPTION variable (load, sets, reps, tempo, rest, density,
  progression). The library's per-exercise difficulty tag must NOT remove common
  movements from the pool. Advanced sees the whole legal pool (advanced +
  intermediate + beginner); Intermediate sees intermediate + beginner; Beginner
  stays beginner. Harder material is never pushed downward.
- PILATES, MOBILITY & STABILITY, RECOVERY, MICRO-WORKOUTS: difficulty IS the
  movement, so the tag still filters the tier exactly.

Code: `PRESCRIPTION_DIFFICULTY_CATEGORIES`, `difficultyFiltersSelection()`,
`allowedDifficultyTiers()` in `supabase/functions/_shared/exercise-selection.ts`;
applied in `workout-engine/pool.server.ts` (step 3), `program-exercise-picker.ts`
(`filterLibraryForProgram`) and stated in the generation prompt.

**Why:** an Advanced full-gym chest session was built from guillotine bench
press, flies on a stability ball and plyo push-ups, because every normal
movement (bench press, pec deck, chest press machine, cable crossover, lat
pulldown) is tagged beginner/intermediate in the library. Advanced means heavier
and denser on the same recognisable lifts, not circus variations.
