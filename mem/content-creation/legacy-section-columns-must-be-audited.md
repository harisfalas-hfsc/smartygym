---
name: Legacy per-section columns must be audited
description: admin_workouts warm_up/activation/finisher/cool_down columns render in the player and must never hold content the auditor ignores
type: feature
---
`admin_workouts` has legacy per-section columns (`warm_up`, `activation`, `finisher`, `cool_down`).
The player joins them with `main_workout` (order: activation, warm_up, main_workout, finisher, cool_down),
so anything stored there IS shown to the athlete.

Rules:
- The compliance auditor builds its HTML from all five fields, never `main_workout` alone.
- A legacy column repeating a section already present in `main_workout` is a hard `DUPLICATE_SECTION` error.
- Canonical storage is `main_workout` only; legacy columns are kept null.
- Cleared across the library on 2026-09-19 (backup reason `pre-legacy-section-repair-2026-09-19`).
