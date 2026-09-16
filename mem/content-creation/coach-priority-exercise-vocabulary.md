---
name: Coach priority exercise vocabulary
description: Master "simple, common, recognizable" exercise reference list and selection rules shared by all four generators
type: feature
---

The Priority Exercise Reference List (275 entries across gym machines/stations, machine-based, free weights, bodyweight, Pilates, recovery/mobility/stability) lives in `supabase/functions/_shared/workout-engine/priority.ts` and is the source of truth for WHICH VARIATION of a needed movement gets picked.

Rules:
- Applies identically to the member Workout Generator, Smarty Coach, Admin Workout Generator and Admin Training Program Generator (`program-exercise-picker.ts` imports the same module).
- Semantic matching: word order, equipment prefixes (lever/machine/leverage), and synonyms are ignored.
- Never a whitelist — category, format, questionnaire, equipment and difficulty still decide which movement is needed.
- Simplest wins: when several library entries mean the same movement, the plainest standard version is selected (`simplicityPenalty`, `simplestFirst`, `movementKey`).
- Permanently banned: bosu loading, unstable surfaces (wobble/balance board, discs), elevated single-leg/pistol/shrimp squats, gymnastic complexity (planche, levers, flags, muscle-up, handstand). Exception: stability-ball entries named in the Pilates reference list.
- Difficulty unlocks load, reps, tempo and supersets — never unstable, lever-based or acrobatic variations.
