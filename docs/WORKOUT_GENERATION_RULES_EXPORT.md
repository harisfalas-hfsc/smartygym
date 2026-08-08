# SmartyGym — Complete Workout Generation Rulebook (Copy-Paste Export)

This is the full, exported set of rules the AI is trained/constrained with when it
creates a workout in this project. Copy-paste the whole file into any new project.
Everything below is extracted from the live code:
`generate-admin-workout`, `_shared/periodization-84day.ts`, `_shared/section-validator.ts`,
`_shared/wod-quality-gate.ts`, `_shared/duration-calculator.ts`,
`_shared/generated-workout-contract.ts`, `_shared/exercise-matching.ts`.

---

## 0. IDENTITY & MODEL

- Author persona in every prompt: **"You are Haris Falas, Sports Scientist (CSCS)."**
- Model: `google/gemini-3-flash-preview` via the Lovable AI gateway, `temperature: 0.4`.
- One generate click = one AI request. No fallback model cascade (credit protection).
- Output must be **pure JSON, no markdown**:

```json
{
  "name": "2-4 word creative name (unique)",
  "description": "<p class=\"tiptap-paragraph\">2-3 sentences tied to the category.</p>",
  "main_workout": "Full structured HTML with library-first markup",
  "instructions": "<p class=\"tiptap-paragraph\">How to perform this workout</p>",
  "tips": "<p class=\"tiptap-paragraph\">Tip 1</p><p class=\"tiptap-paragraph\">Tip 2</p><p class=\"tiptap-paragraph\">Tip 3</p>"
}
```

---

## 1. LIBRARY-FIRST EXERCISE RULE (non-negotiable)

- Every exercise reference inside `main_workout` MUST use the markup:
  `{{exercise:ID:Name}}` — e.g. `{{exercise:0043:barbell full squat}}`.
- IDs must be **real library IDs** (short alphanumeric, e.g. `0043`, `1160`, `3637`).
  Slug-style IDs (`bird-dog`, `glute-bridge`) are rejected as fake.
- The token Name must be the **exact library name** for that ID. Renamed/invented names fail.
- Never invent exercises. Never write a plain exercise name without markup.
- Exception: 🧽 Soft Tissue Preparation must contain **no** tokens at all (see §4).

### Exercise pool filter order (applied before the AI ever sees the list)
1. Load the **entire** `exercises` table (paginated, 1000/page).
2. If category = CHALLENGE → strip all stretching/mobility exercises from the pool.
3. Equipment filter:
   - `BODYWEIGHT` → `equipment = "body weight"`, then a **home-bodyweight guardrail** removes
     apparatus-dependent movements (bars, cages, machines, rings, sleds…).
   - `EQUIPMENT` → everything that is NOT bodyweight.
4. Strict difficulty filter: exercise `difficulty` must equal `beginner` / `intermediate` / `advanced`
   matching the requested level. No level mixing.
5. Static-hold guardrail removes holds from the momentum/conditioning matching pool.
6. The resulting filtered list is injected into the prompt as the ONLY allowed vocabulary.

### 4-layer post-generation enforcement (after the AI answers)
1. `repairInvalidExerciseTokens` — fix malformed tokens (`exrcise`, `excercise`), remap by ID then by name.
2. `processContentSectionAware` — section-aware matching of plain names to library items.
3. `guaranteeAllExercisesLinked` — sweep pass; forces any remaining plain name into a token.
4. `rejectNonLibraryExercises` — substitutes anything still not in the library; unmatched names are
   logged to the unmatched-exercise table for review.
Plus: `relinkPlainMinuteParagraphs` (EMOM minute lines), `repairStaticHoldPrescriptions`,
`removeStaticHoldsFromMomentumSections`.

---

## 2. WORKOUT SPEC INPUTS

| Input | Values |
|---|---|
| Category | STRENGTH, CALORIE BURNING, METABOLIC, CARDIO, MOBILITY & STABILITY, CHALLENGE, PILATES, RECOVERY, MICRO-WORKOUTS |
| Equipment | BODYWEIGHT (home/office friendly) or EQUIPMENT (barbell/DB/KB/cable/machines/bands) |
| Difficulty | 0–6 stars → 0 = All Levels, 1–2 Beginner, 3–4 Intermediate, 5–6 Advanced |
| Format | TABATA, CIRCUIT, AMRAP, FOR TIME, EMOM, REPS & SETS, MIX |
| Duration | e.g. "30 min" (MICRO-WORKOUTS forced to "5 min") |
| Focus | STRENGTH only (see §6) |
| Access | free / premium / standalone |

