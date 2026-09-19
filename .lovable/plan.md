# Make the conditioning rule universal, then repair every workout

Today the "keep moving, no lying down, no station setup" rule exists **only for Calorie Burning**. Cardio, Metabolic and Challenge have no such rule, so a bench pullover or a hanging movement can still slip into a Cardio or Challenge circuit. That is the gap behind every complaint so far.

## The rule set, written as a trainer would

**Conditioning family — Calorie Burning, Cardio, Metabolic, Challenge**
- Heart rate up, short breaks, continuous repeatable movement.
- Equipment is welcome — swings, snatch-free cleans, thrusters, slams, carries, goblet squats, lunges, ropes, ergometers — as long as the athlete stays on their feet and the movement can restart instantly.
- Never: lying on a bench, seated machine stations, hanging from a bar, racking/unracking, preacher/incline/decline positions, or isolation work (curls, flys, pullovers, lateral raises, kickbacks, shrugs).
- Never: quality/skill movements that collapse under fatigue — windmills, Turkish get-ups, bent press, pistols, handstands, levers.
- Cardio stays aerobic; Metabolic/Challenge may be spicier, but still standing and continuous.

**Strength family — Strength, Muscle Building**
- Sets × reps, explicit load guidance and explicit rest, scaled by difficulty band and available time. Benches, racks and machines are fully legal here.

**Pilates / Mobility & Stability / Recovery**
- Controlled tempo work, prescribed reps or timed holds, no conditioning vocabulary, no loading.

**Micro-Workouts** — bodyweight and environment only.

**Create Your Own Workout** — the same rules, but equipment is a *ceiling*, not a requirement: outdoor/home mixes (bodyweight + dumbbells or kettlebells) stay legal as long as the category rule above is respected.

## What gets built

1. **One shared conditioning rule** in the rulebook, applied to all four conditioning categories instead of Calorie Burning alone, plus the quality/skill-under-fatigue ban. Same rule used by generation, the checker and repair — no duplicate lists.
2. **Difficulty/time/equipment awareness** kept exactly as it is; nothing about sets, reps, rest, scoring or formats is rewritten.
3. **Full read-only audit** of all 536 workouts under the widened rule to see the true failure list per category.
4. **Deterministic, zero-credit repair** of every failing workout: swap each illegal movement for the closest legal library exercise that matches that workout's own category, difficulty, focus, format and equipment mode (bodyweight workouts get bodyweight swaps), fix doses/duration where the swap changes them. No AI generation, no new content invented.
5. **Safety**: every touched workout backed up first; only the five content fields change. Names, prices, images, visibility, payment links, programs, purchases, player tokens and the eye/view buttons are untouched.
6. **Re-audit all 536** after the write and report per category.
7. **Updated rules workbook** delivered to Files, listing the final rule set per category and every change applied.

## Technical notes

- Rule change lands in `supabase/functions/_shared/workout-engine/doctrine.ts`: rename the Calorie Burning regex trio to a conditioning-family rule keyed by category, wire it through `categoryExerciseViolation` and `dynamicExerciseViolation`, add the skill-under-fatigue check to conditioning categories.
- Regression tests added to `supabase/functions/generate-admin-workout/protocol-quality.test.ts`; `tsgo --noEmit` and the Edge test suite must pass before deployment of `audit-workout-compliance`, `repair-workout-compliance`, `create-custom-workout`, `generate-admin-workout`.
- Repair runs as a local deterministic script against a snapshot; candidates must reach 536/536 `auditWorkout()` pass before any database write, applied in one backed-up batch.
- No AI gateway calls at any point.
