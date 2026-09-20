# Training-program doctrine, audit, repair, and permanent enforcement

## Goal
Make every workout day inside all 32 training programs follow the same Haris Falas philosophy, library-first exercise rules, safety doctrine, formatting, and player behavior as Smarty Workouts—while preserving each program’s purpose and progression.

The two uploaded audit workbooks are byte-for-byte identical. They report 212 findings across 16 programs, but they will be treated as guidance: the live exercise library and confirmed Smarty Gym doctrine remain authoritative.

## Category translation
Each program day will be judged through an explicit program-to-workout doctrine map:

- **Cardio Endurance → Cardio:** aerobic, sustainable, repeatable movement; intervals/circuits/EMOM/AMRAP where appropriate; no fixed strength stations, isolation work, hanging/bar setups, or fatigue-unsafe skills.
- **Functional Strength → Strength:** practical compound strength, carries, pulls, presses, squats, and hinges; Reps & Sets as the default; measurable load/reps/rest; no mobility drills dosed as Main Workout work.
- **Muscle Hypertrophy → Muscle Building:** mechanical tension and sufficient volume; controlled tempo, 6–15-rep emphasis, full rest, compounds plus accessories; bodyweight sets prescribed close to technical failure where appropriate; Reps & Sets only.
- **Weight Loss → Metabolic / Calorie Burning:** bodyweight-led continuous movement with selected light equipment only when useful; no machines, benches, racks, fixed stations, isolation lifting, or setup-heavy movements.
- **Mobility & Stability → Mobility & Stability:** controlled sets, reps, and holds only; no conditioning formats or explosive work.
- **Low Back Pain → Mobility & Stability / Recovery principles:** pain-free control, core stability, breathing, mobility, and gentle strengthening; Reps & Sets only; no explosive or fatigue-driven work.

## Implementation

### 1. One permanent rules source
- Add a shared program-category adapter that maps each program category and day intent to the existing workout doctrine.
- Reuse the existing exercise-selection policy and workout doctrine checks for exercise legality, equipment, human realism, work-slot legality, continuous movement, format, sequence, finisher size, and measurable prescriptions.
- Remove the program picker’s conflicting hand-written legality decisions where the shared doctrine is authoritative.
- Keep program-specific progression rules only where genuinely different: endurance progression, hypertrophy volume/load, Low Back pain-free progression, and Week A/Week B structure.
- Keep bodyweight legal alongside selected equipment. Selecting equipment is a ceiling, not a requirement to fill every exercise slot with equipment.

### 2. Full read-only program audit
- Parse every Week A/B training day into its own five-section workout.
- Resolve every `{{exercise:ID:Name}}` token against the 1,431-entry live library.
- Audit category fit, format, equipment, difficulty, work-slot placement, continuous movement, setup cost, exercise density, prescriptions, finisher size, section completeness, and player-linked exercises.
- Compare results with all 212 spreadsheet findings and classify each as confirmed, already resolved, or not a violation under current doctrine.
- Exclude every HFSC-related record from all reads targeting repair and from every write.

### 3. Safe deterministic repair of existing programs
- Back up the current content fields of every affected program before editing.
- Repair content only: invalid exercise tokens, section placement, prescriptions, format labels, missing/thin sections, and oversized or illegal finishers.
- Choose replacements from the live exercise library using the same category, day focus, difficulty, and available equipment; prefer simple, common, recognizable movements.
- Use no AI calls for the existing-program repair.
- Re-audit each repaired day before saving it. If a deterministic replacement cannot pass, leave that program unchanged and report the blocker.

### 4. Permanent gate for Admin-created programs
- Update Admin program generation so every generated day is built from the shared category adapter and exercise-selection source.
- Run every generated day through the same program compliance audit before returning the draft.
- Reject an invalid draft instead of allowing it to reach Save.
- Preserve the existing questionnaire, Week A/Week B progression model, review-before-save flow, image option, pricing, and notification choices.
- Keep Trainer Mindset as the first generation instruction. AI remains limited to program name and descriptive copy; exercise selection and compliance stay deterministic.

### 5. Verification
- Require **32/32 programs passing with zero hard failures and zero unresolved warnings** before completion.
- Verify every training day has valid linked exercises and the View/player controls still work.
- Browser-check representative programs from all six categories on mobile and desktop.
- Confirm names, categories, difficulty, weeks, days/week, images, publication status, Premium/free status, prices, Stripe product/price IDs, purchases, and user progress were unchanged.
- Run the relevant tests, type checks, database linter, deployed-function tests, and a final live read-only audit.

## Data safety
A migration will add admin/service-only program audit and content-backup records with explicit grants and row-level security. Repairs will update only `weekly_schedule`, `program_structure`, `progression_plan`, and—only if required for content consistency—`nutrition_tips`. No workout records, payment fields, visibility, images, purchases, interactions, or member progress will be changed.