ID prefixes per category: S, CB, ME, C, M, CH, PIL, REC, MW → e.g. `S-014`.

---

## 3. FORMAT RULES BY CATEGORY (STRICT)

```
STRENGTH             → REPS & SETS   (only)
MOBILITY & STABILITY → REPS & SETS   (only)
PILATES              → REPS & SETS   (only)
RECOVERY             → MIX           (only)
CARDIO               → CIRCUIT | EMOM | FOR TIME | AMRAP | TABATA
METABOLIC            → CIRCUIT | AMRAP | EMOM | FOR TIME | TABATA
CALORIE BURNING      → CIRCUIT | TABATA | AMRAP | FOR TIME | EMOM
CHALLENGE            → CIRCUIT | TABATA | AMRAP | EMOM | FOR TIME | MIX
```
A database trigger auto-corrects the format if it drifts from this table.

### Format writing guidance given to the AI
- **AMRAP** — header `Main Workout (AMRAP)`; state the time cap in a separate paragraph; 4–6 exercises with rep targets BEFORE each token.
- **EMOM** — header `Main Workout (EMOM)`; label every minute; reps/time BEFORE each token.
- **CIRCUIT** — header `Main Workout (CIRCUIT)`; rounds/rest in a separate paragraph; 5–7 stations with reps/time BEFORE each token.
- **TABATA** — header `Main Workout (TABATA)`; 8 rounds × 20s work / 10s rest; "20 sec" BEFORE every token.
- **FOR TIME** — header `Main Workout (For Time)`; chipper or rounds-for-time with reps BEFORE every token.
- **REPS & SETS** — each line starts with sets × reps, then the token, then readable tempo/rest:
  `4 sets × 8 reps {{exercise:ID:Name}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 90 sec`
- **MIX** — a properly prescribed REPS & SETS strength portion + a properly prescribed metabolic finisher.

---

## 4. MANDATORY SECTION STRUCTURE

### Standard workout (5 sections, exact icon order)
1. 🧽 **Soft Tissue Preparation** — FOAM ROLLING ONLY, no library markup.
2. 🔥 **Activation** — library exercises with markup.
3. 💪 **Main Workout** — library exercises with markup (minimum 3–4).
4. ⚡ **Finisher** — library exercises with markup (minimum 3).
5. 🧘 **Cool Down** — library stretches & breathing with markup.

RECOVERY days: 4 sections (no ⚡ Finisher).

### MICRO-WORKOUT (total exactly 5 minutes)
1. 🔥 Activation 1' — 1–2 library exercises, 20–30s each
2. 💪 Main Workout 3' — 3–4 library exercises, body-only or chair/desk/wall/stairs
3. 🧘 Cool Down 1' — 1–2 library stretches
No 🧽 Soft Tissue, no ⚡ Finisher. Duration headers must sum to exactly 5'.

### Section title HTML
```html
<p class="tiptap-paragraph">🔥 <strong><u>Activation 5'</u></strong></p>
```
Only ONE icon per section. Exactly one empty paragraph between sections:
`<p class="tiptap-paragraph"></p>`

### Exercise line HTML (bullet lists only)
```html
<ul class="tiptap-bullet-list">
  <li class="tiptap-list-item"><p class="tiptap-paragraph">12 reps {{exercise:ID:Name}}</p></li>
</ul>
```

### 🧽 Soft Tissue Preparation rules
- Allowed line starters ONLY: `Foam roll`, `Foam-roll`, `Foam roller`, `Lacrosse ball`,
  `Tennis ball`, `Trigger point`, `Self-massage`, `Myofascial release`, `... release`.
- FORBIDDEN: `{{exercise:...}}` markup, and any of:
  stretch, circle, raise, swing, lunge, pose, march, bridge, squat, press, row, curl,
  twist, hydrant, cobra, cat-cow, sun salutation.
- Dynamic stretches/mobility belong in 🔥 Activation. Static stretches belong in 🧘 Cool Down.

