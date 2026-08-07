# Starter prompt for SmartyWorkout / SmartyWOD

## How to use this file

1. Create a new Lovable project.
2. Copy everything below the line `=== COPY FROM HERE ===` into the very first message.
3. Replace every `{{APP_NAME}}` with `SmartyWorkout` (or `SmartyWOD`) and `{{DOMAIN}}` with `smartyworkout.com` (or `smartywod.com`) before sending. Everything else is identical between the two projects.
4. **Before the coach can work, the exercise library must be imported.** The prompt makes this step one. Export it from SmartyGym first (see "Exercise library export" at the bottom of this file).

---

=== COPY FROM HERE ===

I am building a new mobile-first fitness app called **{{APP_NAME}}** (domain {{DOMAIN}}). Build it with Lovable Cloud (database, auth, edge functions, storage) and Lovable AI for generation. Read this whole brief before writing code, then build it in the order given.

## 1. What this app is

{{APP_NAME}} is a **single-purpose AI workout generator**. There is no workout gallery, no training programs, no blog, no shop, no corporate section, no daily ritual. There is one agent — **Smarty Coach** — that interviews the user and generates a complete, professionally structured workout on demand. Every workout it creates belongs to that user forever and lives in their personal logbook.

Positioning: **100% AI coaching, built on a human-designed exercise library and human coaching rules.** Do not write "human-designed workouts" anywhere. The honest claim is: the movement library and the coaching logic were designed by a sports scientist; the AI assembles the session.

Target device: **mobile first**. Design for a 390px-wide phone and scale up. Desktop is a supported but secondary layout.

## 2. Design system

- Dark navy base `#0F172A`, deep background `#080C16`, single accent electric blue `#29B6D2`. No secondary accent colours. Gold gradient only for the "Go Premium" CTA.
- Mobile defaults to **dark mode** with a user toggle. Desktop is locked to dark mode.
- All colours, gradients and shadows as semantic HSL tokens in `index.css` + Tailwind config. Never hardcode `text-white`, `bg-black`, or hex values in components.
- Cards: rounded-2xl, subtle border, generous padding, stacked single-column on mobile.
- Every major page has: a transparent line icon (Lucide, no background circle) above the headline, an H1 in the accent colour, and a short description **not** wrapped in a card.
- Fonts: one clean geometric sans for headings, one highly readable sans for body. Do not use Inter or Poppins.
- Bottom mobile navigation with: Coach, Logbook, Tools, Progress, Account.

## 3. Build order

**Step 1 — Exercise library (do this first).**
Create the `exercises` table and import the CSV/JSON I will provide (~1,340 rows). Schema:

```
exercises(
  id text primary key,
  name text not null,
  body_part text,
  equipment text,
  target text,
  secondary_muscles text[],
  instructions text[],
  gif_url text,
  frame_start_url text,
  frame_end_url text,
  description text,
  difficulty text,          -- beginner | intermediate | advanced
  category text,
  created_at timestamptz default now()
)
```
Grants: `GRANT SELECT ON public.exercises TO anon, authenticated; GRANT ALL TO service_role;` RLS on, public read policy. Nothing works until this table is populated — do not attempt generation before the import is confirmed.

**Step 2** — auth, profile, PAR-Q gate.
**Step 3** — membership + Stripe.
**Step 4** — Smarty Coach agent + workout generation engine.
**Step 5** — workout display + player.
**Step 6** — logbook, goals, progress, tools.
**Step 7** — generate two sample workouts so I can verify quality.

## 4. Auth, profile and PAR-Q (mandatory gate)

Email/password + Google sign-in. Email verification required, with a "Resend verification email" button (60s cooldown).

Before a user can generate anything they must complete:

**Profile** — date of birth (age is derived, never asked again), sex, height, weight, training experience (beginner / intermediate / advanced), typical equipment access (none / minimal home / full gym), injuries or limitations (free text + common checkboxes: lower back, knee, shoulder, wrist, ankle, neck, hip).

**PAR-Q+ questionnaire** — the standard 7 screening questions. Any "yes" shows a medical-clearance warning and requires explicit acknowledgement before continuing. Store answers with a timestamp in `parq_responses`. Re-prompt every 12 months. Show the fitness disclaimer on first completion and in the footer.

