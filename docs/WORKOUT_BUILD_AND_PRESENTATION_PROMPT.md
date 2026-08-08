# ONE COMPLETE COPY-PASTE DOCUMENT — WORKOUT CREATION, PUBLISHED PAGE, EXERCISE VIEW, TOOLS, READER MODE & PLAYER

Copy this entire document into Lovable in one message. This is the only workout document required.
It defines both the workout-generation engine and every part of the finished workout experience:

1. Library-only exercise selection and category-specific coaching rules.
2. Workout structure, prescriptions, validation and generated fields.
3. The complete published workout page and its visual hierarchy.
4. The eye button and exercise-detail dialog with GIF, description and instructions.
5. The workout tools, Reader Mode and full workout Player.
6. Player parsing, carousel, timer, Tabata, manual exercises and section transitions.
7. Completion, rating, notes, favourites, sharing, scheduling and calendar export.

There is **no periodization, daily cycle or category rotation**. If a user asks for Strength repeatedly,
create Strength repeatedly. The requested category, equipment, difficulty, duration and format control each workout.

---

# PROMPT START

Build the workout engine and the complete published workout experience exactly to this specification.
Do not implement only the generator. Do not stop after rendering workout text. The published page, exercise
eye buttons, detail dialog, tools, Reader Mode and Player are all mandatory parts of the same deliverable.

## PART A — HOW A WORKOUT IS CREATED

### A0. Identity & output
- Coaching persona for the generator: **"You are a Sports Scientist (CSCS)."**
- One user request = one AI call (no model cascade). Temperature 0.4.
- The model returns **pure JSON, no markdown**:

```json
{
  "name": "2-4 word creative name (unique)",
  "description": "<p class=\"tiptap-paragraph\">2-3 sentences tied to the category.</p>",
  "main_workout": "Full structured HTML with library-first markup",
  "instructions": "<p class=\"tiptap-paragraph\">How to perform this workout</p>",
  "tips": "<p class=\"tiptap-paragraph\">Tip 1</p><p class=\"tiptap-paragraph\">Tip 2</p><p class=\"tiptap-paragraph\">Tip 3</p>"
}
```
- No periodization table, no day-of-cycle logic, no forced category rotation.
  The category, equipment, difficulty and duration come **only** from the user's request/questionnaire.

### A1. Library-first exercise rule (non-negotiable)
- Every exercise reference must be written as `{{exercise:ID:Name}}`
  (e.g. `{{exercise:0043:barbell full squat}}`).
- IDs must be **real library IDs** from the `exercises` table (short alphanumeric like `0043`, `1160`).
  Slug IDs (`bird-dog`) are fake and rejected.
- The Name in the token must be the **exact library name** for that ID.
- Never invent an exercise. Never write a plain exercise name without markup.
- Exception: 🧽 Soft Tissue Preparation contains **no** tokens at all.

**Exercise pool filter order (applied before the model sees anything):**
1. Load the entire `exercises` table (paginated 1000/page).
2. If category = CHALLENGE → strip all stretching/mobility exercises from the pool.
3. Equipment filter:
   - `BODYWEIGHT` → `equipment = "body weight"`, then a home-bodyweight guardrail removes
     apparatus movements (bars, cages, machines, rings, sleds).
   - `EQUIPMENT` → everything that is not bodyweight.
4. Strict difficulty match: beginner / intermediate / advanced — no level mixing.
5. Static-hold guardrail removes holds from momentum/conditioning matching.
6. The filtered list is injected into the prompt as the ONLY allowed vocabulary.

**4-layer post-generation enforcement:**
1. Repair malformed tokens (`exrcise`, `excercise`), remap by ID then by name.
2. Section-aware matching of plain names to library items.
3. Sweep pass that forces any remaining plain name into a token.
4. Reject non-library exercises (substitute); log unmatched names for review.
Plus: relink plain EMOM minute lines, repair static-hold prescriptions,
remove static holds from momentum sections.

