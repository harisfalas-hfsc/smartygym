# Applying your repair spreadsheet — exercise swaps only

Yes, the file is clear enough to work from directly. It lists 296 failing workouts and 1,111 issues, of which 802 are straightforward "replace exercise X with one of these three" instructions covering 223 workouts. I can apply those directly to the workouts in the database — no new admin tool, no new feature, nothing to build.

## What I will do

For every "Replace ..." line in the sheet:

1. Find the named exercise inside that workout's section (Main Workout, Finisher, Activation, Cool Down, Soft Tissue).
2. Swap it for the first suggested replacement that exists in your exercise library. If a suggestion is missing, I use the closest matching library exercise instead.
3. Write the replacement as a proper library link so the eye/view button appears on it, exactly like the other linked exercises.
4. Leave everything else byte-for-byte untouched: sets, reps, times, section headings, emojis, bullet structure, formatting, images, prices, visibility, categories.

The workout player reads the same sections and links, so it keeps working unchanged.

## What I will NOT touch (unless you tell me to)

The remaining 309 issues are not exercise swaps — they need content added, removed or rewritten:

- Missing Cool Down / other sections (72)
- Finisher that shouldn't exist on Mobility & Recovery sessions (94)
- Session/duration too long, main block too thin, ordering, missing sets/reps (about 90)
- "Mixes too many equipment families" notes with no specific exercise named (45)

These change structure, so I'm leaving them alone and will give you a list at the end so you can decide.

## Safety

- Every workout gets its original content saved to the existing backup table before any edit, so any workout can be restored.
- Dry run first: I produce the full list of intended swaps (workout, section, old exercise → new exercise) for you to approve before anything is written.
- No metadata, price, Stripe, image or visibility field is written.

## Technical notes

- Source: the "All Violations — Flat Log" sheet, rows whose Suggested Fix begins with "Replace".
- Target: `admin_workouts` content fields only.
- Content stores exercises both as `{{exercise:ID:Name}}` tokens and, in older workouts, as plain text. Both forms are matched; the replacement is always written as a token so the view button renders.
- Replacement IDs from the sheet (`#0251` style) are validated against `exercises` before use; unresolved ones fall back to name-based matching against the library.
