- Exercise Animations: What I Found and What Happens Next

## Where things actually stand (checked against the live library just now)

**The 53 animations you noted are already in place.** Every one of those 53 exercises already has exactly the file you named attached to its own record — 53 of 53 matched, none missing, none needing a change. That is why I made no writes: there was nothing to apply. Your check confirmed the common movements are correctly wired, it did not reveal 53 gaps.

Two of the 53 need a decision from you, because the file itself is not quite right for the label:

- **Sit-Up** points to `0274.gif`, and that animation shows a short crunch, not a full sit-up.
- **Plank** points to `forearm-plank.jpg`, which is the correct pose but a still photo, not an animation. It is the only still image used as an animation anywhere in the library (1,511 exercises, 1 using a .jpg).

**The real remaining gap is 169 exercises with no animation at all:**

```text
Strength            84
Pilates             41
Mobility            25
Stretching          12
Plyometrics          4
Balance              2
Cardio               1
----------------------
Total              169
```

Inside that group: **Pec Deck** (`machine-pec-deck-fly`) and all **7 TRX** exercises (TRX Row, TRX High Row, TRX Bodyweight Row, TRX Chest Press, TRX Push-Up, TRX Face Pull, TRX Hamstring Curl) have nothing attached — exactly as you suspected.

The workbook I gave you (`SmartyGym_Exercises_Missing_GIFs.xlsx`) lists 155 of these. The library has grown since that export, so a small number of extras are not in it yet.

## What I will do

1. **Refresh the shopping list into one clean file.** One workbook, exactly the exercises that genuinely have no animation today, each with its ID, name, category, body part, target muscle, secondary muscles, equipment, difficulty, description, and full instructions — so you can create content or find media without opening the library. Nothing else in the library gets touched.
2. **Tell you which of those 169 can be filled from animations you already own.** Same as the 27 strong suggestions last time: I only propose a match when the movement, equipment, and body position genuinely agree, and I show you the animation first. I never attach a file I have not looked at.
3. **Apply only what you approve.** When you send files, I match them strictly: the file name must contain the exact exercise ID or the exact exercise name. Anything I cannot match with certainty goes back to you as "unmatched" instead of me guessing, because a wrong animation on the wrong exercise is worse than no animation.
4. **Fix the two problem entries once you decide.** For Sit-Up: either send a real sit-up animation, or I rename the exercise to match the crunch it shows, or I leave it. For Plank: either send a plank animation, or I keep the photo and mark it as a still demonstration.
5. **Verify and report.** After any change, I re-check each touched record: the animation opens, the description, instructions, tags, muscles, difficulty, and ID are unchanged, and no other exercise was affected. You get a short report of what changed and what did not.

## What I need from you

Two answers:

- **Sit-Up** — send a real sit-up animation, rename it to a crunch, or leave it as is?
- **Plank** — send an animation, or keep the still photo as the demonstration?

And for the files themselves: send them with the exercise ID or exact exercise name in the file name (the refreshed workbook will have that column). If you prefer, send them in batches of 20-30 and I will process each batch before asking for the next.

## What I will not do

- No AI or image generation, so no credits spent. You are at 8 credits and that will not move from this work.
- No deletions, no renames of existing exercises, no ID changes, no changes to descriptions, instructions, tags, muscles, difficulty, or media that already works.
- Nothing is attached to an exercise without you seeing the animation first.
- Your 536 workouts, 32 training programs, pricing, Stripe records, purchases, and progress are not part of this work.

## Technical details

- `public.exercises` currently holds 1,511 rows; 169 have an empty `gif_url`. Media fields involved are `gif_url`, `frame_start_url`, and `frame_end_url`.
- `frame_start_url` / `frame_end_url` are optional preview stills used by the exercise detail view and workout player; the animation itself is `gif_url`. Most records work without them, so they are not treated as missing content.
- Before any write, the current media values of each affected row are saved so any single assignment can be reversed exactly as it was.
- Matching rule on upload: exact exercise ID, otherwise exact exercise name after normalising case, spacing, and hyphens. Fuzzy matches are reported as suggestions only, never applied.