### A2. Inputs
| Input | Values |
|---|---|
| Category | STRENGTH, CALORIE BURNING, METABOLIC, CARDIO, MOBILITY & STABILITY, CHALLENGE, PILATES, RECOVERY, MICRO-WORKOUTS |
| Equipment | BODYWEIGHT or EQUIPMENT |
| Difficulty | 0–6 stars → 0 All Levels, 1–2 Beginner, 3–4 Intermediate, 5–6 Advanced |
| Format | TABATA, CIRCUIT, AMRAP, FOR TIME, EMOM, REPS & SETS, MIX |
| Duration | e.g. "30 min" (MICRO-WORKOUTS forced to "5 min") |
| Focus | STRENGTH only |

### A3. Format by category (strict)
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
Writing rules:
- **AMRAP** — header `Main Workout (AMRAP)`; time cap in its own paragraph; 4–6 exercises, reps before each token.
- **EMOM** — header `Main Workout (EMOM)`; every minute labelled `Minute N:`; dose before each token.
- **CIRCUIT** — header `Main Workout (CIRCUIT)`; rounds + rest in their own paragraph; 5–7 stations.
- **TABATA** — header `Main Workout (TABATA)`; 8 rounds × 20s work / 10s rest; "20 sec" before every token.
- **FOR TIME** — header `Main Workout (For Time)`; chipper or rounds-for-time, reps before every token.
- **REPS & SETS** — `4 sets × 8 reps {{exercise:ID:Name}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 90 sec`
- **MIX** — a prescribed REPS & SETS strength portion + a prescribed metabolic finisher.

### A4. Mandatory section structure
Standard workout — 5 sections, exact icons and order:
1. 🧽 **Soft Tissue Preparation** — foam rolling only, no markup.
2. 🔥 **Activation** — library exercises with markup.
3. 💪 **Main Workout** — library exercises (minimum 4; hard floor 3).
4. ⚡ **Finisher** — library exercises (minimum 3).
5. 🧘 **Cool Down** — library stretches & breathing.

RECOVERY: 4 sections (no Finisher).
MICRO-WORKOUT (exactly 5 min): 🔥 Activation 1' → 💪 Main Workout 3' → 🧘 Cool Down 1'.

Section title HTML:
```html
<p class="tiptap-paragraph">🔥 <strong><u>Activation 5'</u></strong></p>
```
One icon per section, exactly one `<p class="tiptap-paragraph"></p>` between sections.

Exercise line HTML (bullet lists only):
```html
<ul class="tiptap-bullet-list">
  <li class="tiptap-list-item"><p class="tiptap-paragraph">12 reps {{exercise:ID:Name}}</p></li>
</ul>
```

Soft Tissue rules — allowed starters ONLY: `Foam roll`, `Foam-roll`, `Foam roller`, `Lacrosse ball`,
`Tennis ball`, `Trigger point`, `Self-massage`, `Myofascial release`, `... release`.
Forbidden there: any `{{exercise:}}` token, and stretch / circle / raise / swing / lunge / pose / march /
bridge / squat / press / row / curl / twist / hydrant / cobra / cat-cow / sun salutation.
Dynamic stretches → Activation. Static stretches → Cool Down.

Protocol headers: `Main Workout (FORMAT)`; never a duration inside a protocol header.
Finisher header: `Finisher (REPS & SETS)` for STRENGTH / MOBILITY & STABILITY / PILATES,
otherwise `Finisher (For Time)` or `Finisher (AMRAP)` with the cap/rounds in the paragraph below.

### A5. Prescription rules
- The measurable dose always comes **BEFORE** the token.
- Conditioning examples: `15 reps {{exercise:1160:burpee}}`, `40 sec {{exercise:0630:mountain climber}}`, `200m {{exercise:0685:run}}`.
- Forbidden: naked tokens, dose explained after the token, compact tempo codes (20X0, 31X1 → write readable coaching language).
- Tempo and rest stay **inline on the same `<li>`** as the token; an orphan bullet that is only a tempo
  or "rest N sec" is merged into the previous line.
