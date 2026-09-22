# Choose which exercises the system is allowed to use

Add an ON/OFF switch to every exercise in the admin Exercise Library. Everything starts ON. From then on, only switched-ON exercises can be used when new workouts or new training programs are created — by you in the admin panel, by Smarty Coach, or by a member using Create Your Own Workout. Already-created workouts and programs are never touched.

## What you will see

In Admin → Exercise Library → Exercise Database:

- The Import Tools card stays exactly as it is.
- Below it, a new Exercises section presented in the same style, structure and layout as the public Exercise Library page: smart search, the five filters (body part, equipment, target muscle, difficulty, category), the same exercise cards with animation, name and tags, and the same detail popup on click.
- Each exercise card carries a switch: **In use / Not in use**. Clicking it saves immediately and the card shows a clear dimmed "Not in use" state when off.
- A counter at the top: how many exercises are in use out of the total, plus a filter to view All / In use / Not in use.
- Bulk buttons for the exercises currently shown by your filter: "Turn all on" / "Turn all off", each with a confirmation.

The public Exercise Library page keeps showing every exercise as it does today — the switch is an admin generation control, not a visibility control.

## Rules

- Default for every existing and every newly imported exercise: ON.
- An exercise switched OFF is never selected for any newly generated workout or training program, in any category, for any customer, and never appears in the model's allowed exercise list.
- Existing workouts, training programs, WODs, customer-created workouts, saved copies, images, prices and links are untouched.
- The switch is a further restriction on top of every rule already in place (animation required, category pools, bans, equipment, difficulty, doctrine). It can never widen what is allowed.
- Only admins can change the switch.

## Technical detail

1. Migration: add `exercises.is_generation_enabled boolean not null default true`, plus an index on it. Existing rows become `true` by the default. Existing admin-only update policy already covers the write; read policy already public.
2. Generation pools filter on the new column:
   - `supabase/functions/_shared/workout-engine/pool.server.ts` → `loadAllExercises` adds `.eq("is_generation_enabled", true)` next to the existing animation filter (covers member Create Your Own Workout, Smarty Coach, admin Create New Workout).
   - `supabase/functions/_shared/exercise-matching.ts` → `fetchAndBuildExerciseReference` adds the same filter (covers admin program generation and the other generators that build the reference list).
   - `supabase/functions/generate-admin-program`, `restructure-training-programs` and `regenerate-broken-programs` library loads add the same filter so the program picker and the compliance library agree.
   Repair/audit-only functions that operate on already-created content keep reading the full library.
3. New admin component `src/components/admin/AdminExerciseDatabase.tsx`, built from the existing `src/components/ExerciseDatabase.tsx` markup so the look matches the public page exactly, with the toggle, status filter, counter and bulk actions added. Mounted inside `ExerciseLibraryManager.tsx` under the Import Tools card in the Exercise Database tab. The public `ExerciseDatabase.tsx` is not modified.
4. Toggle writes through an optimistic update against `exercises`, with a toast on failure and rollback.
5. Redeploy the affected edge functions.

## Verification before reporting back

- Migration applied; confirm every existing exercise reads as enabled.
- Typecheck, lint, existing app and engine test suites.
- Browser check signed in as admin: open the section, toggle one exercise off and on, reload and confirm it persisted, confirm filters/search/detail popup work and the mobile layout does not overlap.
- Confirm by query that a disabled exercise is excluded from the generation pool, without generating any content and without spending credits.