**Optional measurements** (in the profile, not blocking): weight history, body fat %, waist / hips / chest / arm / thigh circumference, resting heart rate. Each entry timestamped so it can be charted.

Store profile answers as durable context — the coach reads them on every generation so it never re-asks age, sex, experience or injuries.

## 5. Membership

Single plan: **Premium — EUR 9.99 per month, recurring**, via Stripe Checkout in subscription mode with a real `price_...` id written in the source. Requirements:

- Payment method saved at checkout so renewals succeed automatically.
- `check-subscription` edge function that reads Stripe by the user's email and returns `{ subscribed, product_id, subscription_end }`. Call it on login, page load, and after checkout returns.
- `customer-portal` edge function so users cancel/update the card themselves.
- Renewal reminders (3 days and 1 day before), payment-failed notices, cancellation confirmation, expiry notice. These are transactional and **cannot** be disabled in notification preferences.
- Platform kill-switches: an admin-controlled `payments_enabled_ios` / `payments_enabled_android` / `payments_enabled_web` setting. When a phone or tablet is detected (user-agent, `maxTouchPoints`, `userAgentData.mobile` — must also catch "Request Desktop Site"), and that platform is toggled off, hide all purchase buttons and show:
  > "In-app purchases are not available. Memberships are purchased on our website. Visit {{DOMAIN}} from any computer to subscribe, then sign in here with the same account and your access appears automatically."
  Enforce the same block server-side in the checkout function via an `x-smarty-platform` header — never trust the client alone.

**Entitlements**
- Not signed in: marketing page only.
- Free / expired member: full account, profile, PAR-Q, tools, goals, progress, and **permanent read + player access to every workout they have already generated**. Cannot generate new workouts.
- Premium: everything, plus **2 workout generations per calendar day**.

Enforce the daily quota server-side in a `generation_usage(user_id, usage_date, count)` table with a unique key on `(user_id, usage_date)`. The UI shows "1 of 2 workouts left today" and disables the button at zero with the reset time. Never enforce quota only in the client.

## 6. Smarty Coach — the agent

A floating brain button on every screen (96px on desktop, standard on mobile, gentle blink every 3.5s on mobile), plus a full-screen coach page. Opens a stepped questionnaire, one question per screen, with a progress bar, back button, and large tap targets.

Questions asked each session (profile data is never re-asked):

1. **Mood / energy** — Low, Moderate, High.
2. **Soreness / readiness** — Fresh, Slightly sore, Very sore (very sore biases toward Recovery or Mobility and caps difficulty).
3. **Equipment today** — Bodyweight only / Equipment available.
4. **Category** — Strength, Calorie Burning, Metabolic, Cardio, Mobility & Stability, Challenge, Pilates, Recovery, Micro-Workout.
5. **Strength focus** (only when Strength is chosen) — Lower Body, Upper Body, Full Body, Low Push & Upper Pull, Low Pull & Upper Push, Core & Glutes.
6. **Time available** — 15 / 30 / 45 / 60+ min (Micro-Workout is locked to 5 min).
7. **Format** (optional, "let the coach decide" default) — Reps & Sets, Circuit, AMRAP, EMOM, Tabata, For Time, Mix.

Difficulty is **derived**, not asked: profile experience level, adjusted down by low energy or high soreness, adjusted up by high energy. Map to 1–6 stars (1–2 Beginner, 3–4 Intermediate, 5–6 Advanced).

After the last answer, show an animated "Smarty Coach is building your workout…" state, then reveal the finished workout. Save it to the user's account **before** rendering, so a refresh never loses it.

## 7. Workout generation engine (the core — get this exactly right)

Run generation in an edge function using Lovable AI. **Stream the model call and consume it server-side** (`streamText` + `await result.text`) — a buffered call is severed at ~2 minutes, still billed, and retried. Never expose the API key to the client.

### 7.1 Library-first — absolute rule
The model may only use exercises that exist in the `exercises` table. Before the call, query the library filtered in this exact order: **equipment → difficulty → muscle/focus for the category**, then pass the matching exercises to the prompt as a reference list of `id | name | equipment | target | difficulty`.

