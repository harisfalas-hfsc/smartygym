---
name: Admin exercise on/off switch for generation
description: exercises.is_generation_enabled decides which exercises any future workout or training-program generation may use
type: feature
---

`public.exercises.is_generation_enabled` (boolean, default true) is the admin's ON/OFF switch,
managed in Admin → Exercise Library → Exercise Database → Exercises
(`src/components/admin/AdminExerciseDatabase.tsx`, styled like the public Exercise Library page).

Rules:
- Every existing and newly imported exercise defaults to ON.
- An exercise switched OFF is never selected for NEW workouts (member Create Your Own Workout,
  Smarty Coach, admin Create New Workout) or NEW/restructured training programs, and never enters
  the model's allowed exercise list.
- It is a further restriction on top of existing doctrine (animation required, category pools,
  bans, equipment, difficulty). It can never widen what is allowed.
- Already generated workouts, programs, WODs, customer workouts and saved copies are untouched.
- The public Exercise Library page still shows every exercise — this is a generation control,
  not a visibility control.

Filter applied in: `_shared/workout-engine/pool.server.ts` (`loadAllExercises`),
`_shared/exercise-matching.ts` (`fetchAndBuildExerciseReference`),
`restructure-training-programs`, `regenerate-broken-programs`.
Repair/audit functions that only read existing content keep the full library.
