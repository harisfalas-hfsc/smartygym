# Same equipment questions in the admin panel, and no more "Other"

Two changes, nothing else touched: the admin creation wizard gets the same style of questions members get, and the confusing "Other" free-text equipment box disappears from both places.

## 1. Admin wizard — new question order

For a new **workout**:

1. Content type
2. Category (Strength, Calorie Burning, Metabolic, Cardio, Mobility & Stability, Challenge, Pilates, Recovery, Micro-Workouts…)
3. Difficulty
4. **Time available** (moves up, right after difficulty)
5. **Equipment** — Bodyweight or Equipment
   - If **Equipment** is picked, a second row appears to tick what is actually available: Dumbbells, Kettlebells, Barbell, Resistance Bands, TRX, Machines, Full Gym. You can tick more than one; at least one is required to continue.
   - Full Gym means everything is allowed (same meaning the member questionnaire gives it).
6. Format (unchanged, skipped where the category has a fixed format)
7. Strength Focus (unchanged, Strength only)
8. Access & price (unchanged)
9. Review (now also lists the exact equipment you ticked)

Micro-Workouts stay locked to Bodyweight / 5 min as today.

For a new **training program** the same Bodyweight / Equipment question with the same tick-list appears; weeks and days per week stay where they are.

## 2. "Other" is removed

- Removed from the member "Create Your Own Workout" questionnaire (chip plus the free-text box).
- Never added to the admin wizard.
- Nothing else in that questionnaire changes: Time available, Where are you training, Equipment available, "Anything else?" note all stay.

## 3. What the generator actually receives

Today the admin panel tells the engine "full gym" whenever you pick Equipment, no matter what you had in mind. After this change it receives the exact list you ticked, so a "Dumbbells + Bands" workout can only contain dumbbell and band exercises — exactly the rule the member path already follows.

No coaching rules, category rules, formats, finisher rules, validation, pricing, images or notifications change.

## Technical notes

- `src/lib/coach-options.ts`: drop the `other` entry from `EQUIPMENT`; add an `ADMIN_EQUIPMENT_CHOICES` list (the seven ids above) reused by both admin steps.
- `src/pages/CreateYourOwnWorkout.tsx`: remove `otherEquipment` state, the textarea, the validation branch and the `equipmentOther` payload field.
- `src/components/admin/ContentCreationWizard.tsx`: reorder the step list so `duration` precedes `equipment` for workouts; keep `equipment` state as `BODYWEIGHT | EQUIPMENT` and add `equipmentIds: string[]`; block Continue when mode is EQUIPMENT and the list is empty; send `equipment_ids` in the generate request for both workout and program; show them on the Review step.
- `supabase/functions/generate-admin-workout/index.ts`: replace the hardcoded `selectedEquipment = ["fullgym"]` with the sanitised `equipment_ids` from the body (falling back to `["fullgym"]` only when absent, so older callers keep working). `equipmentMode` logic unchanged; the saved `equipment` column keeps storing `BODYWEIGHT` / `EQUIPMENT` so public filters and the 537 existing rows are unaffected.
- `supabase/functions/generate-admin-program/index.ts`: accept `equipment_ids`, pass them to `filterLibraryForProgram`, and store a readable label list (e.g. `Dumbbells, Kettlebells`) in the program's `equipment` field, matching how existing programs already store it.
- `supabase/functions/_shared/program-exercise-picker.ts`: `filterLibraryForProgram` gains an optional allowed-equipment argument applied with the same `EQUIPMENT_LABELS` mapping used by `pool.server.ts` — one shared source of equipment legality, no duplicate rules.
- `create-custom-workout` keeps tolerating a legacy `equipmentOther` field so any in-flight request still works; the UI no longer sends one.
- Verification: typecheck, existing Deno engine tests and Vitest, ESLint on the touched screens, and a no-credit walk through both wizards in the browser (stopping before pressing Generate, so no AI credits are spent).
