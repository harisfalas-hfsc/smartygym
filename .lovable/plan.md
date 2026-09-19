# One universal conditioning rule, your 10 listed repairs, then every other workout that needs it

Your audit file is right about the root cause: the mechanism already exists (`dynamicExerciseViolation` runs on all four clock-driven categories), but its word list only bans barbell/machine setups — it never learned free-weight bench, lying and seated isolation moves. That single gap explains Core Citadel and Loaded Conditioning Session. So this is a code fix, not a one-off data patch.

## The rule, written as a trainer would

**Strength / Muscle Building / Recovery / Pilates** — sets and reps, specific volume, load and rest, chosen by difficulty band, category and available time. Benches, racks and machines are fully legal here.

**Cardio / Metabolic / Calorie Burning / Challenge** — constant movement. Equipment is welcome (swings, cleans, thrusters, slams, carries, goblet squats, lunges, ropes, ergometers), in Main Workout and in the Finisher. What is never allowed is putting the athlete into a fixed bench, lying, supine or seated position to lift or hold load, or into any station that must be set up before the next rep. Skill movements that collapse under fatigue — windmills, get-ups, bent press, pistols, handstands, levers — stay out of these categories too; they belong in reps-and-sets work.

**Mobility & Stability** — controlled work, no loading, no conditioning.
**Micro-Workouts** — bodyweight and environment only.

Your two judgment calls are honoured as you ruled them: bent-over reverse/rear fly is **not** a violation, and anything explicitly "standing" is exempt.

## What gets built

1. **Widen the setup rule in the shared rulebook** exactly as your file specifies: pullover, fly/flye, skull crusher, lying triceps extension, concentration curl, incline/decline press or fly, seated + curl/press/extension, supine + press/fly/extension, and "on exercise ball" variants — with a standing exemption. One list, used by generation, the checker and repair, so future admin and member workouts can never reintroduce it.
2. **Apply your 10 named repairs first**, exactly as listed (8 Metabolic, 2 Challenge: Kinetic Sprout, Ignition Drive Surge, Pulse Drive Fusion, Engine Builder Max, Tempo Sprint, Catalyst Drive, Gridiron Ascent, Brass Crucible, Ultimate Warrior Test, Kinetic Flow Cycle). Each violating movement is swapped for a standing/continuous library exercise of the same equipment family, respecting that workout's difficulty, focus, format and equipment mode.
3. **Then sweep all 536 workouts** under the widened rule and repair anything else it catches — in any category, not only the four conditioning ones — using the same deterministic swap logic. No AI, no credits.
4. **Close the Create Your Own Workout gap** your file found: today any non-bodyweight pick collapses into one generic "equipment" mode, so a kettlebell-only member has no hard guarantee against a barbell movement. Add a hard check that every chosen exercise's equipment is a subset of what the member actually selected, so outdoor/home mixes (bodyweight + dumbbells, say) stay legal while unselected gear is impossible.
5. **Safety on every write**: back up each touched workout first; only the five content fields change. Names, prices, images, visibility, payment links, programs, purchases, player tokens and the eye/view buttons are untouched.
6. **Re-audit all 536** afterwards and report per category, plus an updated rules workbook in your Files listing the final rule per category and every change applied.

## Technical notes

- Rule change lands in `supabase/functions/_shared/workout-engine/doctrine.ts`: extend `SETUP_MOVEMENT_RE` with the listed vocabulary plus a `standing` exemption, and generalise the existing Calorie-Burning-only continuity rule to the conditioning family in `categoryExerciseViolation`.
- Hard equipment-subset check added in `supabase/functions/create-custom-workout/index.ts` and the pool filter, replacing the binary `BODYWEIGHT`/`EQUIPMENT` collapse for selection purposes.
- Regression tests in `supabase/functions/generate-admin-workout/protocol-quality.test.ts` (bench/lying/seated isolation rejected in all four conditioning categories; standing variants and bent-over reverse fly accepted). `tsgo --noEmit` and the Edge suite must pass before deploying `audit-workout-compliance`, `repair-workout-compliance`, `create-custom-workout`, `generate-admin-workout`.
- Repair runs as a local deterministic script against a snapshot; candidates must reach 536/536 `auditWorkout()` pass before a single backed-up batch write. No AI gateway calls at any point.
