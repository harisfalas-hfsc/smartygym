---
name: Single exercise-selection source of truth
description: All workout/program generation (member, Smarty Coach, admin workouts, admin programs, batch generators) selects exercises through one shared file
type: feature
---

## Trainer Mindset — first instruction, always

`COACH_MINDSET` is exported from the top of `exercise-selection.ts` and injected as the
**first lines of every generation prompt** — before the library-first rule, the category
sections, the doctrine and the priority vocabulary. It states that the system operates from
the mindset of Haris Falas designing for real people (parents, workers, people managing health
conditions), that safety/health/quality outrank intensity, novelty and volume, that "advanced"
means more load within the same safe framework rather than more exercises, and that a
beginner or short session is still a complete, professional workout. Nothing may be generated
that Haris would not approve under his own name.

Consumers that must keep it first: `workout-engine/prompt.server.ts` (member workouts, Smarty
Coach, admin workouts — `system` starts with it), `_shared/exercise-matching.ts`
(`fetchAndBuildExerciseReference` reference block starts with it — admin programs, batch and
repair generators), `generate-admin-program` (program naming and copy).

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
