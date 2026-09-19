# Master Sellability Audit — close the last four gaps

Your workbook lists four remaining problems across 536 workouts and 32 training programs. Three of them exist because the rule engine has blind spots, one because training programs are never audited at all. The plan fixes the rules first, then repairs the live content deterministically (no AI credits), then verifies everything.

## 1. Bar, dip and hanging moves inside dynamic formats — 179 workouts

Your list: gorilla chin, chin-ups (narrow parallel grip), gironda sternum chin, chest dip, biceps narrow pull-ups, pull-up, hanging leg raise, assisted hanging knee raise with throw down, box jump down with one leg stabilization, plus a tail of bench/incline/decline moves (dumbbell incline row, bench hip extension, hyperextension on bench, dumbbell around pullover, dumbbell decline shrug, inverted row on bench, dumbbell lying pronation/hammer press, dumbbell bench seated press, dumbbell single leg calf raise).

Cause: the conditioning rule only recognises bench/lying/seated wording. Bar-dependent and station-dependent movements (chin, pull-up, dip, hanging, hyperextension bench, landing-stabilisation jumps) are not in any pattern, so they pass.

Fix: add a bar/station-dependent vocabulary to the shared doctrine and apply it in the conditioning rule and the dynamic-format rule, so these movements are rejected in Main Workout and Finisher of CARDIO, METABOLIC, CALORIE BURNING and CHALLENGE, and in any AMRAP/EMOM/CIRCUIT/TABATA/FOR TIME session. Standing dynamic work with equipment (swings, cleans, thrusters, standing presses, carries) stays legal, exactly as your doctrine says.

Then repair the 179 workouts by swapping each flagged exercise for the closest legal library movement of the same body region, keeping the same reps/sets line, links, view buttons and section structure.

## 2. Duration mismatch — 110 over, 4 under

Cause: the over-run ceiling is generous (about 15% plus 4 minutes), so a 35-minute session that prescribes 47 minutes of work is accepted.

Fix: tighten the ceiling to your rule — more than 10 minutes over advertised is an error — and treat more than 10 minutes under as an error too (today it is only a note). Repair by trimming rounds/sets on the over-running sessions and adding work to the four under-filled ones, using exercises already legal for that workout. Advertised duration, price, category and format are never changed.

## 3. Kinetic Forge Flow — Finisher is four stretches

One workout left. Its Finisher gets real Calorie Burning conditioning work; the four stretches stay in the Cool Down where they belong.

## 4. Twelve training programs with empty or thin days

Programs have never been audited. Add a program-level audit that applies the same doctrine per day (real linked exercises, finisher present and structured for the category, minimum Main Workout density, duration sanity), surface it in the admin panel next to the workout audit, then repair the 12 listed programs' affected days: fill empty Finishers and top up Main Workout days with fewer than three exercises, using library exercises legal for that day's category.

## Safety

- Only workout/day content is edited. Names, categories, format, difficulty, duration, prices, Stripe products, images, visibility, purchases and schedules are untouched.
- Every affected row is backed up first (reason `pre-master-sellability-repair-2026-09-19`) so any change can be rolled back.
- Deterministic repairs only — no AI generation, no credits spent.

## Verification

- Full re-audit of all 536 workouts and all 32 programs: zero errors expected.
- Exercise-token integrity check (every `{{exercise:…}}` resolves, eye/view buttons intact), visibility and price/Stripe counts unchanged.
- Regression tests for the new bar/station rule, the duration bounds and the program audit; typecheck; redeploy the affected functions.

## Technical notes

- `doctrine.ts`: new `BAR_STATION_SETUP_RE` (chin, pull-up, dip, hanging, inverted row on bench, hyperextension on bench, landing-stabilisation box jump down), wired into `conditioningSetupViolation()` and `dynamicExerciseViolation()`; `durationOverflowViolation()` ceiling changed to `target + 10`; new `durationShortfallViolation()` at `target - 10`.
- `compliance.ts`: `SHORT_SESSION` becomes an error via the new shortfall rule; unchanged elsewhere.
- `pool.server.ts` / `validate.server.ts`: same rule applied at selection and generation time so new content cannot reintroduce it.
- New `audit-training-program-compliance` edge function reusing the shared doctrine per day, plus an admin panel section mirroring the workout audit.
- Live repairs run through the existing REST repair tooling with per-row backups into the workout backup table; programs back up their day content the same way.
