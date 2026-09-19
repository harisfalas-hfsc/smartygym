# Finish every remaining repair in your Excel file

Short answers first:

- Easy? Yes — all 309 remaining rows are rule-based edits to the workout text.
- Safe? Yes — same method as the exercise swaps: full backup of every workout's five content sections before any change.
- Will it break the player, your workouts, Stripe products or purchases? No. Only the five content fields are written. Names, prices, Stripe IDs, images, categories, visibility, programs and purchases are never touched, and every exercise stays a proper linked token so the eye/view button keeps working.

## What gets repaired (the 309 rows left)

| Repair | Rows | What is done |
|---|---|---|
| Illegal finisher | 94 | Remove the Finisher block entirely on Mobility/Recovery workouts; its work is folded into the Main Workout |
| Missing section | 72 (43 workouts) | Add the missing Warm Up / Activation / Cool Down block with 2–3 matching library exercises, properly linked |
| Too many equipment families | 45 | Drop the odd-one-out family by replacing those lines with equivalents from the workout's main family |
| Main block too thin | 33 | Add exercises until the block hits 3–4, chosen from the legal candidates your file lists for that workout |
| Session too long | 29 | Trim rounds/sets/exercise count until total time fits the advertised duration |
| Duration overflow | 14 | Shorten rounds / AMRAP cap / EMOM length to match the advertised minutes |
| Wrong ordering | 12 | Move the technical movement ahead of the high-fatigue one |
| Too cardio-dominant | 8 | Swap 1–2 conditioning moves for control/strength moves from the legal pool |
| Missing dose | 2 | Add sets/reps/time in front of the exercise line |

## How it is done

Deterministic, rule-driven edits — no AI generation, so no credit spend. Each repair follows the exact instruction text in your sheet, using the legal candidate lists the sheet already supplies and matching against your 1,431-exercise library (closest match when a name has been renamed).

## Safety

1. Back up all five content sections of every affected workout before writing, tagged so a one-command rollback is possible.
2. Dry run first: produce the full before/after set and check that every exercise token resolves to a real library ID, headings and emoji section markers stay intact, and nothing outside the content fields changes.
3. Apply, then verify in the database (token integrity, section structure) and open a few repaired workouts in the app to confirm the player, sections and view buttons render.

## Technical notes

- Target: `public.admin_workouts` columns `warm_up`, `activation`, `main_workout`, `finisher`, `cool_down` only.
- Backups into `workout_content_backup` with reason `pre-structural-repair-2026-09-19`.
- Exercises written as `{{exercise:ID:Name}}` tokens; HTML/Tiptap structure preserved.
- Metadata, `is_visible`, `price`, `stripe_product_id`, `stripe_price_id`, `image_url`, programs and purchase tables are untouched.
- Report at the end: per-code counts applied, anything unresolvable listed explicitly rather than guessed.