- REPS & SETS sanity: sets 1–6, reps 1–25.
- Accepted units: reps, sec, min, m, km, cal, rounds, `N sets × N`, `EMOM Minute N:`.

### A6. Category coaching rules (why we pick what we pick)
**STRENGTH** — heavy compound lifts, reps & sets, long rest 90–180s. Bodyweight variant = bodyweight
progressions only; equipment variant = barbell/DB/KB/cable.

**CALORIE BURNING** — bodyweight: burpees, jump squats, mountain climbers, plyo push-ups, jumping lunges.
Equipment: KB swings, DB thrusters, rowing intervals, sled push, battle ropes.

**METABOLIC** — bodyweight: push/pull/squat/hinge circuits with minimal rest. Equipment: DB/KB/barbell
complexes, thrusters, devil press.

**CARDIO** — bodyweight: jumping jacks, skater jumps, high knees, mountain climbers, burpees.
Equipment: rower, assault bike, jump rope, KB swings, ski erg, sled.

**MOBILITY & STABILITY** — controlled mobility & stability ONLY: CARs, balance holds, bird dog, side bridge,
cat-cow, ankle/wrist circles, slow breathing. Equipment variant: bands, balance board, foam roller, ball,
rope-assisted stretches. HARD BAN: jumps, burpees, plyometrics, heavy strength, push-ups, crunches, sit-ups,
dynamic leg-raise core, KB power work, conditioning.

**CHALLENGE (gamified benchmark work)** — bodyweight: test-style AMRAP / For-Time pieces, multiple rounds,
varied high-output patterns. Equipment: rounds-for-time, chippers, mixed modality — loaded conditioning,
carries, swings, thrusters, rowing/bike/rope, squats, hinges, pushes, pulls, core under fatigue.
HARD BAN in 💪 and ⚡: stretching, mobility, yoga poses, static flexibility, recovery drills.
Challenge = benchmark intensity, capacity, time pressure, reps, rounds, discomfort tolerance — never stretching.
Enforcement: stretching/mobility is removed from the pool before generation AND rejected if it appears
(cat-cow, cobra, sphinx, upward facing dog, child's pose, pigeon, butterfly, world's greatest stretch,
hamstring/quad/calf/adductor/piriformis/glute/triceps/upper-back stretches, skin the cat, inchworm).

**PILATES** — mat, reformer, magic circle, Pilates ball, light dumbbells, bands ONLY.
Forbidden: kettlebells, barbells, heavy DBs, machines, cables, plyometrics, conditioning.
Controlled spinal articulation, deep core, breath-led tempo, REPS & SETS.

**RECOVERY** — PNF stretching, CARs, nasal/box breathing, gentle mobility. No plyometrics, no conditioning,
no heavy lifting, no crunches/sit-ups. Format MIX, no Finisher.

**MICRO-WORKOUTS** — 5 minutes, bodyweight only + chair / sofa / desk / stairs / wall. Forbidden: dumbbells,
kettlebells, barbells, bands, machines, bike, rower, rope, treadmill, sled. Must be doable in office clothes.

### A7. Strength focus splits
| Focus | Allowed | Forbidden |
|---|---|---|
| LOWER BODY | squats, lunges, leg press, hip thrusts, leg curls/extensions, calf raises, step-ups, Bulgarian splits | any upper-body press/pull/arm work |
| UPPER BODY | pressing, pulling, curls, extensions, rows, flys, pulldowns, push-ups, dips | squats, lunges, leg press, deadlifts, hip thrusts, leg curls, calf raises |
| FULL BODY | upper push, upper pull, lower push, lower pull, core | — |
| LOW PUSH & UPPER PULL | squats, lunges, leg press, step-ups, hip thrusts, rows, pull-ups, pulldowns, curls, face pulls | deadlifts, RDLs, leg curls, bench/shoulder press, push-ups, triceps |
| LOW PULL & UPPER PUSH | deadlifts, RDLs, leg curls, hinges, glute-ham raises, bench/shoulder press, push-ups, triceps, dips, flys | squats, lunges, leg press, step-ups, rows, pull-ups, curls |
| CORE & GLUTES | anti-rotation, planks, dead bugs, pallof press, bird dogs, hip thrusts, glute bridges, banded work, kickbacks, clamshells | squats, bench, rows, shoulder press, compounds, arm isolation |