### Protocol headers
- `Main Workout (FORMAT)` — never put a duration inside a protocol header.
- Finisher: `Finisher (REPS & SETS)` for STRENGTH / MOBILITY & STABILITY / PILATES;
  otherwise `Finisher (For Time)` or `Finisher (AMRAP)`, with the cap/rounds in the paragraph below.

---

## 5. PRESCRIPTION RULES (non-negotiable)

- Every Main Workout and Finisher exercise line MUST place the measurable dose **BEFORE** the token.
- Correct: `4 sets × 6 reps {{exercise:0043:barbell full squat}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 150 sec`
- Conditioning: `15 reps {{exercise:1160:burpee}}`, `40 sec {{exercise:0630:mountain climber}}`, `200m {{exercise:0685:run}}`.
- FORBIDDEN: naked tokens; reps explained later; compact tempo codes in output
  (20X0, 31X1, 41X1, 21X1 → must be converted to readable coaching language).
- FORBIDDEN: tempo or rest on a separate bullet after the exercise. Tempo + rest are inline on the
  SAME `<li>` as the token. An orphan bullet whose entire content is a tempo code or "rest N sec"
  is auto-merged into the previous line.
- REPS & SETS sanity limits: sets 1–6, reps 1–25. Anything outside is a hard failure.

Accepted dose units: reps, sec/seconds, min/minutes, m/meters, km, cal/calories, rounds,
`N sets × N`, or an `EMOM Minute N:` label.

---

## 6. CATEGORY COACHING RULES (exact prompt text)

**STRENGTH** — Heavy compound lifts with reps & sets prescriptions. Long rest (90–180s).
Bodyweight variant: bodyweight progressions only. Equipment variant: barbell/DB/KB/cable as appropriate.

**CALORIE BURNING**
- Bodyweight: high-output bodyweight conditioning — burpees, jump squats, mountain climbers, plyo push-ups, jumping lunges.
- Equipment: KB swings, DB thrusters, rowing intervals, sled push, battle ropes.

**METABOLIC**
- Bodyweight: full-body metabolic circuits — push/pull/squat/hinge bodyweight movements with minimal rest.
- Equipment: full-body circuits combining strength + conditioning — DB/KB/barbell complexes, thrusters, devil press.

**CARDIO**
- Bodyweight: sustained heart-rate work — jumping jacks, skater jumps, high knees, mountain climbers, burpees.
- Equipment: rower, assault bike, jump rope, KB swings, ski erg, sled work.

**MOBILITY & STABILITY**
- Bodyweight: controlled mobility & stability ONLY — CARs, balance holds, bird dog, side bridge, cat-cow, ankle/wrist circles, slow breathing.
  HARD BAN: jumps, burpees, plyometrics, heavy strength, push-ups, crunches, sit-ups, dynamic leg-raise core.
- Equipment: bands, balance board, foam roller, exercise ball, rope-assisted stretches.
  HARD BAN: KB power work, heavy strength, conditioning, crunches, sit-ups.
- Enforced ban list (regex, rejects the workout): jump squat/box jump/tuck jump/skater jump/jumping lunge/jumping jacks/
  high knees/burpees/mountain climbers/sprints/shuttle runs/run/fast feet; KB swings/snatch/clean & jerk/power clean/
  thrusters/battle ropes/wall balls/slam balls/tire flips; bench press/shoulder press/triceps press/biceps curl/seated row/
  chin-ups/pull-ups/bench dips/push-ups (scapula push-up allowed); barbell full squat/goblet squat/pistol squat/walking lunge/
  RDL/stiff-leg deadlift; crunches/sit-ups/russian twists/bicycle crunch/leg raises/reverse crunch.

**CHALLENGE** (gamified benchmark work)
- Bodyweight: test-style challenge — AMRAP/For-Time pieces, multiple rounds, varied high-output patterns.
- Equipment: rounds-for-time, complex chippers, mixed modality — loaded conditioning, carries, swings, thrusters,
  rowing/bike/jump rope, squats, hinges, pushes, pulls, core under fatigue.
- HARD BAN in Main Workout and Finisher: stretching, mobility, yoga poses, static flexibility drills, recovery exercises.
  Challenge means benchmark intensity, capacity, time pressure, reps, rounds and discomfort tolerance — not stretching.
