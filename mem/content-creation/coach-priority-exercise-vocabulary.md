---
name: Coach Priority Exercise Vocabulary
description: Haris Falas priority machine/free-weight/bodyweight/Pilates/recovery movements are preferred first in all workout and program generation
type: feature
---
The shared workout engine keeps a priority vocabulary in
`supabase/functions/_shared/workout-engine/priority.ts` (machines, free weights,
bodyweight, Pilates, recovery/mobility). Rules:

- Priority exercises are a PREFERENCE, never a whitelist. Category, focus,
  difficulty, equipment and location filters always win.
- `samplePool` sorts priority matches to the front; the prompt marks them
  `PREFERRED` and instructs the model to build from them first.
- The prompt also carries a one-line technique cue per exercise (from the
  library description/instructions) to improve execution language.
- Narrow focus pools (e.g. SHOULDERS) are never dropped: when fewer than 10
  exercises survive, the pool widens only to the same body region.
- Equipment matching splits combined values and maps aliases (stability ball,
  bosu, roller, weighted, medicine ball, plates, rope, suspension).
- Applies to user-created workouts, admin workouts and admin programs — all use
  the shared engine.