Every exercise in the output must be written as a token:
```
{{exercise:0725:single arm push-up}}
```
Four enforcement layers, all required:
1. Prompt rules stating library-only, tokens mandatory.
2. A repair pass that maps any token with a wrong id to the correct library row by exact name.
3. A rejection pass that strips or fails any exercise name not present in the library.
4. A logging table `unmatched_exercises` recording anything the linker could not resolve, for review.

The rendered UI turns each token into a tappable exercise chip that opens the GIF and instructions.

### 7.2 Mandatory 5-section structure
Every workout, in this exact order, with these exact icons:

1. **🧽 Soft Tissue Preparation** — foam rolling / lacrosse ball / trigger point only. **No exercise tokens in this section.** Lines start with "Foam roll", "Lacrosse ball", "Trigger point".
2. **🔥 Activation** — library exercises with tokens.
3. **💪 Main Workout** — library exercises with tokens. Minimum 4.
4. **⚡ Finisher** — library exercises with tokens. Minimum 3, and the finisher block must be 10 minutes or more.
5. **🧘 Cool Down** — library stretches and breathing with tokens.

Micro-Workouts use a 3-section 5-minute variant instead: 🔥 Activation 1' (1–2 exercises, 20–30s each) → 💪 Main Workout 3' (3–4 exercises) → 🧘 Cool Down 1' (1–2 stretches). No soft tissue, no finisher. Section durations must sum to exactly 5'.

Section durations must sum to the requested total duration (±10%).

### 7.3 Prescription rules (non-negotiable)
- **Every** exercise token in Main Workout and Finisher must have a measurable dose **before** the token: reps, seconds, minutes, meters, km, calories, rounds, or `sets × reps`.
  - WRONG: `{{exercise:0685:run}} on treadmill`
  - RIGHT: `400m {{exercise:0685:run}} on treadmill (fast pace)`
- Never put stray text after the closing `}}`. Modifiers go before the token.
  - WRONG: `{{exercise:0725:single arm push-up}}20 sec interval)`
  - RIGHT: `20 sec {{exercise:0725:single arm push-up}}`
- Reps & Sets lines start with `sets × reps`, then the token, then readable tempo and rest:
  `4 sets × 8 reps {{exercise:0102:barbell squat}} — tempo 3-sec lower, 1-sec pause, explosive lift; rest 90 sec`
- Sanity bounds: 1–6 sets, 1–25 reps. A tempo code without sets × reps is invalid.
- Protocol headers **never** contain durations. `Main Workout (TABATA)`, not `Main Workout (TABATA 24')`. The protocol explanation goes in the Instructions field, not the body.
- EMOM blocks label **every** minute in order (`Minute 1:` … `Minute N:`) with no orphan exercise after the last labelled minute. Repeating patterns: write the pattern once, then a separate line "Repeat 3 rounds = 12 minutes".

### 7.4 Format rules
- **TABATA** — 8 rounds × 20s work / 10s rest, "20 sec" before every token. Bodyweight and light implements only; no machine-based exercises.
- **EMOM** — every minute labelled, reps or time before every token.
- **CIRCUIT** — rounds and rest stated in a separate paragraph, then 5–7 stations with reps/time before each token.
- **AMRAP** — time cap in a separate paragraph, then 4–6 exercises with rep targets.
- **FOR TIME** — chipper or rounds-for-time with reps before every token.
- **REPS & SETS** — as in 7.3.
- **MIX** — a properly prescribed strength portion plus a properly prescribed metabolic finisher.

**Fixed-format categories** (no rotation allowed): Strength → Reps & Sets. Mobility & Stability → Reps & Sets. Pilates → Reps & Sets. Recovery → Mix.

### 7.5 Category coaching rules
Pass the matching block into the prompt.