- Enforced: stretching/mobility exercises are removed from the pool before generation AND rejected if they appear
  in 💪 or ⚡ (includes cat-cow, cobra, sphinx, upward facing dog, child's pose, pigeon, butterfly, world's greatest stretch,
  hamstring/quad/calf/adductor/piriformis/glute/triceps/upper-back stretches, skin the cat, inchworm).

**PILATES** — Pilates studio standard: mat, reformer, magic circle, Pilates ball, light dumbbells, resistance bands ONLY.
FORBIDDEN: kettlebells, barbells, heavy DBs, machines, cables, plyometrics, conditioning movements.
Focus on controlled spinal articulation, deep core, breath-led tempo, REPS & SETS prescriptions.

**RECOVERY** — PNF stretching, CARs (controlled articular rotations), nasal/box breathing, gentle mobility.
No plyometrics, no conditioning, no heavy lifting, no crunches/sit-ups. Format MIX. No Finisher required.

**MICRO-WORKOUTS** — 5 minutes total. Bodyweight ONLY plus chair / sofa / desk / stairs / wall.
FORBIDDEN: dumbbells, kettlebells, barbells, bands, machines, air bike, rower, jump rope, treadmill, sled.
Must be doable in office clothes in a small space. DB trigger rejects any micro-workout that breaks this.

---

## 7. STRENGTH FOCUS SPLITS

| Focus | Muscles | Allowed patterns | Forbidden patterns |
|---|---|---|---|
| LOWER BODY | quads, hamstrings, calves, glutes, adductors, abductors | squats, lunges, leg press, hip thrusts, leg curls, leg extensions, calf raises, step-ups, Bulgarian splits | chest press, bench press, shoulder press, rows, pull-ups, bicep curls, tricep extensions |
| UPPER BODY | chest, back, shoulders, biceps, triceps | pressing, pulling, curls, extensions, rows, flys, pulldowns, push-ups, dips | squats, lunges, leg press, deadlifts, hip thrusts, leg curls, calf raises |
| FULL BODY | balanced all groups | upper push, upper pull, lower push, lower pull, core stability | — |
| LOW PUSH & UPPER PULL | quads, glutes, back, biceps, rear delts | squats, lunges, leg press, step-ups, hip thrusts, rows, pull-ups, pulldowns, curls, face pulls | deadlifts, RDLs, leg curls, bench press, shoulder press, push-ups, tricep work |
| LOW PULL & UPPER PUSH | hamstrings, glutes, chest, shoulders, triceps | deadlifts, RDLs, leg curls, hip hinges, glute-ham raises, bench press, shoulder press, push-ups, tricep work, dips, flys | squats, lunges, leg press, step-ups, rows, pull-ups, bicep curls |
| CORE & GLUTES | core, glutes, hip stabilizers | anti-rotation, planks, dead bugs, pallof press, bird dogs, hip thrusts, glute bridges, banded work, kickbacks, clamshells | squats, bench press, rows, shoulder press, compound lifts, arm isolation |

---

## 8. NAMING RULES

- 2–4 word creative name, premium signature feel, must hint at the category (and focus for STRENGTH).
- AVOID overused words: Inferno, Blaze, Fire, Burn, Fury, Storm, Thunder, Power, Beast, Warrior, Elite,
  Ultimate, Extreme, Foundation, Torch, Melt, Engine, Drive, Catalyst, Flow, Restore, Gauntlet, Summit, Crucible.
- STRICTLY FORBIDDEN: internal codes/suffixes — "CAL-813", "STR-204", "BW1230", "V2", "#3",
  roman numerals (II, III, IV…), any digits, any 3-letter uppercase abbreviation followed by a number.
- All existing workout names are injected as a BANNED list; no reuse and no trivial variation.
- Collision handling: append the format word (Circuit, AMRAP, EMOM, Ladder, Intervals, Tabata, For Time, Pyramid)
  or the category word (Strength / Conditioning / Engine / Cardio / Control / Pilates / Recovery / Challenge).

---

## 9. QUALITY GATE (publish blockers)

