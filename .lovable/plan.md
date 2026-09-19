# Apply the new audit spreadsheet fixes (18 workouts)

Your re-check file lists 57 remaining items across 18 workouts: 41 critical and 16 minor. I'll apply each instruction exactly as written, changing only workout content.

## What gets fixed

**Wrong exercises for the category (40 items, 8 workouts)**
Each row names the exercise to remove and the replacements to use. I'll swap in the named library exercises, keeping the same link format so the eye/view button and player keep working.
- Anchor Meridian, Stable Compass (Mobility & Stability)
- Advanced Power Pilates, Advanced Reformer Mastery, Beginner Mat Flow, Intermediate Core Balance, Intermediate Stability Flow (Pilates)

**Wrong workout format (1 item)**
- Jump Starter (MW-006): change from Circuit to Reps & Sets, and rewrite the prescriptions to sets/reps so the text matches the format.

**Thin sections (3 items)**
- Anchor Meridian: bring Activation up to 3 drills.
- Stable Compass: bring Activation and Cool-down up to 3 each, using linked library movements.

**Same movement repeated too often (5 items)**
- Arcus Vortex, Cadence Current Weave, Cadence Pulse Trail, Cadence Coil Tabata, Iron Current: swap 1-2 repeats for other legal exercises from the same pool.

**Advertised time longer than the actual work (8 items)**
- Beginner Mat Flow, Intermediate Core Balance, Ember Cascade Burn, Ember Step Ladder, Kinetic Cascade Apex, Kinetic Forge Flow, Cadence Awaken Flow, Cadence Pulse Trail: add work where the session clearly supports it, otherwise set the advertised duration to the honest time.

## Safety

- Only the five content sections (warm-up, activation, main, finisher, cool-down), plus format/duration where the spreadsheet says so.
- Untouched: names, prices, images, visibility, payment links, purchases, programs, training programs, and the workout player layout.
- Every affected workout is backed up before saving, so it can be rolled back.
- No AI generation and no credits spent — the replacements come straight from your spreadsheet and the exercise library.

## Verification

1. Confirm every new exercise link resolves to a real library entry (no broken links anywhere).
2. Re-run the compliance audit over all 536 workouts and report the before/after counts, including anything still failing.
3. Open 3-4 of the repaired workouts signed in and confirm sections render and the eye/view buttons work.

## Technical notes

- Replacements use the exact IDs from the spreadsheet (e.g. `pilates-roll-over`, `recovery-childs-pose`, `0276`), written as `{{exercise:ID:Name}}` tokens; spot-checked IDs exist in `exercises`.
- Updates go to `admin_workouts` content columns only, with originals copied into `workout_content_backup` under reason `pre-recheck-repair-2026-09-19`.
- Audit run via the shared engine in `supabase/functions/_shared/workout-engine` (read-only scan).
