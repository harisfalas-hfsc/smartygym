## Active tasks
- [x] Read-only reliability review of Admin workout creation and member Create Your Own Workout; no live generations or AI-credit use
- [x] Diagnose why category-incompatible exercises passed generation and compliance checks
- [x] Harden Calorie Burning so only simple, continuous, low-setup movements pass
- [x] Repair every workout exposed by the full category and section-aware re-audit
- [x] Reject preparation/recovery drills such as wrist circles from conditioning work and finishers
- [x] Apply global banned-movement checks to every playable section
- [x] Preserve player structure, publication, pricing, purchases, images, and payment associations
- [x] Re-audit all 536 workouts and verify every player token resolves

- [x] Universal work-slot rule: stretches/joint circles banned from Main Workout & Finisher in every category except Mobility & Stability, Recovery, Pilates. 32 workouts repaired (69 swaps, no AI credits), backup `pre-work-slot-stretch-repair-2026-09-19`.

- [x] Master sellability audit (2026-09-19): bar/dip/hanging/landing-dependent movements banned in conditioning and dynamic formats; 117 workouts repaired (163 swaps, zero AI credits), backup `pre-master-sellability-repair-2026-09-19`.
- [x] Duration honesty: ±10 min tolerance both ways; estimator now honours declared block clocks (EMOM/AMRAP caps, written totals).
- [x] Training-program day audit: 12 programs repaired — 16 thin Main Workout days filled, 44 empty Finishers given real linked exercises; backup `/tmp/repair/program_backup_2026-09-19.json`.
- [x] Final state: 536/536 workouts pass, 0 warnings, 0 failures; 32/32 programs clean; 7,372 links, 0 orphans; visibility, pricing and Stripe links untouched.