### A8. Naming rules
2–4 word creative name hinting at the category (and focus for STRENGTH).
Avoid: Inferno, Blaze, Fire, Burn, Fury, Storm, Thunder, Power, Beast, Warrior, Elite, Ultimate, Extreme,
Foundation, Torch, Melt, Engine, Drive, Catalyst, Flow, Restore, Gauntlet, Summit, Crucible.
Strictly forbidden: internal codes ("CAL-813", "BW1230", "V2", "#3"), roman numerals, any digits,
3-letter uppercase abbreviation + number. Inject all existing names as a banned list.

### A9. Quality gate (publish blockers)
Minimum Main + Finisher minutes: Beginner 20, Intermediate 28, Advanced 35 (TABATA) / 38 (other),
RECOVERY 25. REPS & SETS is exempt (duration label = "Various"). 1-minute tolerance.
Structure: EMOM must declare minutes and rounds; AMRAP must declare a cap; FOR TIME / CIRCUIT must declare
rounds, cap, ladder (≥3 lines) or ≥50 reps; TABATA must declare 20/10 × 8 or ≥2 blocks;
STRENGTH / MOBILITY / PILATES must declare REPS & SETS in both Main and Finisher;
the Finisher always declares structure.
Density: Main ≥ 3 tokens, Finisher ≥ 3 tokens. Per-line: every token line in 💪 and ⚡ carries a dose before the token.

### A10. Advertised duration
Duration = 💪 Main + ⚡ Finisher only (warm-up/cool-down excluded).
TABATA → 4 min × Tabata exercises. EMOM → max minute label × rounds. AMRAP / FOR TIME → declared cap.
CIRCUIT/fallback → per-line work seconds + 10s transitions × rounds + inter-round rest
(4 s/rep for squat/deadlift/press/row/lunge/pull/curl/extension, 2 s for climber/jack/high knees/butt kicks,
3 s default; "each side" doubles reps; meters → max(20, m × 0.45) s). REPS & SETS → "Various".

### A11. Pipeline
1. Load banned names → 2. Build filtered exercise list → 3. Build prompt → 4. Single AI call →
5. Strip internal codes, resolve name collisions → 6. Token repair / matching / sweep / rejection /
EMOM relink / static-hold fixes → 7. Merge orphan tempo-rest bullets, humanize tempo & rest, strip durations
from protocol headers → 8. Normalize + validate HTML → 9. Validate sections → 10. Validate protocol blocks →
11. Quality gate → 12. Prescription safety → 13. Contract check → 14. Any failure ⇒ `needs_review = true`
with the exact warnings; never save a broken workout silently.

---

## PART B — HOW A WORKOUT IS PRESENTED

Build a `WorkoutDisplay` component rendered inside an access gate. Vertical order on the page:

The workout record must supply at least: `id`, `serial`, `name`, `description`, `category`, `focus`,
`difficulty`, `format`, `duration`, `equipment`, `image_url`, `activation`, `warm_up`, `main_workout`,
`finisher`, `cool_down`, `instructions`, `tips`, `created_by`, `created_at`, and access status. Store the
structured sections separately but join them for display with exactly one empty paragraph between sections.