**Minimum Main + Finisher minutes**
- Beginner (1–2★): 20 min
- Intermediate (3–4★): 28 min
- Advanced (5–6★): 35 min for TABATA, 38 min otherwise
- RECOVERY: 25 min (recovery days otherwise skip the gate)
- REPS & SETS is exempt from the duration check (load/tempo/rest dependent → duration label "Various").
- 1-minute tolerance allowed on computed minutes.

**Structure checks per section**
- EMOM: must declare "N-minute EMOM" or `Minute N:` labels plus "Repeat N rounds = M minutes".
- AMRAP: must declare a time cap ("in N minutes" / "N-minute AMRAP" / "cap: N min").
- FOR TIME / CIRCUIT: must declare rounds, a time cap, an ascending/descending ladder (≥3 lines),
  or be a single very-high-volume piece (≥50 reps). One round of a short rep list is invalid.
- TABATA: must declare 20s/10s × 8 or list ≥2 Tabata blocks (each Tabata exercise = 4 min).
- STRENGTH / MOBILITY & STABILITY / PILATES: Main AND Finisher must both explicitly declare REPS & SETS.
- Finisher must always declare structure (rounds / sets / AMRAP cap / EMOM / Tabata / Complete N).

**Density minimums**
- Main Workout ≥ 3 exercise tokens (prompt asks for ≥4).
- Finisher ≥ 3 exercise tokens.

**Per-line check** — every token line in 💪 and ⚡ must carry a measurable dose before the token.

**Content-wipe protection** — a DB trigger blocks replacing an existing visible workout body with an
empty or severely shortened one.

---

## 10. DURATION CALCULATION (advertised duration)

Advertised duration = 💪 Main + ⚡ Finisher only (warm-up and cool-down excluded).
- TABATA → 4 min × number of prescribed Tabata exercises
- EMOM → max `Minute N` label × rounds, or explicit "N-minute EMOM"
- AMRAP / FOR TIME → explicit cap if present, otherwise estimated
- CIRCUIT / fallback estimate → per-line work seconds + 10s transitions per gap, × rounds, + rest between rounds
  - seconds/rep: 4 for squat/deadlift/press/row/lunge/pull/curl/extension, 2 for climber/jack/high knees/butt kicks, 3 default
  - "each side/per side/single arm/single leg" doubles the reps
  - meters → max(20, meters × 0.45) seconds
- REPS & SETS → returns 0 → label shown as **"Various"**

---

## 11. GENERATION PIPELINE (order of operations)

1. Load banned names (all existing workout names).
2. Build the filtered exercise reference list (§1).
3. Build the prompt (spec + category rules + naming + library + structure + format + prescriptions).
4. Single AI call.
5. Strip internal-style codes from the name; resolve name collisions.
6. Repair invalid tokens → section-aware match → sweep link → reject non-library → relink EMOM minute lines →
   repair static-hold prescriptions → remove static holds from momentum sections.
7. Merge orphan tempo/rest bullets; humanize tempo/rest wording; strip durations from protocol headers.
8. Normalize HTML (`normalizeWorkoutHtml`) + validate HTML.
9. Validate sections (icons, density, soft-tissue purity, category compatibility).
10. Validate protocol blocks.
11. Apply the WOD quality gate.
12. Prescription-safety validation (dose before token, tempo without sets, set/rep sanity).
13. Generated-workout contract (token realism, section presence, per-section prescriptions).
14. Any failure → the draft is returned with `needs_review = true` and the exact warnings listed,
    so nothing broken can be saved silently.

---

## 12. WOD PERIODIZATION (84-day cycle)

Cycle start: **2025-11-25** = Day 1. `dayIn84 = ((daysSinceStart % 84) + 84) % 84 + 1`.
Difficulty is a star RANGE per day; a random endpoint of the range is picked.
MICRO-WORKOUTS never appear in the WOD cycle. Each day produces one BODYWEIGHT and one
EQUIPMENT variant (RECOVERY produces a single VARIOUS variant). Both variants must pass —
all-or-none publishing.