- **STRENGTH** (focus: one of the six focuses) — heavy compound lifts, reps & sets, long rest 90–180s. Bodyweight mode uses progressions only; equipment mode uses barbell / dumbbell / kettlebell / cable.
- **CALORIE BURNING** — bodyweight: burpees, jump squats, mountain climbers, plyo push-ups, jumping lunges. Equipment: kettlebell swings, DB thrusters, rowing intervals, sled push, battle ropes.
- **METABOLIC** — bodyweight: full-body push/pull/squat/hinge circuits with minimal rest. Equipment: DB/KB/barbell complexes, thrusters, devil press.
- **CARDIO** — bodyweight: jumping jacks, skater jumps, high knees, mountain climbers, burpees. Equipment: rower, assault bike, jump rope, KB swings, ski erg, sled.
- **MOBILITY & STABILITY** — controlled work only: CARs, balance holds, bird dog, side bridge, cat-cow, ankle/wrist circles, slow breathing; equipment mode adds bands, balance board, foam roller, exercise ball. **Hard ban:** jumps, burpees, plyometrics, heavy strength, push-ups, crunches, sit-ups, dynamic leg raises.
- **CHALLENGE** — benchmark intensity: AMRAP / For Time, multiple rounds, mixed high-output patterns, carries, chippers. **Hard ban in Main Workout and Finisher:** stretching, mobility, yoga poses, static flexibility, recovery drills. Challenge means capacity and time pressure, not stretching.
- **PILATES** — studio standard only: mat, reformer, magic circle, Pilates ball, light dumbbells, resistance bands. **Forbidden:** kettlebells, barbells, heavy DBs, machines, cables, plyometrics, conditioning. Controlled spinal articulation, deep core, breath-led tempo, reps & sets.
- **RECOVERY** — PNF stretching, CARs, nasal / box breathing, gentle mobility. No plyometrics, no conditioning, no heavy lifting, no crunches or sit-ups. Soft tissue = foam rolling only.
- **MICRO-WORKOUTS** — 5 minutes total, bodyweight plus chair / sofa / desk / stairs / wall only. **Forbidden:** dumbbells, kettlebells, barbells, bands, machines, bike, rower, jump rope, treadmill, sled. Must be doable in office clothes in a small space.

### 7.6 Naming
2–4 word creative name with a premium signature feel. Ban these overused words: Inferno, Blaze, Fire, Burn, Fury, Storm, Thunder, Power, Beast, Warrior, Elite, Ultimate, Extreme, Foundation, Torch, Melt, Engine, Drive, Catalyst, Flow, Restore, Gauntlet, Summit. Pass the user's existing workout names as banned names so nothing repeats.

Assign a readable id per category: `S-001` Strength, `CB-` Calorie Burning, `ME-` Metabolic, `C-` Cardio, `M-` Mobility & Stability, `CH-` Challenge, `PIL-` Pilates, `REC-` Recovery, `MW-` Micro-Workouts, with a per-user incrementing serial.

### 7.7 Post-generation pipeline (run every time, in order)
1. HTML normalizer — clean the markup into the canonical structure inside a `workout-content` wrapper.
2. Exercise linker — repair tokens, guarantee links, reject non-library names, log unmatched.
3. Section validator — all required sections present, correct order, correct icons, minimum exercise counts.
4. Protocol sanitizer — strip durations from headers, move stray text before tokens, fix EMOM minute labels.
5. Prescription safety check — a measurable dose before every token, valid sets/reps bounds.
6. Duration check — section durations sum to the requested total.
7. Quality gate — if any check fails, **regenerate (up to 3 attempts) rather than save a bad workout**. If all attempts fail, show the user a clear "couldn't build a session that meets our standard, try again" message and **do not consume a generation from their daily quota**.

Also generate for each workout: a short description, an `instructions` field explaining the protocol format, and 2–4 coaching tips.

## 8. Workout display and player

Rendered workout page includes:
- Header: name, category, difficulty stars, duration, equipment, format.
- Reader mode toggle (larger text, distraction-free) and share button — placed **outside** the workout card, in a slim tool bar above it.
- A full-width, fully clickable blue bar below the tool bar: **"Start your workout"** with a play icon.
- The workout body in a `workout-content` wrapper with consistent typographic rhythm; each exercise token rendered as a tappable chip.
- Actions: mark complete, rate 1–5, add a personal note, favourite, schedule for a date, export to calendar (.ics), export to PDF.

**Player dialog** (opened by the blue bar): a full-screen carousel, one exercise per card, showing the looping GIF, exercise name, the prescription for that line, and the step-by-step instructions. Includes a countdown timer that auto-advances for timed work, correct Tabata handling (8 × 20/10 with rest screens), previous/next controls, an audio/vibration cue at each transition, and a screen wake-lock so the phone does not sleep.

## 9. Logbook and progress

