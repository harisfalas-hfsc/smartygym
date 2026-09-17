// Deterministic programming intelligence for Smarty Coach.
//
// This module turns the athlete's request (category, duration, difficulty,
// mood, location, equipment) into an explicit SESSION BLUEPRINT: how many
// sections, how many exercises per section, which rep ranges, tempos and rest
// windows are legal, and how the session should flow between pieces of
// equipment. The blueprint is handed to the model as hard instructions AND
// used afterwards to score the finished session, so the rules are enforced
// deterministically instead of being hoped for.

import type { PoolExercise } from "./pool.server.ts";
import type { WorkoutStep } from "./parse-steps.ts";
import {
  categoryAllowsFinisher,
  doctrinePrompt,
  HUMAN_REALISM_PROMPT,

  equipmentFamilyOf,
  isRepsAndSetsOnly,
  legalFormats,
} from "./doctrine.ts";
import type { Category, DifficultyLevel, Format, StrengthFocus } from "./spec.ts";


export type Dose = {
  sets: [number, number];
  reps?: [number, number];
  seconds?: [number, number];
  restSec: [number, number];
  tempo: string;
};

export type SessionPlan = {
  category: Category;
  format: Format;
  level: DifficultyLevel;
  minutes: number;
  /** Total blocks the athlete performs, excluding soft tissue prep. */
  softTissue: boolean;
  activationCount: number;
  mainCount: [number, number];
  /** [0,0] means the session has no Finisher at this duration. */
  finisherCount: [number, number];
  cooldownCount: number;
  main: Dose;
  finisher: Dose | null;
  /** Movement-pattern sequence the Main Workout should follow. */
  sequence: string[];
  /** Max number of distinct equipment families allowed in the work sections. */
  maxEquipmentFamilies: number;
  /** How many times the athlete may switch station across the work sections. */
  maxTransitions: number;
  /** CARDIO only: which aerobic expression today's session must follow. */
  cardioExpression?: CardioExpression;
  /** Realistic minutes the Main Workout will occupy at the prescribed dose. */
  mainMinutesEstimate: number;
  /** Minutes budgeted for the Finisher (0 when the session carries none). */
  finisherMinutes: number;
  /** Why the Finisher exists — or why it was intentionally omitted. */
  finisherDirective: string;

  moodDirective: string;
  locationDirective: string;
  intensityDirective: string;
};


// ---------------------------------------------------------------------------
// Duration intelligence
// ---------------------------------------------------------------------------

type Shape = {
  softTissue: boolean;
  activationCount: number;
  mainCount: [number, number];
  finisherCount: [number, number];
  cooldownCount: number;
};

/**
 * Micro Workouts are a movement break, never a gym session: 10 minutes by
 * default and never longer than 20, whatever the athlete requested.
 */
export function microMinutes(requested: number): number {
  const m = Math.round(requested || 0);
  if (!Number.isFinite(m) || m <= 10) return 10;
  return Math.min(20, m);
}

function durationShape(minutes: number, category: Category): Shape {
  // MICRO WORKOUT: one 10-minute coherent block. No soft tissue, no separate
  // activation, no finisher, no cool-down padding — the workout starts at once.
  if (category === "MICRO-WORKOUTS") {
    return { softTissue: false, activationCount: 0, mainCount: [4, 5], finisherCount: [0, 0], cooldownCount: 0 };
  }

  if (minutes <= 5)
    return { softTissue: false, activationCount: 2, mainCount: [3, 4], finisherCount: [0, 0], cooldownCount: 2 };
  if (minutes <= 10)
    return { softTissue: false, activationCount: 3, mainCount: [3, 5], finisherCount: [0, 0], cooldownCount: 3 };
  if (minutes <= 15)
    return { softTissue: true, activationCount: 3, mainCount: [4, 5], finisherCount: [0, 0], cooldownCount: 3 };
  if (minutes <= 20)
    return { softTissue: true, activationCount: 4, mainCount: [4, 6], finisherCount: [3, 3], cooldownCount: 3 };
  if (minutes <= 30)
    return { softTissue: true, activationCount: 4, mainCount: [5, 6], finisherCount: [3, 4], cooldownCount: 3 };
  if (minutes <= 45)
    return { softTissue: true, activationCount: 4, mainCount: [6, 7], finisherCount: [3, 4], cooldownCount: 3 };
  return { softTissue: true, activationCount: 4, mainCount: [7, 8], finisherCount: [4, 5], cooldownCount: 4 };
}

// ---------------------------------------------------------------------------
// Goal-specific dosing
// ---------------------------------------------------------------------------

const LEVEL_SHIFT: Record<DifficultyLevel, number> = {
  beginner: -1,
  intermediate: 0,
  advanced: 1,
  all: 0,
};

/**
 * STRENGTH main dose. The objective is maximal force production with high
 * technical quality: heavy compounds, low reps, full recovery, never failure.
 */
export function strengthDose(level: DifficultyLevel): Dose {
  const shift = LEVEL_SHIFT[level];
  if (shift < 0)
    return {
      sets: [3, 5],
      reps: [5, 8],
      restSec: [90, 150],
      tempo: "controlled 2-sec lower, brief pause, explosive intent up",
    };
  return {
    sets: [4, 6],
    reps: [3, 6],
    restSec: shift > 0 ? [150, 180] : [120, 180],
    tempo: "controlled 2-sec lower, brief pause, explosive intent up",
  };
}

