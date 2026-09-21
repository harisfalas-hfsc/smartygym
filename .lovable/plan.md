# Plan: Common gym names for the exercise library + your own GIFs

## Goal
The exercise library uses the names real gyms use — bench press, incline dumbbell press, lat pulldown, leg press — so generated workouts (like Hambis's) contain ordinary, recognizable exercises. Later, your own GIFs replace the current animations, matched correctly to each exercise. No credits spent, no existing workout content destroyed, everything reversible.

## What I confirmed before planning
- The library has 1,431 exercises; each has `id`, `name`, `description`, `instructions`, `gif_url`. GIFs live in a storage bucket (`exercise-gifs`), one file per exercise.
- Workouts store exercises as `{{exercise:ID:Name}}` tokens. The ID is the real link — so renaming an exercise does **not** break any workout. The popup/detail view loads by ID and always shows the current name, description, and GIF.
- One catch I will handle: the token also stores a **copy of the name** inside old workout text, so old workouts would keep showing the old name on screen unless we refresh those tokens. That is step 3 below.
- Your three priority lists (50 bodyweight / 50 free-weight / 50 machine) are already in the generator — they just aren't matched to clean common names yet.

## Step 1 — Match report (read-only, you review before anything changes)
I compare your 150 priority exercises against the 1,431 library entries and produce a report with three lists:
- **Rename candidates** — exercise exists but under an awkward name (e.g. "push-up on knees" style names, "v. 2" suffixes, machine-code names). Report shows: current name → proposed common name.
- **Missing exercises** — common gym movements with no library entry at all (e.g. pec deck, seated cable row, leg press if absent).
- **Already fine** — priority names that already match exactly.

You read the report and approve/adjust before I touch anything.

## Step 2 — Apply renames and add missing entries
- **Renames:** update only the `name` field. IDs, descriptions, instructions, GIFs, images, and every workout that uses them stay untouched. Where a description mentions the old name, I update that sentence too.
- **Missing entries:** created with your library standard — 4-sentence description, 5–7 step instructions, correct difficulty/category/equipment. Text only, no AI images (zero credits).
- **Generator preference:** the priority lists in the selection engine are aligned to the final common names, so Full Gym + Chest reliably produces bench press, incline dumbbell press, cable fly — not exotic variations.

## Step 3 — Refresh names inside existing workout content
A one-time safe sweep updates `{{exercise:ID:OldName}}` → `{{exercise:ID:NewName}}` inside stored workouts and programs **only where the ID matches** — the exercise itself never changes, just the displayed name. A full backup of every touched row is written first (same backup pattern we used for the program repairs). 536 workouts + 32 programs re-verified afterward.

## Step 4 — Your GIFs, matched safely
When you're ready, you give me the GIF files (a folder/zip). Matching is done by **your say-so, not guessing**:
1. I give you a simple list: `exercise ID — exercise name` for the renamed/new/common exercises.
2. You name each GIF file with the exercise ID or name (e.g. `0043.gif` or `barbell-bench-press.gif`).
3. I upload them to the `exercise-gifs` bucket, set each exercise's `gif_url`, and report any file that didn't match so nothing gets attached to the wrong exercise.

## Step 5 — You verify
- A verification page/report: for each renamed exercise, old name → new name → GIF shown.
- You spot-check in the admin exercise library and in 2–3 real workouts.
- Rollback: rename map + content backups let me restore every original name if you dislike anything.

## Technical details
- Tables touched: `public.exercises` (name/description/instructions/gif_url only), workout/program content columns for the token sweep (with backups).
- Code touched: `supabase/functions/_shared/exercise-selection.ts` (priority-name alignment only — no rule/logic changes).
- No changes to pricing, visibility, Stripe IDs, purchases, images, programs' structure, or generation rules.
- Cost: zero AI credits. GIF uploads are storage only.

## Order of events
1. Step 1 report → you approve.
2. Steps 2–3 executed with backups → verification report → you check.
3. Step 4 whenever you have the GIFs — independent of the rest.