### Cycle 1 (Days 1–28)
```
1  CARDIO Beg(1-2)        15 STRENGTH Beg(1-2) LOW PUSH & UPPER PULL
2  STRENGTH Adv(5-6) LOWER BODY   16 PILATES Beg(1-2)
3  MOBILITY & STABILITY Int(3-4)  17 CALORIE BURNING Adv(5-6)
4  CHALLENGE Adv(5-6)             18 METABOLIC Int(3-4)
5  STRENGTH Int(3-4) UPPER BODY   19 CARDIO Adv(5-6)
6  PILATES Adv(5-6)               20 STRENGTH Int(3-4) LOW PULL & UPPER PUSH
7  CALORIE BURNING Int(3-4)       21 MOBILITY & STABILITY Beg(1-2)
8  METABOLIC Beg(1-2)             22 CHALLENGE Int(3-4)
9  CHALLENGE Adv(5-6)             23 STRENGTH Adv(5-6) CORE & GLUTES
10 RECOVERY                       24 PILATES Int(3-4)
11 CARDIO Int(3-4)                25 CALORIE BURNING Beg(1-2)
12 STRENGTH Adv(5-6) FULL BODY    26 METABOLIC Adv(5-6)
13 MOBILITY & STABILITY Adv(5-6)  27 CHALLENGE Int(3-4)
14 CHALLENGE Int(3-4)             28 RECOVERY
```
### Cycle 2 (Days 29–56) — same category order, strength difficulties rotate
```
29 CARDIO Beg            43 STRENGTH Adv LOW PUSH & UPPER PULL
30 STRENGTH Int LOWER    44 PILATES Beg
31 MOBILITY Int          45 CALORIE BURNING Adv
32 CHALLENGE Adv         46 METABOLIC Int
33 STRENGTH Beg UPPER    47 CARDIO Adv
34 PILATES Adv           48 STRENGTH Beg LOW PULL & UPPER PUSH
35 CALORIE BURNING Int   49 MOBILITY Beg
36 METABOLIC Beg         50 CHALLENGE Int
37 CHALLENGE Adv         51 STRENGTH Int CORE & GLUTES
38 RECOVERY              52 PILATES Int
39 CARDIO Int            53 CALORIE BURNING Beg
40 STRENGTH Beg FULL     54 METABOLIC Adv
41 MOBILITY Adv          55 CHALLENGE Int
42 CHALLENGE Int         56 RECOVERY
```
### Cycle 3 (Days 57–84) — strength difficulties rotate again
```
57 CARDIO Beg            71 STRENGTH Int LOW PUSH & UPPER PULL
58 STRENGTH Beg LOWER    72 PILATES Beg
59 MOBILITY Int          73 CALORIE BURNING Adv
60 CHALLENGE Adv         74 METABOLIC Int
61 STRENGTH Adv UPPER    75 CARDIO Adv
62 PILATES Adv           76 STRENGTH Adv LOW PULL & UPPER PUSH
63 CALORIE BURNING Int   77 MOBILITY Beg
64 METABOLIC Beg         78 CHALLENGE Int
65 CHALLENGE Adv         79 STRENGTH Beg CORE & GLUTES
66 RECOVERY              80 PILATES Int
67 CARDIO Int            81 CALORIE BURNING Beg
68 STRENGTH Int FULL     82 METABOLIC Adv
69 MOBILITY Adv          83 CHALLENGE Int
70 CHALLENGE Int         84 RECOVERY
```

---

## 13. READY-TO-USE SYSTEM PROMPT SKELETON

```
You are Haris Falas, Sports Scientist (CSCS), creating a custom {DIFFICULTY} {CATEGORY} workout.

WORKOUT SPEC:
- Category: {CATEGORY}
- Equipment: {BODYWEIGHT ONLY (home/office friendly) | GYM EQUIPMENT (barbell/DB/KB/cable/machines/bands)}
- Difficulty: {LEVEL} ({STARS} stars out of 6)
- Format: {FORMAT}
- Total Duration: {DURATION}
- Strength Focus: {FOCUS}          (STRENGTH only)

CATEGORY COACHING RULES:
{paste the matching block from §6}

NAMING:
{paste §8}

EXERCISE LIBRARY (USE EXCLUSIVELY — library-first):
{filtered list of "ID | Name | equipment | target | difficulty"}

Every exercise reference in main_workout MUST use the markup {{exercise:ID:Name}}.
Never invent exercises. Never use plain names.

{paste §4 structure rules for standard or micro}
{paste §5 prescription rules}
{paste the matching format guidance from §3}

RESPONSE FORMAT (JSON ONLY — NO MARKDOWN): {see §0}
```
