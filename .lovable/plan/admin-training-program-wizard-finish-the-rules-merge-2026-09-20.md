# Admin training-program wizard: finish the rules merge

## How it works today (verified in the code)

**The two-week rule is already in place.** The wizard always builds exactly two workout templates — Week A and Week B — no matter whether you choose 4, 6 or 8 weeks. Every other week is written as a progression note ("Week 5 — repeat Week B, add one set or 2–5% load"). Weeks 7 and 8 get their own note lines. So nothing generates six or eight separate weeks of workouts.

**Exercises are picked by the app, not by AI.** AI only writes the program name and the descriptive text. Every exercise is chosen from your live library, every line carries a real prescription, and the whole draft is audited before it reaches your Review screen — if it fails, it is rejected rather than saved.

**Each category already has its own session shape:**
- Cardio Endurance → AMRAP / EMOM / Intervals / Circuit, with a short for-time finisher
- Weight Loss → Circuit / Tabata / EMOM / AMRAP, Tabata finisher
- Functional Strength and Muscle Hypertrophy → sets and reps only
- Low Back Pain and Mobility & Stability → sets, reps and controlled holds only, never conditioning formats

## What is genuinely missing

1. **Cardio has no real running content.** The picker can only choose exercises that exist in the library, so a Cardio Endurance program never prescribes a timed run, a tempo run, shuttle runs, a bike or treadmill block, or a distance target — the things that actually make a 5K-style program. This is the biggest gap.
2. **Weight Loss is judged only against Calorie Burning rules**, not Metabolic as well, so some legitimate metabolic work gets filtered out and some calorie-only logic slips through.
3. **Low Back Pain and Mobility carry no Recovery character** — no breathing, no down-regulation, no gentle restorative element blended in, which is what you described.
4. **Hypertrophy has no bodyweight-to-failure rule.** When a hypertrophy program is bodyweight, the sets still read "4 × 10, tempo 3-1-1" instead of taking the set close to technical failure.
5. **There are two rule sources.** The picker keeps its own hand-written category lists alongside the shared doctrine, so the two can drift apart.
6. **The wizard's own written philosophy text** is a third separate copy of category rules living inside the generator.

## What I will change

### 1. Cardio becomes a real endurance program
Add a locomotion block to Cardio Endurance days: timed or distance runs, jogs, walk-run intervals, shuttle runs, tempo efforts, and bike/rower/treadmill/elliptical equivalents when the equipment allows. These sit in the Main Workout alongside library exercises, with proper pacing language (easy, steady, threshold) and clear work/recovery structure — the Run My First 5K shape. Weight Loss may use light locomotion too, but never as the whole session.

### 2. Category rules merged to one source
Move every category decision into the shared doctrine file that the workouts already use, and have the program picker read from it instead of its own lists. One place to change, one behaviour everywhere.

### 3. Correct category mapping
- Weight Loss → Metabolic **and** Calorie Burning rules together
- Low Back Pain and Mobility & Stability → Mobility & Stability blended with Recovery: controlled reps, holds, breathing and down-regulation; no conditioning formats
- Functional Strength → Strength; Muscle Hypertrophy → Muscle Building with hypertrophy loading, and bodyweight sets prescribed close to technical failure

### 4. Progression notes made explicit
Sharpen the weekly notes so each week states plainly what rises — load, reps, sets, rounds, work time, rest cut, pace or distance — per category, rather than generic wording. Cardio weeks progress distance and pace; hypertrophy weeks progress load; weight loss weeks progress density.

### 5. Same audit, tighter
Extend the pre-save audit so it also checks the new locomotion lines, the Recovery character on the two rehab categories, and the two-template rule — a draft that lists more than Week A and Week B is rejected.

## Technical notes

- `_shared/program-doctrine.ts` becomes the single category source; `WEIGHT LOSS` maps to both `METABOLIC` and `CALORIE BURNING`, `LOW BACK PAIN` / `MOBILITY & STABILITY` gain Recovery constraints.
- `_shared/program-exercise-picker.ts`: delete the local `CATEGORY_RULES`/philosophy duplication, read doctrine; add a locomotion prescription builder for cardio-family days (time/distance/pace, equipment-aware), and bodyweight-to-failure prescriptions for hypertrophy.
- `_shared/program-template.ts`: category-specific progression lines; keep the existing two-template generation (`templateCount = 2`) and add an explicit assertion.
- `generate-admin-program/index.ts`: drop the inline `CATEGORY_PHILOSOPHY` map and source the copy prompt from shared doctrine, keeping `COACH_MINDSET` first.
- `_shared/program-compliance.ts`: new checks for locomotion presence in cardio, template count, and recovery-character categories.
- Tests added to the existing Deno test files; no AI credits used, nothing published, existing 32 programs untouched unless you ask for a re-repair afterwards.