### B1. Header block
1. `<h1>` workout name (`text-4xl font-bold`).
2. **🔍 Description card** — bordered card `border-2 border-primary/30`, header strip `bg-primary/5`,
   title `🔍 Description` (`text-2xl font-bold`), body = sanitized HTML.
3. Credit line: `Created by <Coach> — Sports Scientist & Strength and Conditioning Coach` (small, muted, link to coach profile).
4. **Info bar** (flex-wrap, `text-sm`, gap-6):
   - `Serial: <id>` (mono)
   - `Focus:` value in a filled `bg-primary text-primary-foreground` pill
   - `Difficulty:` 6 star icons, filled up to the star rating (`fill-primary text-primary`, empty = grey),
     followed by the word Beginner (≤2) / Intermediate (≤4) / Advanced (>4), or "All Levels" when 0
   - `Type:` uppercase pill with the format
   - `Duration:` value + an ⓘ tooltip: *"Duration covers the actual work time (Main Workout + Finisher).
     Add roughly 15–20 min for Warm-up + Cool Down."*
   - `Equipment:` value
5. **Hero image** — full width, `h-[300px] lg:h-[400px]`, rounded-2xl, `object-cover brightness-110`,
   with a top-fading black gradient overlay.

### B2. Sticky Tools bar
Directly under the hero: a sticky (`top-0 z-40`) bordered card with the label `Tools:` and four
icon buttons (40×40, outline):
- ⏱ **Workout Timer** popup
- 🔢 **Rounds Counter** popup
- 🧮 **1RM Calculator** popup
- 🏋 **Exercise Library** popup
Each opens a dialog; the bar stays visible while scrolling the workout.

### B3. "Start your workout" bar (the player entry)
Immediately below the tools bar, a **full-width clickable button**:
- `bg-primary text-primary-foreground`, `border-2 border-primary/40`, rounded-lg, shadow, bold,
  centred, with a filled ▶ Play icon and the text **"Start your workout"**.
- Clicking it parses the workout HTML into steps and opens the Player dialog.
- The bar renders only when at least one playable step exists.

### B4. Content cards
Each card: `border-2 border-primary/30`, header `bg-primary/5`, title `text-2xl font-bold` with its icon.
- **💪 Workout** — the five sections (Activation, Warm-up, Main Workout, Finisher, Cool Down) joined into
  ONE block with exactly one empty paragraph between sections, wrapped in `<div class="workout-content">`
  inside an A4-width container. Header right side holds a **Reader** button (book icon; icon-only under `lg`).
- **📋 Instructions** — same card style, with the exercise-library banner above the content.
- **💡 Tips** — same card style.
- (Programs reuse the same card with a **📆 Training Program** title.)

`.workout-content` CSS controls the reading rhythm: tightened paragraph/list spacing, list indentation,
and removal of empty tiptap paragraphs, so generated HTML always reads the same way.

### B5. The eye (exercise view) button
The workout HTML is rendered through an exercise-aware HTML renderer:
- It parses `{{exercise:ID:Name}}` markup, sanitizes the HTML (DOMPurify allow-list), and replaces each
  token with the exercise **name followed by a small ghost 👁 eye button** (`h-5 w-5`, primary-coloured icon,
  inline-flex, vertically aligned to the text).
- Clicking the eye opens the **Exercise Detail modal**: name, GIF / start-end frames, target muscles,
  equipment, difficulty, description and the numbered step-by-step instructions.
- If a token has no valid ID, the plain name is rendered with no eye.

**Exercise Detail modal behavior**
- Query the exercise by token ID, never by a fuzzy client-side name search.
- Show the looping GIF first. If it is missing, show the start and end frames; if all media is missing,
  show a stable "Demo not available" state without breaking the layout.
- Below the media show primary target, secondary muscles, equipment and difficulty.
- Show the complete library description, followed by an ordered list built from the library `instructions[]`.
- The dialog is scrollable on a phone, has an accessible title and close button, and returns the user to the
  same scroll position in the workout when closed.