/**
 * MUSCLE BUILDING main dose. The objective is hypertrophy stimulus: mechanical
 * tension, controlled eccentrics, moderate volume, close to but not at failure.
 */
export function hypertrophyDose(level: DifficultyLevel): Dose {
  const shift = LEVEL_SHIFT[level];
  if (shift < 0)
    return {
      sets: [2, 3],
      reps: [8, 15],
      restSec: [60, 90],
      tempo: "2-3 sec lower, controlled lift, squeeze the target muscle",
    };
  return {
    sets: [3, 4],
    reps: shift > 0 ? [6, 12] : [8, 12],
    restSec: [60, 90],
    tempo: "2-3 sec lower, controlled lift, squeeze the target muscle",
  };
}

/**
 * STRENGTH finisher dose — complementary accessory volume that reinforces the
 * selected focus. It is never a second workout and never conditioning.
 */
export function strengthFinisherDose(level: DifficultyLevel): Dose {
  const shift = LEVEL_SHIFT[level];
  return {
    sets: shift > 0 ? [2, 4] : [2, 3],
    reps: shift < 0 ? [8, 12] : [8, 15],
    restSec: shift < 0 ? [75, 90] : [60, 90],
    tempo: "controlled lower, clean lift, stop 2 reps short of failure",
  };
}

/** MUSCLE BUILDING finisher dose — a short extra hypertrophy / pump stimulus. */
export function hypertrophyFinisherDose(level: DifficultyLevel): Dose {
  const shift = LEVEL_SHIFT[level];
  return {
    sets: [2, 3],
    reps: shift < 0 ? [10, 15] : [12, 20],
    restSec: shift < 0 ? [60, 75] : [45, 75],
    tempo: "3-sec lower, hard squeeze at peak contraction, no bouncing",
  };
}


function conditioningDose(level: DifficultyLevel, hard: boolean): Dose {
  const shift = LEVEL_SHIFT[level];
  return {
    sets: [3, hard ? 5 : 4],
    reps: [10, 20],
    seconds: shift < 0 ? [20, 30] : hard ? [30, 45] : [30, 40],
    restSec: shift < 0 ? [45, 60] : hard ? [15, 30] : [20, 45],
    tempo: "smooth repeatable pace, never sloppy",
  };
}

function controlDose(level: DifficultyLevel): Dose {
  return {
    sets: [2, level === "advanced" ? 4 : 3],
    reps: [8, 12],
    seconds: [30, 60],
    restSec: [20, 45],
    tempo: "slow, breath-led, full control through range",
  };
}

/**
 * Micro Workout dose — a movement break, not a miniature gym session.
 * Low sets, simple bodyweight patterns, short rest, never near failure.
 * Advanced adds a little density and range, never leverage or skill.
 */
function microDose(level: DifficultyLevel): Dose {
  if (level === "beginner")
    return { sets: [2, 2], reps: [8, 12], seconds: [20, 30], restSec: [30, 40], tempo: "controlled, easy breathing, no rush" };
  if (level === "advanced")
    return { sets: [2, 3], reps: [12, 15], seconds: [30, 40], restSec: [20, 30], tempo: "steady and controlled through a full range, well short of failure" };
  return { sets: [2, 3], reps: [10, 15], seconds: [25, 35], restSec: [20, 40], tempo: "steady and controlled" };
}

function doseFor(category: Category, level: DifficultyLevel): { main: Dose; finisher: Dose | null } {
  switch (category) {
    case "STRENGTH":
      return { main: strengthDose(level), finisher: strengthFinisherDose(level) };
    case "MUSCLE BUILDING":
      return { main: hypertrophyDose(level), finisher: hypertrophyFinisherDose(level) };

    case "CALORIE BURNING":
    case "METABOLIC":
    case "CHALLENGE":
      return { main: conditioningDose(level, true), finisher: conditioningDose(level, true) };
    case "CARDIO":
      return { main: conditioningDose(level, false), finisher: conditioningDose(level, false) };
    case "MOBILITY & STABILITY":
    case "PILATES":
    case "RECOVERY":
      // Doctrine 20: these categories NEVER carry a finisher.
      return { main: controlDose(level), finisher: null };

    case "MICRO-WORKOUTS":
      return { main: microDose(level), finisher: null };
    default:
      return { main: hypertrophyDose(level), finisher: hypertrophyDose(level) };
  }
}

// ---------------------------------------------------------------------------
// Sequencing, mood, location
// ---------------------------------------------------------------------------

const SEQUENCES: Partial<Record<Category, string[]>> = {
  STRENGTH: ["primary compound", "secondary compound", "accessory", "accessory", "core / carry"],
  "MUSCLE BUILDING": ["compound", "compound", "isolation", "isolation", "pump / core"],
  METABOLIC: ["hinge or squat", "push", "pull", "carry or core", "engine"],
  "CALORIE BURNING": ["large lower body", "push", "pull", "full-body power", "engine"],
  CHALLENGE: ["engine", "push", "pull", "lower body", "core under fatigue"],
  CARDIO: ["engine", "engine", "impact-managed pattern", "engine"],
  "MOBILITY & STABILITY": ["spine", "hips", "shoulders", "balance", "breathing"],
  PILATES: ["breath and centring", "deep core", "spinal articulation", "hips", "controlled close"],
  RECOVERY: ["breathing", "spine", "hips", "shoulders"],
  "MICRO-WORKOUTS": ["lower body", "push", "core", "full-body movement"],
};

// ---------------------------------------------------------------------------
// Cardio doctrine — aerobic continuous vs aerobic intervals
// ---------------------------------------------------------------------------

