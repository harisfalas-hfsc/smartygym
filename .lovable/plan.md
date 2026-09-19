# Repair, verify, and publish the 30 premium workouts

## Verdict

**Do not publish the document unchanged.** All 30 drafts are understandable, but the exercise choices are frequently random rather than coach-designed, several violate the stated category/equipment rules, and some markup would break exercise linking and the View button.

I will preserve the intended matrix for every workout:
- category, difficulty, bodyweight/equipment tier, advertised duration, main format, and finisher format;
- Premium and immediately visible;
- included with membership, not sold separately;
- no price and no Stripe product;
- one unique, text-free cover image per workout.

## What “malformed” means here

The document contains exercise links written as `{exercise:ID:Name}` instead of `{{exercise:ID:Name}}`. A single-brace token is plain text, so it does not become a linked exercise and its View button cannot appear. This affects, among others, **Keystone Foundation (Equipment), Cadence Foundation, Kinetic Apex, and Summit Drive**.

**Blaze Drive** has the opposite defect: valid-looking tokens followed by an extra `}`, which can leave a visible brace and interfere with clean parsing.

Several pages repeat each section heading twice, such as `### Main Workout` followed by `**Main Workout**`. These duplicates must be normalized to one five-section workout structure.

Some IDs use named aliases such as `recovery-*`, `bw-*`, and `cat-cow-stretch`. Each one will be resolved against the live exercise library; any nonexistent ID will be replaced with the closest legal library exercise, never invented.

## Coaching corrections by workout group

### Strength — six workouts

- **Keystone Foundation:** replace running, air bike, and star jumps presented as a reps-and-sets strength finisher; remove towel/equipment-dependent work from the bodyweight tier; build a coherent beginner full-body strength progression.
- **Keystone Foundation (Equipment):** repair all malformed links; replace the disconnected collection of toe raises, curls, arm-blaster work, leg press, and kickbacks with recognizable beginner compound patterns.
- **Keystone Drive:** remove recovery mobility from Main Workout and replace hanging/technical choices with a genuine intermediate bodyweight strength progression.
- **Granite Drive (Equipment):** replace step-box support and scattered isolation/conditioning choices with a balanced intermediate equipment session.
- **Granite Apex:** the bodyweight label conflicts with pull-up cable equipment, benches, parallel bars, and a glute-ham station; rebuild with advanced but recognizable bodyweight strength exercises.
- **Granite Apex (Equipment):** remove unstable-ball, suspended, hanging, archer pull-up, and acrobatic selections that conflict with the simple/common selection policy; rebuild as advanced equipment strength.

All Strength finishers remain **REPS & SETS** with explicit sets, reps, and rest.

### Cardio — six workouts

- **Cadence Foundation:** repair malformed links; remove slow/static or mobility-style work from the EMOM and retain continuous beginner movement.
- **Velocity Foundation (Equipment):** replace finger curls, bird dog, deadlift, seated shoulder work, wrist curls, and other low-heart-rate/fixed-position choices.
- **Cadence Drive:** replace incline/supported and static selections with continuous bodyweight cardio.
- **Pulse Drive (Equipment):** replace single-leg deadlift with step-box support, bent-over row, plank-style filler, and any fixed setup.
- **Current Apex:** remove suspended split squat, incline depth push-up, flag, glute-ham raise, and suspended fallout; advanced difficulty will come from pace and work/rest density, not gymnastics.
- **Ember Apex (Equipment):** remove suspended and isometric work plus incline depth-jump setup; use standing dynamic equipment movements.

### Metabolic — six workouts

- **Ignition Foundation:** remove the static forearm plank and the kneeling hip-flexor stretch used as work; rebuild the Tabata around continuous beginner movement.
- **Surge Foundation (Equipment):** replace side bend, row, incline push-up, and negative crunch with dynamic beginner metabolic work.
- **Metabolic Drift Circuit:** remove platform-slide/setup work and the 90/90 mobility drill used in the finisher.
- **Reactor Drive (Equipment):** remove exercise-ball kickbacks/twists, unstable stork stance, and wheel-rollout setup; use standing dynamic equipment work.
- **Kinetic Apex:** repair malformed links; remove isometric wipers, suspended split squat, side plank, flag, and other static/setup-dependent selections.
- **Surge Apex (Equipment):** remove suspended, roller, incline-depth, flag, and isometric selections; rebuild as advanced standing metabolic work.

