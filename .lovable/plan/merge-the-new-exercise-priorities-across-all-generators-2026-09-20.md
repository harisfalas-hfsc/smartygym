# Merge the New Exercise Priorities Across All Generators

## Goal
Make the supplied common exercises the preferred vocabulary for:
- member **Create My Own Workout**
- Admin **Create New Workout**
- Admin **Create New Training Program**

Priority means “choose this recognizable movement first when it is legal and suitable.” It will never override category, format, equipment, difficulty, safety, or workout-structure rules.

## Confirmed Current State
- The live exercise library contains **1,431 exercises** with names, equipment, difficulty, body-part, and target data.
- A shared priority source already exists with Bodyweight, Free Weight, Machine, Pilates, and Recovery groups.
- The workout engine marks matching library rows as preferred and orders its pool through this shared policy.
- Training-program selection imports the same priority ranking.
- The current matching already supports aliases and differently worded library names, but the supplied lists require a full remap and expanded aliases.

## Implementation

### 1. Merge, do not duplicate
- Update the existing shared priority source rather than creating another list or selection system.
- Replace/merge the current Bodyweight, Free Weight/Functional Equipment, and Machine/Cable vocabulary with the supplied priorities.
- Preserve the dedicated Pilates and Recovery priorities and their locked doctrine.
- Keep the extra common conditioning movements immediately available: High Knees, Butt Kicks/Skipping, Skater Jumps, Commandos, Bear Crawl, and Squat Jump.

### 2. Match priorities to real library exercises
- Resolve every supplied name against the 1,431 live rows using normalized wording, equipment-aware aliases, token matching, and controlled semantic equivalents.
- Examples: Squat → Air Squat/Bodyweight Squat; TRX → suspension naming; Leg Curl → seated/lying machine variants.
- Produce a deterministic match report showing:
  - exact matches
  - accepted aliases/similar names
  - multiple candidates and the selected simplest variant
  - genuinely missing movements
- Never invent an exercise or token. A missing priority remains a reference preference and falls back to the closest legal library movement.

### 3. Add the requested hierarchy to shared selection
Use the existing library metadata plus shared doctrine to rank candidates by:
1. **Movement family:** Upper Push, Upper Pull, Lower Push, Lower Pull, Core, Conditioning, Full Body.
2. **Equipment:** Bodyweight, Dumbbell, Kettlebell, TRX, Medicine Ball, Cable, Machine, Barbell, Smith Machine.
3. **Training suitability:** category and difficulty suitability from the existing doctrine and pool rules.
4. **Format compatibility:** REPS & SETS, AMRAP, FOR TIME, EMOM, TABATA, CIRCUIT, and MIX through the existing category/format legality rules.

These are ranking dimensions, not new ways to bypass established validation.

### 4. Preserve all hard doctrine
A priority exercise is preferred only in contexts where it is already legal. In particular:
- Bench/box dips, pull-ups, chin-ups, inverted rows, step-ups, Bulgarian split squats, wall sits, hanging work, bench work, cables, and machines remain excluded from constant-movement conditioning where doctrine forbids their setup or stillness.
- Machines remain for suitable Strength/Muscle Building work, not Cardio/Metabolic/Calorie Burning/Challenge merely because Full Gym was selected.
- Mobility/preparation movements cannot enter work sections outside their permitted categories.
- Pilates, Recovery, and Micro-Workouts keep their locked equipment, difficulty, and format rules.
- Existing bans on pistols, Turkish get-ups, levers, handstands, acrobatics, prohibited Bosu/unstable variations, and other circus-level movements remain absolute.

### 5. Make “advanced does not mean complicated” permanent
- Strengthen the shared coaching instruction so Advanced means progression through load, volume, density, tempo, rest, range, and programming—not novelty or acrobatics.
- Keep simple, common, recognizable movements preferred at every difficulty.
- Ensure difficulty affects selection only where doctrine says it should; conditioning difficulty continues to come primarily from work density and work/rest structure.

### 6. Ensure all three creation paths consume the same result
- Confirm the member workout and Admin workout paths receive the same ordered pool from the shared engine.
- Confirm Admin program generation uses the same priority tiers after its program-category, equipment, focus, and legality filters.
- Remove or align any remaining local preference ordering that conflicts with the shared policy; category-specific safety filters remain intact.

## Verification Without Paid Generation
- Add tests for exact matches, aliases, simplest-variant selection, equipment distinctions, category legality, and format compatibility.
- Add regression tests proving priority never overrides the constant-movement, preparation-as-work, Pilates, Recovery, Micro-Workout, equipment, or hard-ban rules.
- Test representative Bodyweight, Dumbbell/Kettlebell/TRX/Medicine Ball, Cable/Machine, Barbell, and Smith Machine choices across workout and program categories.
- Run the full no-credit workout-engine and training-program test suites, type checks, and source consistency checks.
- Run read-only pool previews for member workouts, Admin workouts, and Admin programs. Do not create content, images, notifications, prices, or spend AI credits.

## Scope Protection
No existing workout or training-program content will be edited. No metadata, visibility, purchases, progress, images, prices, Stripe associations, or notifications will change.