- **My Workouts** — every workout the user generated, newest first, filterable by category, difficulty and completed status. Permanent: never deleted, never revoked when a subscription lapses.
- **Completion tracking** — date completed, duration actually taken, rating, notes, perceived exertion.
- **Streaks and stats** — workouts this week/month, total sessions, category distribution chart, consistency score.
- **Goals** — the user sets targets (sessions per week, weight, body fat, a 1RM number) with progress bars and an achievement notification that fires once per goal.
- **Progress charts** — weight, body fat, measurements, 1RM history, calories over time.
- **Community leaderboard** — opt-in, display name + avatar, ranked by completed sessions and consistency. Aggregate via a security-definer function so it works across users without exposing private rows.

## 10. Smarty Tools

Standalone calculators, all free, all saving results to the user's history:
Workout Timer (interval / Tabata / EMOM, wake-lock), Rounds Tracker, 1RM Calculator, BMR Calculator, Macro Calculator (deficit/surplus percentages with sensible floors), Calorie Counter with food search, Body Fat estimator.

## 11. Notifications

In-app message centre plus email. Preference toggles for marketing and motivational messages only — **transactional messages (renewal, payment failed, cancellation, expiry, password, verification) always send**. Keep web and email content in sync from one central message-type registry.

## 12. Admin panel

Minimal, role-gated. Roles live in a **separate `user_roles` table** with an `app_role` enum and a `has_role(uuid, app_role)` security-definer function — never a role column on profiles.

Sections: Users (view, grant complimentary premium for 1/3/6/12 months, ban), Exercise Library (browse, edit, fix GIFs), Generations (recent workouts, quality-gate failures, unmatched exercises), Payments (Stripe config + the three platform kill-switches), System Health.

## 13. Backend and data model

Lovable Cloud. Tables: `profiles`, `parq_responses`, `user_roles`, `exercises`, `generated_workouts`, `workout_interactions`, `generation_usage`, `user_measurements`, `measurement_goals`, `user_subscriptions`, `scheduled_workouts`, `user_system_messages`, `unmatched_exercises`, `system_settings`.

For every table in `public`, in this order: `CREATE TABLE` → `GRANT` to the roles the policies allow (always `service_role`; `anon` only for genuinely public data) → `ENABLE ROW LEVEL SECURITY` → policies. Scope every user table to `auth.uid()`. Add `created_at` / `updated_at` with an update trigger. Do not add foreign keys to `auth.users` beyond the profile link.

Never call one edge function from another — use shared modules or direct database queries.

## 14. Legal and SEO

Privacy Policy, Terms of Service, Fitness Disclaimer, GDPR account deletion (cascading) and data export. Real `<title>` (<60 chars) and meta description (<160 chars), one H1 per page, semantic HTML, alt text everywhere, canonical tags, JSON-LD for the app and FAQ.

## 15. Final step — prove it works

After the build, generate and save **two sample workouts** and show them to me:
1. **Bodyweight, Calorie Burning, Intermediate, 30 min, Circuit.**
2. **Equipment, Strength, Lower Body focus, Advanced, 45 min, Reps & Sets.**

For each, confirm in writing that: all five sections are present in order with the right icons, every exercise is a real library token, every token has a dose before it, the finisher has 3+ exercises and is 10+ minutes, the section durations sum to the requested total, and the player opens with working GIFs.

=== END OF PROMPT ===

---

## Exercise library export (do this before starting the new project)

From SmartyGym, export the `exercises` table — 1,342 rows — with these columns:

```
id, name, body_part, equipment, target, secondary_muscles,
instructions, gif_url, frame_start_url, frame_end_url,
description, difficulty, category
```

Export as CSV or JSON, then upload the file in the new project's first message (or immediately after) so the agent can import it. `secondary_muscles` and `instructions` are Postgres text arrays — keep them as JSON arrays in the export.

GIF and frame URLs point at SmartyGym storage. Either keep referencing those URLs (simplest, works immediately) or re-upload the media into the new project's storage bucket and rewrite the URLs during import.

## Differences between the two projects

Everything is identical except:

| | SmartyWorkout | SmartyWOD |
|---|---|---|
| App name | SmartyWorkout | SmartyWOD |
| Domain | smartyworkout.com | smartywod.com |
| Logo / wordmark | SmartyWorkout mark | SmartyWOD mark |
| Stripe products | its own product + price | its own product + price |

Build one, verify it, then remix it and change only the name, logo, domain and Stripe price id.