- The eye button must remain inline beside the exercise name and must not alter the prescription text.

### B6. Reader Mode
Dialog, `max-w-4xl w-[95vw] h-[90vh]`, opened from the Reader button on the content card.
- Control bar: label "Reader Mode", font-size `−` / `size px` / `+` (range 14–28), divider, sun/moon theme toggle.
- Defaults every time it opens: **dark theme**, font 14px on mobile (<1024px), 18px on desktop.
- Body: the same exercise-linked content (eye buttons still work), sanitized, scrollable, comfortable
  line-height, optional metadata row (duration, equipment, category).

### B7. The Player (WorkoutPlayerDialog)
A non-modal dialog (`max-w-2xl w-[95vw]`) that cannot be dismissed by clicking outside or Esc-through —
only the ✕ button closes it.

**Step parsing** — the workout HTML is converted into a linear list of steps:
one step per `{{exercise:ID:Name}}` token, carrying `exerciseId`, `name`, `prescription`
(the surrounding text with the token and name stripped), `section` (from h2/h3/paragraph headings,
canonicalised to Soft Tissue Preparation / Activation / Warm-up / Main Workout / Finisher / Cool-down)
and `subSection` (Tabata / AMRAP / EMOM / Block N / Round N labels).

**Slides** — the step list becomes slides, with an extra **section-break slide** inserted whenever the
section changes: "Section complete → *previous section* → Next: *next section*" plus a **Continue** button.

**Layout**
- Header: workout title (tiny uppercase), then `Section · Exercise N of M`, plus ✕ close.
- Progress: one thin bar segment per step, filled in primary up to the active step.
- Carousel (Embla, swipeable, no loop): each slide shows section label (primary, uppercase), optional
  sub-section, exercise name, prescription text, then the exercise **GIF** from the library
  (fallback: start frame, then "Demo not available"), capped at `min(50vh, 340px)`.
- Left/right circular chevron arrows overlaid on the carousel, disabled at the ends.
- Control bar: timer read-out on the left, then Start-over (⏮), Play/Pause and Reset-timer (only when the
  step is timed), and a primary **Next / Continue / Finish** button on the right.

**Timing logic**
- A step is timed when its prescription contains a time and no reps/sets: `30 seconds`, `30 sec`, `30s`,
  `0:45`, `1:30`, `2 min` (any "rest N sec" fragment is ignored when detecting the work time).
- Timed steps **auto-start** when the slide becomes active and auto-advance when the clock hits zero.
- **Tabata steps** (the word Tabata in the section, sub-section or prescription) run 20s **Work** → 10s
  **Rest** and then advance; the read-out shows Work/Rest and rest time is muted.
- Rep-based steps show "Manual — tap Next when done" and never auto-advance.
- A section-break slide always stops the clock and waits for Continue.
- Keyboard: ← / → navigate, Space toggles play/pause on timed steps, Esc closes.
- Everything resets (index 0, phase work, timer cleared) when the player is closed or restarted.

**Player media and instruction data**
- On open, collect unique exercise IDs and fetch `id`, `name`, `gif_url`, `frame_start_url`,
  `frame_end_url`, `description` and `instructions` in one batched library query.
- Every exercise slide shows: section, optional protocol/block label, exercise name, exact prescription,
  looping GIF (or frame fallback), and a collapsible **Instructions** area containing the numbered library steps.
- Never ask the model to generate exercise technique instructions; these always come from the human-built
  exercise-library record selected by the token ID.
- Keep a stable media viewport so different GIF proportions do not resize the dialog.
- Request a screen Wake Lock while the timer is running; release it on pause, close, finish or page hide.
- Give an audio cue and vibration cue, when supported and permitted, at work/rest transitions and before
  automatic advancement. The player remains fully usable when either permission is unavailable.