export type CardioExpression = {
  kind: "continuous" | "intervals";
  directive: string;
};

/**
 * Cardio stays aerobic: more aerobic than Metabolic, less aggressive than
 * Challenge, less fatigue-driven than Calorie Burning and never strength
 * dominant. Only the expression changes with the chosen format.
 */
export function cardioExpression(format: Format): CardioExpression {
  const intervalFormats: Format[] = ["EMOM", "TABATA", "CIRCUIT", "AMRAP", "FOR TIME"];
  if (intervalFormats.includes(format))
    return {
      kind: "intervals",
      directive:
        "CARDIO — AEROBIC INTERVALS: structured work/rest that keeps aerobic output repeatable. Work bouts 30-120 sec at a pace the athlete could hold for the whole session, rest just long enough to repeat the same quality. This is NOT a metabolic or calorie-burning session: no loaded complexes, no grinding strength movements, no near-failure work, no deliberate fatigue accumulation.",
    };
  return {
    kind: "continuous",
    directive:
      "CARDIO — AEROBIC CONTINUOUS: sustained cyclical output with minimal interruption. Few movements, long uninterrupted blocks, conversational-to-strong breathing, pace held steady rather than surged. This is NOT a metabolic or calorie-burning session: no loaded complexes, no near-failure strength work, no fatigue-chasing.",
  };
}

const LOW_ENERGY = new Set(["tired", "stressed", "low", "sore"]);

const HIGH_ENERGY = new Set(["energized", "good", "push"]);

// ---------------------------------------------------------------------------
// Requested vs Effective difficulty
// ---------------------------------------------------------------------------

/** True when the athlete's current state must soften today's dose. */
export function isLowEnergyState(mood: string | null | undefined): boolean {
  return LOW_ENERGY.has((mood ?? "").toLowerCase());
}

export type DifficultyResolution = {
  /** What the profile, the user or the WOD asked for (never shown differently). */
  requestedStars: number;
  /** What the engine actually programmes today. */
  effectiveStars: number;
  softenedBy: string | null;
};

/**
 * Requested difficulty -> current athlete state -> effective difficulty.
 * Tired / low / sore soften by exactly one full star, never below 1.
 * Everything downstream (pool, blueprint, prompt, enforcement) uses the
 * effective value; the user-facing requested value is unchanged.
 */
export function resolveDifficulty(
  requestedStars: number,
  mood: string | null | undefined,
): DifficultyResolution {
  // SIX-STAR SCALE: 1-2 beginner, 3-4 intermediate, 5-6 advanced.
  const requested = Math.max(1, Math.min(6, Math.round(requestedStars || 1)));
  // §27 — mood changes DOSE (volume, complexity, rest, impact) through the
  // mood directive. It never changes the difficulty tier the pool is filtered
  // with, so "tired" can no longer swap the athlete into an easier library.
  return {
    requestedStars: requested,
    effectiveStars: requested,
    softenedBy: isLowEnergyState(mood) ? (mood ?? "").toLowerCase() : null,
  };
}


function moodDirective(mood: string | null | undefined): string {
  const m = (mood ?? "").toLowerCase();
  if (LOW_ENERGY.has(m))
    return `Athlete feels ${m}. Reduce total volume by roughly one working set per exercise, keep complexity low (no technical Olympic or high-skill work), extend rest by 15-30 sec, prefer simple bilateral and well-supported variations, and avoid heavy spinal loading and high-impact jumping. Mood NEVER changes the legal category, format or equipment of the session — it only changes dose, complexity, rest and impact. The session must still be a real workout — reduce volume, never purpose.`;
  if (m === "fun")
    return "Athlete wants a fun session. Use varied, playful patterns, unusual couplets and a game-style finisher, while keeping every prescription measurable.";
  if (HIGH_ENERGY.has(m))
    return "Athlete has good energy. Push toward the upper end of the prescribed sets and reps, allow the harder progression of each movement and keep rest at the shorter end of the window.";
  return "Athlete feels normal. Programme the middle of every prescribed range.";
}


const RESTRICTED_LOCATIONS: Record<string, string> = {
  home: "Training at home: assume a small floor space, no barbell rack, no machines, no heavy loading and no running. Every movement must work in one or two square metres with quiet landings (no repeated loud jumping).",
  hotel:
    "Training in a hotel room: tiny space, hard floor, no equipment beyond what was selected, thin walls. No jumping, no dropping loads, no running, no long travelling movements.",
  outdoors:
    "Training outdoors: no machines, no benches unless bodyweight-improvised, uneven surface. Prefer carries, sprints, hills, steps, bodyweight and portable equipment only.",
  gym: "Training in a full gym: racks, benches, machines and cardio equipment may be used, but only from the athlete's selected equipment list.",
};

function locationDirective(location: string | null | undefined): string {
  const l = (location ?? "").toLowerCase();
  return (
    RESTRICTED_LOCATIONS[l] ??
    "Training location is flexible: keep every movement possible with the selected equipment and a small floor area."
  );
}

