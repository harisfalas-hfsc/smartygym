---
name: Single exercise-selection source of truth
description: All workout/program generation (member, Smarty Coach, admin workouts, admin programs, batch generators) selects exercises through one shared file
type: feature
---
Exercise selection lives in exactly ONE file: `supabase/functions/_shared/exercise-selection.ts`.

It holds the priority reference lists, synonyms, ban lists (bosu loading, unstable surfaces, elevated single-leg squats, lever/gymnastic complexity), the "simplest wins" rule and the unified API:
- `isSelectable(name)` — hard ban gate
- `selectionTier(name)` — 0 simplest priority, 1 priority, 2 other legal, 3 never-promoted
- `orderBySelectionPolicy(list)` / `applySelectionPolicy(list)`

Consumers (must never re-implement bans or ordering): `workout-engine/pool.server.ts` (member workouts, Smarty Coach, admin workouts), `program-exercise-picker.ts` (admin training programs, restructure), `exercise-matching.ts` → `fetchAndBuildExerciseReference` (all other generators).

**Why:** one logic for every workout and program generation path, anywhere in the system.

## Category-to-pool mapping (added)
`exercise-selection.ts` also owns the goal-category → reference-pool map:
Strength = free weight + machine; Muscle Building = machine + free weight;
Calorie Burning / Metabolic = bodyweight + free weight; Cardio = bodyweight;
Challenge = free weight + bodyweight; Mobility & Stability / Recovery = recovery
pool only; Pilates = Pilates pool only; Micro-Workouts = bodyweight.
API: `poolsOf(name)`, `matchesCategoryPool(name, category)`, and the optional
`category` argument on `selectionTier` / `orderBySelectionPolicy` /
`applySelectionPolicy`. Out-of-pool exercises are demoted, never banned.
"How are you feeling today" changes volume only, never the pool.
Overall priority order: user constraints → exercise matching → format logic.
