# Starter prompt for SmartyWorkout / SmartyWOD

Goal: produce one long, copy-paste starter prompt you can drop into a brand-new Lovable project, twice (once branded SmartyWorkout, once SmartyWOD), that rebuilds the SmartyGym look, feel and workout engine — but as a 100% AI, agent-first, mobile-first app with no content gallery.

## Deliverable

A single file `docs/NEW_PROJECT_STARTER_PROMPT.md` in this project, containing the full prompt text plus a short "how to use it" note. Nothing else in SmartyGym changes.

## What the prompt will specify

**Identity and scope**
- App name placeholder (`SmartyWorkout` / `SmartyWOD`), mobile-first, same fonts, spacing, card system and dark navy (#0F172A / #080C16) + electric blue (#29B6D2) palette as SmartyGym.
- Positioning: 100% AI coach, built on a human-designed exercise library and human coaching rules. No "human-designed workouts" claims.
- Included: Smarty Coach agent, profile + PAR-Q, measurements, logbook, goals, community/leaderboards, Smarty Tools, premium membership, account management, notifications, legal pages.
- Excluded: blog, workout gallery, training programs, Daily Smarty Ritual, shop, corporate.

**Membership model**
- Single Premium plan, EUR 9.99/month recurring via Stripe, with the same hardening SmartyGym uses (card saved upfront, auto-finalized invoices, customer portal cancellation, renewal reminders, expiry handling).
- Free/expired users: can sign up, complete profile, use tools, and keep full read access to every workout they generated — forever. Generation is premium-only.
- Quota: 2 generated workouts per day per premium member, enforced server-side with a per-day usage table.
- Platform payment kill-switches (iOS / Android / Web) carried over, since these ship as mobile apps.

**Onboarding gate**
- Mandatory profile before any generation: age/DOB, sex, height, weight, training experience, equipment access, injuries/limitations, plus the PAR-Q questionnaire with the same disclaimer and re-consent rules.
- Optional measurements, 1RM, BMR, macros, body fat — same calculators and history logging as SmartyGym.

**Smarty Coach agent flow**
- Same modal/questionnaire pattern: mood/energy, soreness, bodyweight vs equipment, category, focus (strength only), duration, difficulty inherited from profile + answers.
- Produces one workout, saved to the user's account immediately, then rendered in the standard workout view with reader mode, share, calendar export and the full-width blue "Start your workout" player bar.
- Player carousel with exercise GIFs, instructions, auto-timing and Tabata handling.

**Workout engine rules (the core of the prompt)**
- Library-first selection only: exercises come from the exercise library table, referenced as `{{exercise:ID:Name}}`, no invented movements, with the 4-layer enforcement (prompt rules, rejection of non-library names, guaranteed linking, unmatched logging).
- Mandatory 5-section structure with icons and order: Soft Tissue Preparation (foam rolling only, no markup), Activation, Main Workout (min 4 exercises), Finisher (min 3, 10+ min), Cool Down. Micro-workouts use the 3-section 5-minute variant.
- Per-category coaching rules copied verbatim in spirit from SmartyGym: Strength, Calorie Burning, Metabolic, Cardio, Mobility & Stability, Challenge, Pilates, Recovery, Micro-Workouts — including the hard bans (no plyo in mobility, no stretching in challenge, Pilates studio equipment only, micro = bodyweight/chair/desk/wall/stairs only).
- Format rules: TABATA, EMOM, CIRCUIT, AMRAP, FOR TIME, REPS & SETS, MIX — with fixed-format categories and the protocol block standard (no durations in headers, no stray text after `}}`, dose always before the token, every EMOM minute labelled).
- Difficulty-aware selection (1-6 stars), strict equipment -> difficulty -> muscle/focus filter order, duration/density validation, naming uniqueness with banned overused words.
- Post-generation pipeline: HTML normalizer, section validator, protocol sanitizer, quality gate, duration check — reject and retry rather than publish a bad workout.

**Logbook and progress**
- Every generated workout stored permanently per user, with completion tracking, ratings, notes, favourites, scheduled workouts, calendar export, goals and achievements, streaks and leaderboards.

**Technical notes section**
- Lovable Cloud backend, table list (profiles, parq_responses, generated_workouts, workout_interactions, user_measurements, goals, usage quota, subscriptions), RLS + GRANT pattern, roles in a separate `user_roles` table.
- Model: Lovable AI Gateway, streaming generation inside the edge function to avoid timeouts, background generation for long runs.
- A seeding step for the exercise library, since a new project starts with an empty database — the prompt will instruct exporting the SmartyGym `exercises` table (with GIF URLs and instructions) and importing it, because the agent cannot work without it.
- Instruction to generate two sample workouts on first build (one bodyweight, one equipment, different categories) so you can immediately verify format, linking and the player.

## Note

The single biggest dependency is the exercise library: without importing it, the new project's coach has nothing to select from. The prompt will make that step explicit and first.