function intensityDirective(stars: number, category: Category): string {
  const step =
    stars % 2 === 1
      ? " This is the EASIER of the two stars in this level: volume at the low end, rest at the generous end."
      : " This is the HARDER of the two stars in this level: volume at the high end, rest at the tighter end, but NEVER exercises from a higher level.";
  const band =
    stars <= 2
      ? "Beginner band (1-2 stars): teach the pattern. Simple bilateral movements, longer rest, clearly submaximal effort, no failure."
      : stars <= 4
        ? "Intermediate band (3-4 stars): solid volume, moderate complexity, work close to but not at technical breakdown."
        : "Advanced band (5-6 stars): greater training demand — more volume, appropriate loading, shorter rest and more challenging but FAMILIAR variations of common movements. Advanced never means gymnastics, levers, handstands, pistol squats, Turkish get-ups, Olympic lifting or technically complicated exercises. Still 1-2 reps in reserve on every set.";
  const base = band + step;
  const guard =
    category === "RECOVERY" || category === "MOBILITY & STABILITY"
      ? " Intensity here means quality of control, never fatigue."
      : "";
  return base + guard;
}

// ---------------------------------------------------------------------------
// Equipment families and transition efficiency
// ---------------------------------------------------------------------------

/** §12/§32 — one authoritative family definition, owned by the doctrine. */
export { equipmentFamilyOf as equipmentFamily } from "./doctrine.ts";

/** Number of station changes across an ordered list of exercises. */
export function countTransitions(families: string[]): number {
  let switches = 0;
  for (let i = 1; i < families.length; i++) if (families[i] !== families[i - 1]) switches += 1;
  return switches;
}

function transitionBudget(category: Category, format: Format, mainMax: number): number {
  const dense =
    format === "CIRCUIT" ||
    format === "AMRAP" ||
    format === "EMOM" ||
    format === "TABATA" ||
    format === "FOR TIME";
  if (dense) return Math.max(1, Math.round(mainMax * 0.34));
  if (category === "STRENGTH" || category === "MUSCLE BUILDING") return Math.max(2, mainMax - 2);
  return Math.max(2, Math.round(mainMax * 0.5));
}

// ---------------------------------------------------------------------------
// Measurable transition cost
// ---------------------------------------------------------------------------

const FLOOR_RE = /(floor|lying|supine|prone|plank|glute bridge|crunch|sit-up|dead bug|bird dog|kneel|quadruped|side-lying|hip thrust|push-up)/i;

function positionOf(e: { name: string; body_part: string | null } | null): "floor" | "standing" {
  return e && FLOOR_RE.test(e.name) ? "floor" : "standing";
}

/**
 * Real-world setup cost of an ordered main block:
 *  +2 per equipment/station change, +1 per floor <-> standing change.
 * Lower is better; the score penalises anything above the format's budget.
 */
export function transitionCost(
  exercises: Array<{ name: string; equipment: string | null; body_part: string | null } | null>,
  _format: Format,
): number {
  let cost = 0;
  for (let i = 1; i < exercises.length; i++) {
    const prev = exercises[i - 1] ?? null;
    const cur = exercises[i] ?? null;
    if (equipmentFamilyOf(prev?.equipment ?? null) !== equipmentFamilyOf(cur?.equipment ?? null))
      cost += 2;
    if (positionOf(prev) !== positionOf(cur)) cost += 1;
  }
  return cost;
}

/** Practical transition-cost budget for a session plan. */
export function transitionCostBudget(plan: Pick<SessionPlan, "format" | "mainCount">): number {
  const dense =
    plan.format === "CIRCUIT" ||
    plan.format === "AMRAP" ||
    plan.format === "EMOM" ||
    plan.format === "TABATA" ||
    plan.format === "FOR TIME";
  const n = plan.mainCount[1];
  return dense ? Math.max(2, Math.round(n * 0.8)) : Math.max(4, Math.round(n * 1.6));
}


// ---------------------------------------------------------------------------
// Realistic block duration + the Strength / Muscle Building finisher decision
// ---------------------------------------------------------------------------

/** True for the two categories that follow the lifting doctrine. */
export function isLiftingCategory(category: Category): boolean {
  return category === "STRENGTH" || category === "MUSCLE BUILDING";
}

/**
 * Realistic minutes an ordered block occupies at the LOW end of its prescribed
 * dose: exercises × sets × (work + rest). Reps are costed at 4 sec each; a
 * timed piece uses its own seconds. This is the honest cost of the work, not
 * an advertised number.
 */
export function estimateBlockMinutes(exercises: number, dose: Dose): number {
  if (exercises <= 0) return 0;
  const workSec = dose.reps ? dose.reps[0] * 4 : (dose.seconds?.[0] ?? 30);
  const perSet = workSec + dose.restSec[0];
  return Math.round((exercises * dose.sets[0] * perSet) / 60);
}

export type FinisherDecision = {
  include: boolean;
  count: [number, number];
  dose: Dose | null;
  /** Minutes budgeted for the finisher (0 when omitted). */
  minutes: number;
  /** Realistic minutes the main block occupies. */
  mainMinutes: number;
  directive: string;
};

/**
 * Professional finisher gate for STRENGTH and MUSCLE BUILDING.
 *
 * The finisher is optional. It exists only when a short, complementary,
 * category-true piece genuinely fits in the time left after a quality Main
 * Workout, and only when the athlete is not already sufficiently fatigued.
 * There is no minute threshold and no time-filling.
 */