**Tabata behavior**
- A Tabata block is 8 rounds of 20 seconds work and 10 seconds rest.
- Track and show `Round N of 8`, the current `WORK` or `REST` phase and the countdown.
- Do not treat one 20/10 pair as a complete Tabata block. Complete all eight rounds before moving to the
  next exercise or section unless the authored workout explicitly assigns alternating exercises by round.
- Pause freezes the exact round, phase and second. Reset returns to Round 1, Work, 20 seconds.

**Other protocol behavior**
- EMOM shows the authored minute label and advances at the end of the minute; repeated rounds preserve the
  authored sequence.
- Timed Circuit/AMRAP/For Time exercises use the authored work duration when a per-exercise duration exists.
- Rep/set, distance and calorie prescriptions are manual: the player never guesses a duration and waits for Next.
- Rest written in a rep/set prescription is displayed but must not be mistaken for the exercise work timer.

### B8. Below the content
- **Workout interactions** row: favourite ❤, mark complete ✅, star rating, comment, schedule workout,
  add to calendar (.ics) — gated for non-entitled users.
- **Share buttons** row (compact).
- **PAR-Q reminder**.
- For non-premium users, a bottom CTA card: "Want more like this?" + Join Premium button.

### B9. SEO / head for the workout page
Title `{name} | Online Workout | {Brand}`, meta description built from duration + format + description
(≤158 chars), Open Graph + Twitter tags with the workout image, canonical URL, and JSON-LD
`ExercisePlan` + `HowTo` (one step per section) + `BreadcrumbList`.

### B10. Required component and data flow
Implement this as working product behavior, not static mockups:

1. `WorkoutDisplay` joins and normalizes the workout sections and renders the published page.
2. `ExerciseHTMLContent` sanitizes HTML, parses only `{{exercise:ID:Name}}` tokens and injects inline eye buttons.
3. `ExerciseDetailDialog` loads media, metadata, description and numbered instructions by exact ID.
4. `WorkoutToolsBar` opens the Workout Timer, Rounds Counter, 1RM Calculator and Exercise Library dialogs.
5. `ReaderModeDialog` receives the same normalized, linked workout content.
6. `parseWorkoutSteps` walks the HTML in document order and produces one playable step per valid token.
7. `WorkoutPlayerDialog` receives those steps, batch-loads exercise media/instructions and runs the carousel/timers.
8. `WorkoutInteractions` persists completion, rating, note, favourite and scheduled date against the user/workout.
9. Sharing and `.ics` export use the real workout title, canonical URL and scheduled date.

Do not duplicate generated exercise names in a separate array. The tokenized workout HTML is the source of truth
for display and step order; the exercise library is the source of truth for media, descriptions and instructions.

### B11. Acceptance checklist — do not declare complete until all pass
- A generated workout cannot contain an invented or unlinked exercise.
- Challenge, Mobility & Stability, Pilates, Recovery and Micro-Workout bans are enforced before and after generation.
- The published page shows name, description, creator credit, all metadata, image, tools, Player bar, Workout,
  Instructions and Tips in the specified order.
- Every valid exercise token renders its name plus an inline eye button.
- The eye opens the correct library exercise with working media, description and numbered instructions.
- Reader Mode opens the same workout, defaults dark and supports 14–28px text.
- Start your workout opens a swipeable ordered carousel with every linked exercise exactly once.
- Section-break slides appear between sections and wait for Continue.
- Timed steps count down and advance; rep/set steps wait for the user.
- Tabata completes 8 full 20/10 rounds and shows round/phase state.
- GIF fallback, pause, reset, previous, next, finish, Wake Lock and audio/vibration degradation all work.
- Completion, rating, note, favourite, schedule, calendar export and sharing persist or execute correctly.
- Verify on a 390px phone and desktop; no text, controls, GIFs or dialogs overflow or overlap.
- Add focused tests for token parsing, section detection, prescription extraction, timer parsing, Tabata rounds,
  section-break insertion, missing-media fallback and invalid/unlinked-token exclusion.

# PROMPT END
