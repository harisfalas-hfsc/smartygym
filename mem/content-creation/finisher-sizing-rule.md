---
name: Finisher sizing rule
description: A Finisher is complementary — roughly 3 rounds / 5 minutes, hard ceiling 8 minutes or 5 rounds, never a second main workout.
type: feature
---
The Main Workout is the main workout. The Finisher caps the session off.

- Target: ~3 rounds, ~5 minutes.
- Hard ceiling: 8 minutes or 5 rounds. Anything above is oversized regardless of format.
- A standard Tabata block (8 rounds of 20 sec work / 10 sec rest = 4 min) is legal; its interval count is not counted as rounds.
- Enforced by `finisherSizeViolation()` in `supabase/functions/_shared/workout-engine/doctrine.ts`, wired into `compliance.ts` (`FINISHER_OVERSIZED` error) and `validate.server.ts`.
- When trimming a Finisher, restore the lost minutes in the Main Workout (add rounds/passes) so the advertised duration still holds.