export function decideLiftingFinisher(input: {
  category: Category;
  level: DifficultyLevel;
  minutes: number;
  mainCount: [number, number];
  mainDose: Dose;
  finisherDose: Dose;
  mood?: string | null;
  shapeAllowsFinisher: boolean;
}): FinisherDecision {
  const strength = input.category === "STRENGTH";
  // §6 — REAL TIME. The honest cost of the main block is never shrunk to
  // manufacture room for a finisher. If the properly dosed main work fills the
  // session, the session simply carries no finisher.
  const raw = estimateBlockMinutes(input.mainCount[0], input.mainDose);
  const mainMinutes = raw;
  const remaining = Math.max(0, input.minutes - mainMinutes);

  const none = (why: string): FinisherDecision => ({
    include: false,
    count: [0, 0],
    dose: null,
    minutes: 0,
    mainMinutes,
    directive: `NO ⚡ Finisher today. ${why} A shorter, high-quality session is the correct professional decision — never add work to reach the advertised duration.`,
  });

  if (!input.shapeAllowsFinisher) return none("This duration carries no finisher slot.");
  if (remaining < 5)
    return none(
      `Only about ${remaining} min remain after a properly dosed Main Workout, which is not enough for a meaningful finisher.`,
    );
  // Fatigue gate: a hard session on a depleted athlete already did the job.
  if (isLowEnergyState(input.mood) && (input.level === "advanced" || raw >= input.minutes))
    return none("The athlete is fatigued and the Main Workout already delivers the intended stimulus.");

  const minutes = Math.min(10, Math.max(5, remaining));
  const count: [number, number] = [1, 2];
  const directive = strength
    ? `⚡ Finisher — OPTIONAL, complementary accessory volume only (about ${minutes} min, ${count[0]}-${count[1]} exercises). It must reinforce the SAME focus and muscles as the Main Workout, stay in REPS & SETS, and never become conditioning, metabolic or cardio work. It must never rival the Main Workout in exercises, sets or time, and it must never compromise recovery from the primary strength work. No failure.`
    : `⚡ Finisher — OPTIONAL, a short extra hypertrophy stimulus (about ${minutes} min, ${count[0]}-${count[1]} exercises). Target-muscle isolation or pump work on the SAME focus as the Main Workout, higher reps, controlled eccentrics, shorter rest, still REPS & SETS. Fewer exercises and fewer total sets than the Main Workout. Never conditioning, metabolic or cardio work.`;

  return { include: true, count, dose: input.finisherDose, minutes, mainMinutes, directive };
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

/**
 * A blueprint must be physically doable inside the requested duration.
 * Short sessions (10-15 min) with a heavy dose would otherwise prescribe far
 * more work than the advertised time, and every generation attempt would be
 * rejected by the duration gate. Here the main block is trimmed — exercises
 * first, then sets, then rest — until the honest cost of the work fits the
 * time available for the main block.
 */
function fitMainToBudget(
  mainCount: [number, number],
  dose: Dose,
  budgetMinutes: number,
  category: Category,
): { mainCount: [number, number]; dose: Dose } {
  let count: [number, number] = [mainCount[0], mainCount[1]];
  let d: Dose = { ...dose, sets: [dose.sets[0], dose.sets[1]], restSec: [dose.restSec[0], dose.restSec[1]] };

  // §1 — the clock is the container. Exercises go first: a 30-minute strength
  // session may legitimately hold only two or three high-quality lifts.
  const minExercises = isLiftingCategory(category) ? 2 : 3;
  // Rest is the LAST thing cut, and never below what the goal physiologically
  // needs (heavy strength keeps at least 90 sec).
  const restFloor = category === "STRENGTH" ? 90 : 60;

  while (estimateBlockMinutes(count[0], d) > budgetMinutes && count[0] > minExercises) {
    count = [count[0] - 1, Math.max(count[0] - 1, count[1] - 1)];
  }
  while (estimateBlockMinutes(count[0], d) > budgetMinutes && d.sets[0] > 2) {
    const lo = d.sets[0] - 1;
    d = { ...d, sets: [lo, Math.max(lo, d.sets[1] - 1)] };
  }
  while (estimateBlockMinutes(count[0], d) > budgetMinutes && d.restSec[0] > restFloor) {
    const lo = Math.max(restFloor, d.restSec[0] - 30);
    d = { ...d, restSec: [lo, Math.max(lo, d.restSec[1] - 30)] };
  }
  return { mainCount: count, dose: d };
}

export function buildSessionPlan(input: {
  category: Category;
  format: Format;
  level: DifficultyLevel;
  stars: number;
  minutes: number;
  mood?: string | null;
  location?: string | null;
  focus?: StrengthFocus | null;
  equipmentCount: number;
}): SessionPlan {
  const rawShape = durationShape(input.minutes, input.category);
  const raw = doseFor(input.category, input.level);
  const finisher = raw.finisher;
  // The advertised duration is TRAINING time: the main block owns the whole
  // clock, and activation / cool down are an allowance on top of it.
  const mainBudget = Math.max(4, input.minutes);
  // The Micro Workout shape is authored end to end and never trimmed.
  const fitted =
    input.category === "MICRO-WORKOUTS"
      ? { mainCount: rawShape.mainCount, dose: raw.main }
      : fitMainToBudget(rawShape.mainCount, raw.main, mainBudget, input.category);
  const shape: Shape = { ...rawShape, mainCount: fitted.mainCount };
  const main = fitted.dose;


  // HARD RULE: every category is locked to its legal format table (doctrine §4).
  // Strength, Muscle Building, Pilates and Mobility & Stability are always
  // REPS & SETS; Recovery is always MIX; anything illegal falls back to the
  // category's first legal format.
  const legal = legalFormats(input.category);
  const format: Format = legal.includes(input.format) ? input.format : legal[0]!;

  // HARD RULE (doctrine 20): Recovery, Micro Workout, Pilates and
  // Mobility & Stability never carry a finisher.
  const noFinisher = !categoryAllowsFinisher(input.category) || shape.finisherCount[1] === 0 || !finisher;


  let finisherCount: [number, number] = noFinisher ? [0, 0] : shape.finisherCount;
  let finisherDose: Dose | null = noFinisher ? null : finisher;
  let mainMinutesEstimate = estimateBlockMinutes(shape.mainCount[0], main);
  let finisherMinutes = noFinisher ? 0 : Math.max(0, input.minutes - mainMinutesEstimate);
  let finisherDirective = noFinisher
    ? "This category carries no ⚡ Finisher."
    : "⚡ Finisher stays short and true to the category objective.";

  if (isLiftingCategory(input.category)) {
    const decision = decideLiftingFinisher({
      category: input.category,
      level: input.level,
      minutes: input.minutes,
      mainCount: shape.mainCount,
      mainDose: main,
      finisherDose: finisher ?? main,
      mood: input.mood ?? null,
      shapeAllowsFinisher: !noFinisher,
    });
    finisherCount = decision.count;
    finisherDose = decision.include ? decision.dose : null;
    finisherMinutes = decision.minutes;
    mainMinutesEstimate = decision.mainMinutes;
    finisherDirective = decision.directive;
  }




  const dense =
    format === "CIRCUIT" ||
    format === "AMRAP" ||
    format === "EMOM" ||
    format === "TABATA" ||
    format === "FOR TIME";

  return {
    category: input.category,
    format,
    level: input.level,
    minutes: input.minutes,
    softTissue: shape.softTissue,
    activationCount: shape.activationCount,
    mainCount: shape.mainCount,
    finisherCount,
    cooldownCount: shape.cooldownCount,
    main,
    finisher: finisherDose,
    sequence: SEQUENCES[input.category] ?? ["compound", "compound", "accessory", "core"],
    maxEquipmentFamilies: dense
      ? Math.min(2, Math.max(1, input.equipmentCount))
      : Math.min(3, Math.max(1, input.equipmentCount)),
    maxTransitions: transitionBudget(input.category, format, shape.mainCount[1]),
    mainMinutesEstimate,
    finisherMinutes,
    finisherDirective,
    moodDirective: moodDirective(input.mood),
    locationDirective: locationDirective(input.location),
    intensityDirective: intensityDirective(input.stars, input.category),
    ...(input.category === "CARDIO" ? { cardioExpression: cardioExpression(format) } : {}),
  };


}

const range = ([a, b]: [number, number], unit: string) =>
  a === b ? `${a} ${unit}` : `${a}-${b} ${unit}`;

function doseText(label: string, d: Dose): string {
  const bits = [
    `${label}: ${range(d.sets, "sets")}`,
    d.reps ? `${range(d.reps, "reps")}` : "",
    d.seconds ? `or ${range(d.seconds, "sec")} of work` : "",
    `rest ${range(d.restSec, "sec")} written on every line`,
    `tempo — ${d.tempo}`,
  ].filter(Boolean);
  return bits.join(", ");
}

/** The blueprint text injected into the model prompt. */
export function planPrompt(plan: SessionPlan): string {
  const micro = plan.category === "MICRO-WORKOUTS";
  const pilates = plan.category === "PILATES";
  const lifting = isLiftingCategory(plan.category);
  const lines = [
    `SESSION BLUEPRINT (hard numbers — a session outside these ranges is rejected)`,
    HUMAN_REALISM_PROMPT,
    doctrinePrompt(plan.category, plan.format),


    micro
      ? `- NO 🧽 Soft Tissue, NO 🔥 Activation, NO ⚡ Finisher, NO 🧘 Cool Down. Output ONE 💪 Main Workout section only — the first movement is the preparation.`
      : plan.activationCount === 0
        ? `- NO separate 🔥 Activation section.`
        : `- 🔥 Activation: exactly ${plan.activationCount} token lines${pilates ? " that directly prepare the patterns used in the main work (breath, spine, hips or trunk control) — skip it entirely if it adds nothing" : ""}.`,
    `- 💪 Main Workout: ${range(plan.mainCount, "exercises")}.`,
    plan.finisher
      ? `- ⚡ Finisher: ${range(plan.finisherCount, "exercises")}${plan.finisherMinutes ? `, about ${plan.finisherMinutes} min total` : ""}.`
      : `- NO Finisher section at this duration and category.`,
    plan.cooldownCount === 0
      ? ``
      : `- 🧘 Cool Down: ${plan.cooldownCount} token lines plus one breathing line.`,
    micro
      ? `- MICRO WORKOUT CONCEPT: an approximately ${microMinutes(plan.minutes)}-minute equipment-free movement break someone can do right now in office clothes, at a desk, on a sofa or in a small room. Bodyweight and everyday environment only (floor, wall, chair, sofa, desk, table, and a step or staircase when one happens to be there). Zero training equipment of any kind. Stairs may only ever be an optional surface, never a required setup, and there must always be a plain floor alternative. NO doorways, NO pull-up bars, NO other location-dependent setups. Keep the athlete in one small area with minimal movement around the room. Scale the number of movements, sets, work and rest so the session really lasts about ${microMinutes(plan.minutes)} minutes — never inflate a short request into a longer session. Keep it light and simple: 2-3 sets, short rest, well short of failure, plain patterns (squats, sit-to-stands, chair/desk/wall push-ups, lunges, calf raises, marching, gentle trunk and mobility work). Movement and activation, never a sweaty high-intensity session. Golden test: can this be performed immediately, in normal clothes, with zero setup, in one small area? If not, rewrite it.`
      : ``,
    pilates
      ? `- PILATES CONCEPT: a controlled Pilates session in SETS & REPS only — never Tabata, AMRAP, EMOM, For Time, circuit, HIIT or metabolic work, and never a conditioning finisher. Emphasise control, precision, breathing, spinal articulation, deep core, stability and full controlled range. Sequence movements so positions flow (supine work together, side-lying together, quadruped together) and keep equipment changes to a minimum. Quality over speed and fatigue.`
      : ``,
    lifting
      ? plan.category === "STRENGTH"
        ? `- STRENGTH DOCTRINE: the objective is maximal strength and force production with high technical quality — this is NOT hypertrophy with heavier weights. REPS & SETS only (no AMRAP, EMOM, Tabata, For Time, circuit or chipper anywhere in the session, finisher included). Hierarchy: primary compound → secondary compound → accessory → accessory → core/carry, and only as many of those levels as the time honestly allows. The primary compound gets the highest priority, the freshest athlete and the longest rest. Keep 1-3 reps in reserve, never train primary strength work to failure, and never shorten rest just to make the session fit the advertised duration.`
        : `- MUSCLE BUILDING DOCTRINE: the objective is hypertrophy — mechanical tension, controlled eccentrics, adequate volume and appropriate proximity to failure. This is NOT strength with higher reps. REPS & SETS only (no AMRAP, EMOM, Tabata, For Time, circuit or chipper anywhere, finisher included). Hierarchy: primary compound → secondary compound → targeted accessory → accessory/isolation → optional pump movement, only as many as the time honestly allows. Rest 60-90 sec on most work, longer on demanding compounds when quality needs it. Beginner 2-3 RIR, intermediate and advanced 1-2 RIR — do not routinely prescribe absolute failure. Tempo must suit the movement, not be copy-pasted onto every line.`
      : ``,
    lifting ? `- FINISHER DECISION: ${plan.finisherDirective}` : ``,
    lifting
      ? `- NO ARTIFICIAL TIME FILLING: the advertised duration is a programming target, not a quota. A professionally programmed ${Math.max(1, plan.minutes - 8)}-minute session beats a padded ${plan.minutes}-minute one. Never invent work to reach a number, and never let the ⚡ Finisher rival the 💪 Main Workout in exercises, sets or time.`
      : ``,
    doseText("- Main Workout dosing", plan.main),
    plan.finisher ? doseText("- Finisher dosing", plan.finisher) : "",
    `- MOVEMENT ORDER in 💪: ${plan.sequence.join(" → ")}. Technical and heaviest work first, isolation and conditioning last, core never before the movements that need bracing.`,
    `- POSITIONAL FLOW: group standing work together, floor work together. Never alternate floor → standing → floor line after line.`,
    `- TRANSITION EFFICIENCY: use at most ${plan.maxEquipmentFamilies} equipment family/families across 💪 and ⚡, and at most ${plan.maxTransitions} station changes in 💪. Consecutive lines should share the same implement wherever the pattern allows; a circuit must be runnable without walking across a gym.`,
    plan.cardioExpression ? `- ${plan.cardioExpression.directive}` : "",
    `- MOOD: ${plan.moodDirective}`,
    `- LOCATION: ${plan.locationDirective}`,
    `- DIFFICULTY: ${plan.intensityDirective}`,
    lifting
      ? `- TIME MATH: ${plan.minutes} min of advertised work counts 💪 + ⚡ only. Dose the Main Workout honestly (sets × (work + rest)); if that already fills the session, output no Finisher rather than compressing the main work.`
      : `- TIME MATH: ${plan.minutes} min of advertised work counts 💪 + ⚡ only. Before writing, add up the cost of every 💪 and ⚡ line: the total must land between ${Math.max(4, plan.minutes - 4)} and ${plan.minutes + 3} minutes. Below that, add rounds, sets or one more exercise; above it, cut rounds, sets or rest.
- ROUNDS MULTIPLY: a declared "N rounds" repeats every line in the block N times, and a declared AMRAP/EMOM/cap window costs that whole window. Count that multiplication in your arithmetic — ${plan.minutes} min means, for example, 5 stations × 45 sec work + 15 sec rest × ${Math.max(2, Math.round((plan.minutes * 60) / (5 * 60)))} rounds, not 5 stations repeated until the clock happens to fill. Never declare a window longer than ${plan.minutes} min.
- PREP BUDGET: 🧽 under 3 min, 🔥 under ${Math.max(3, Math.min(6, Math.round(plan.minutes / 5)))} min and 🧘 under 5 min. The whole session (prep + training + cool down) must stay close to ${plan.minutes} min plus that short allowance — an over-long session is rejected exactly like a short one.`,
    !lifting
      ? `- ROUND COUNT: with ${plan.mainCount[0]} stations in 💪, declare about ${Math.max(2, Math.min(8, Math.round((plan.minutes * 60 * 0.8) / (Math.max(3, plan.mainCount[0]) * 60))))} rounds (or an equivalent window) — that is what fills ${plan.minutes} min. More rounds than that is an over-long session and is rejected.`
      : ``,
    plan.activationCount > 0
      ? `- ACTIVATION REGION: the 🔥 drills must prepare the same region the 💪 Main Workout trains. Lower-body main work → mostly hip, glute, knee and ankle drills; upper-body main work → mostly shoulder, scapula, thoracic and arm drills; core-dominant main work → mostly trunk, pelvis and breathing drills; full-body → cover both hips and shoulders.`
      : ``,
  ];
  return lines.filter(Boolean).join("\n");
}


// ---------------------------------------------------------------------------
// Post-generation quality score
// ---------------------------------------------------------------------------

export type QualityReport = {
  score: number;
  issues: string[];
};

/**
 * Scores a finished session against its blueprint: structure, dosing,
 * transition efficiency, variety and preference fit. 100 is perfect.
 */
export function scoreWorkout(
  steps: WorkoutStep[],
  plan: SessionPlan,
  opts: {
    library: Map<string, PoolExercise>;
    favoriteIds?: string[];
    dislikedIds?: string[];
    recentIds?: string[];
    estimatedMinutes: number;
  },
): QualityReport {
  const issues: string[] = [];
  let score = 100;
  const penalise = (points: number, issue: string) => {
    score -= points;
    issues.push(issue);
  };

  const main = steps.filter((s) => s.section === "Main Workout");
  const finisher = steps.filter((s) => s.section === "Finisher");
  const activation = steps.filter((s) => s.section === "Activation" || s.section === "Warm-up");
  const cooldown = steps.filter((s) => s.section === "Cool-down");

  // 1. Structure.
  if (main.length < plan.mainCount[0])
    penalise(12, `Main Workout has ${main.length} exercises, blueprint asks for ${plan.mainCount[0]}+.`);
  if (main.length > plan.mainCount[1] + 1)
    penalise(6, `Main Workout has ${main.length} exercises, above the ${plan.mainCount[1]} target.`);
  if (plan.finisher) {
    if (finisher.length < plan.finisherCount[0])
      penalise(10, `Finisher has ${finisher.length} exercises, blueprint asks for ${plan.finisherCount[0]}+.`);
  } else if (finisher.length) {
    penalise(6, "A Finisher was added to a session that should not have one.");
  }
  if (activation.length < Math.min(3, plan.activationCount))
    penalise(8, `Activation has only ${activation.length} playable drills.`);
  if (cooldown.length < Math.min(3, plan.cooldownCount))
    penalise(8, `Cool Down has only ${cooldown.length} playable stretches.`);

  // 2. Dosing against the goal.
  const work = [...main, ...finisher];
  let offRange = 0;
  for (const step of work) {
    const reps = Number(step.prescription.match(/(\d+)\s*reps?/i)?.[1] ?? 0);
    if (!reps || !plan.main.reps) continue;
    const [lo, hi] = plan.main.reps;
    if (reps < lo - 2 || reps > hi + 4) offRange += 1;
  }
  if (offRange) penalise(Math.min(15, offRange * 4), `${offRange} prescriptions sit outside the goal rep range.`);

  const restLines = work.filter((s) => /rest/i.test(s.prescription)).length;
  if (work.length && restLines < Math.ceil(work.length * 0.5))
    penalise(6, "Rest is missing from most working lines.");

  // 3. Transition efficiency — measured with an explicit transition cost.
  const familyOf = (id: string) => equipmentFamilyOf(opts.library.get(id)?.equipment ?? null);
  const mainFamilies = main.map((s) => familyOf(s.exerciseId));
  const transitions = countTransitions(mainFamilies);
  if (transitions > plan.maxTransitions)
    penalise(
      Math.min(12, (transitions - plan.maxTransitions) * 4),
      `Main Workout changes station ${transitions} times (budget ${plan.maxTransitions}).`,
    );
  const families = new Set([...mainFamilies, ...finisher.map((s) => familyOf(s.exerciseId))]);
  if (families.size > plan.maxEquipmentFamilies + 1)
    penalise(6, `Session spans ${families.size} equipment families.`);

  const cost = transitionCost(
    main.map((s) => opts.library.get(s.exerciseId) ?? null),
    plan.format,
  );
  const budget = transitionCostBudget(plan);
  if (cost > budget)
    penalise(
      Math.min(14, Math.round((cost - budget) * 2)),
      `Transition cost ${cost} exceeds the practical budget of ${budget} for a ${plan.format} session — regroup the movements by station and position.`,
    );


  // 4. Variety and repetition.
  const workIds = work.map((s) => s.exerciseId);
  const unique = new Set(workIds).size;
  if (workIds.length >= 5 && unique < Math.ceil(workIds.length * 0.7))
    penalise(8, "The session repeats the same exercises too often.");
  const recent = new Set(opts.recentIds ?? []);
  if (recent.size) {
    const repeats = workIds.filter((id) => recent.has(id)).length;
    if (repeats > Math.ceil(workIds.length * 0.5))
      penalise(6, "Most of the session repeats the athlete's previous workouts.");
  }

  // 5. Preferences.
  const disliked = new Set(opts.dislikedIds ?? []);
  const hits = workIds.filter((id) => disliked.has(id)).length;
  if (hits) penalise(20, `${hits} excluded exercises made it into the session.`);
  const favourites = opts.favoriteIds ?? [];
  if (favourites.length && !workIds.some((id) => favourites.includes(id)))
    penalise(3, "None of the athlete's favourite exercises were programmed.");

  // 6. Duration accuracy.
  const drift = Math.abs(opts.estimatedMinutes - plan.minutes);
  if (drift > 8) penalise(Math.min(12, Math.round(drift / 2)), `Prescribed work drifts ${drift} min from the request.`);

  return { score: Math.max(0, Math.round(score)), issues };
}