### Challenge — six workouts

- **Gauntlet Foundation:** replace wall angels and toe-touch/stretch-style work used as timed competition exercises with accessible beginner challenge movements.
- **Gauntlet Foundation (Equipment):** replace the exercise-ball hug, wrist curl, side bend, and other low-output isolation choices.
- **Summit Drive:** repair malformed links and replace toe-touch/mobility-style or setup-dependent choices with a coherent bodyweight challenge.
- **Crucible Drive (Equipment):** replace supported rear raise and slow floor/isolation choices with continuous equipment challenge work.
- **Arena Apex:** remove glute-ham and suspended reverse-crunch setup; preserve advanced difficulty through rounds, pace, and rest.
- **Arena Apex (Equipment):** remove wheel rollout, suspended fallout, flag, and incline depth-jump setup; rebuild with recognizable dynamic equipment movements.

### Calorie Burning — six workouts

- **Torch Foundation:** remove supported squat and towel-row setup from the bodyweight tier; use continuous bodyweight calorie-burning movements.
- **Scorch Foundation (Equipment):** replace towel-row/setup and low-output selections with standing dynamic equipment work.
- **Blaze Drive:** remove the wall sit and other static/setup-dependent work, and repair every extra closing brace.
- **Drive Drive (Equipment):** replace incline push-up, alternating row, single-leg deadlift, and step-up split squat setup with constant-movement choices. Rename the weak duplicated title to a unique professional title.
- **Scorch Apex:** remove incline-depth and suspended movements; advanced density will come from the AMRAP prescription.
- **Torch Apex (Equipment):** replace renegade-row and plyo push-up setups where they interrupt constant movement; retain dynamic standing equipment work.

## Build and verification process

1. Recompose every workout from the live exercise library using the existing shared exercise-selection policy. No invented exercises and no copied IDs accepted without verification.
2. Normalize each workout to exactly five rendered sections. Main Workout and Finisher will contain only valid linked exercises, with no duplicate headings or malformed braces.
3. Validate category legality, exact equipment tier, difficulty logic, finisher format/size, constant movement, work-slot legality, duration honesty, and exercise density before insertion.
4. Run the same full compliance audit used by the existing 536-workout library. Any failure blocks the entire batch; warnings will also be resolved rather than published.
5. Create 30 unique text-free covers using the current non-deprecated image model, then visually inspect each for anatomy, equipment, category relevance, uniqueness, and absence of text.
6. Insert the complete batch as Premium, visible, non-standalone workouts only after every record and image passes. Do not create or modify Stripe products, prices, purchases, or training programs.
7. Open representative workouts from every category/tier in the live player and verify all five sections, linked exercise names, View buttons, images, access behavior, and mobile/desktop presentation.
8. Verify the automatic new-content queue contains the batch announcement. The active delivery process checks every 15 minutes and sends eligible members according to their email, dashboard, and push preferences.
9. If final verification fails, keep or return the affected new records to hidden status rather than deleting paid-content records or exposing partial work.

## Image-credit estimate

I will use **`google/gemini-3.1-flash-image`**, the current non-deprecated replacement suited to this existing image flow.

- Current rate: **0.00006 credits per image-output unit**, plus a very small text-input charge.
- A recent comparable cover used about 1,290–1,327 output units. At that output size, one new cover is approximately **0.078–0.080 credits**.
- **30 successful first-pass covers: approximately 2.35–2.40 credits.**
- Recommended hard budget including a few rejected/failed covers: **maximum 3.5 credits**.

No AI credits are needed for the content repairs or deterministic validation. I will not exceed the image budget or substitute another model without stopping and reporting the blocker.

## Completion standard

The batch is complete only when all 30 are visible, Premium, non-standalone, uniquely titled, uniquely imaged, zero-failure/zero-warning compliant, fully playable, and all exercise View buttons work. I will report the exact inserted IDs, audit result, image cost, notification state, and confirmation that Stripe-associated data was untouched.
