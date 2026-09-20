// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAM EXERCISE PICKER
// Deterministic library-first exercise selection for training program days.
// Used by generate-admin-program and restructure-training-programs to guarantee
// every bullet uses a real {{exercise:ID:Name}} token (eye icon preserved) and
// to enforce equipment + difficulty constraints WITHOUT relying on the model.
// ═══════════════════════════════════════════════════════════════════════════════
// ONE selection policy for the whole platform — see ./exercise-selection.ts
import { exerciseFamily, isSelectable, selectionTier } from "./exercise-selection.ts";
import { matchesSelectedEquipment } from "./workout-engine/pool.server.ts";
import {
  hasProgramDoctrine,
  programAllowsFinisher,
  programBodyweightToFailure,
  programDoctrine,
  programHasRecoveryCharacter,
  programLocomotionMode,
  programMainFormat,
  programWorkExerciseViolation,
} from "./program-doctrine.ts";


export interface LibExercise {
  id: string;
  name: string;
  body_part?: string | null;
  equipment?: string | null;
  target?: string | null;
  difficulty?: string | null;
  description?: string | null;
}

const BODYWEIGHT_EQUIPMENT = new Set(["body weight", "bodyweight"]);

const APPARATUS_DEPENDENT_BODYWEIGHT: RegExp[] = [
  /\bbench\b/i,
  /pull-?up/i,
  /chin-?up/i,
  /front\s*lever/i,
  /hanging/i,
  /muscle[-\s]*up/i,
  /\bdip(s)?\b/i,
  /parallel\s*bars?/i,
  /\brings?\b/i,
  /captains?\s*chair/i,
  /vertical\s*bar/i,
  /straight\s*bar/i,
  /glute-?ham|\bghd\b/i,
  /hyperextension/i,
  /\bbox\b/i,
];

const ABSOLUTE_SKILL_PATTERNS: RegExp[] = [
  /muscle[-\s]*up/i,
  /planche/i,
  /maltese/i,
  /one\s*arm\s*push/i,
  /handstand\s*push/i,
  /^handstand$/i,
  /iron\s*cross/i,
  /front\s*lever/i,
  /back\s*lever/i,
  /human\s*flag|\bflag\b/i,
  /archer\s*push/i,
  /clock\s*push/i,
  /single\s*arm\s*push|one\s*hand\s*push/i,
  /one\s*hand\s*pull/i,
  /sissy\s*squat/i,
  /stalder/i,
  /skin\s*the\s*cat/i,
  /\bv-?sit\b/i,
  /pike\s*push/i,
];

const CONDITIONAL_ADVANCED_SKILL_PATTERNS: RegExp[] = [/pistol|one\s*leg\s*squat/i];

// Category intent filters live in ./program-doctrine.ts — ONE rules source for
// the picker, the generator prose and the compliance audit.
type CategoryRule = {
  preferred: RegExp[];
  forbidden: RegExp[];
  allowCardioBodyPart?: boolean;
  rejectCardioBodyPart?: boolean;
};


const DAY_FOCUS_KEYWORDS: Record<string, { body_part?: string[]; target?: string[]; name?: string[] }> = {
  "lower body": { body_part: ["upper legs", "lower legs", "legs", "hips"] },
  "upper body": { body_part: ["chest", "back", "upper arms", "shoulders"] },
  "chest": { body_part: ["chest"] },
  "back": { body_part: ["back"] },
  "shoulders": { body_part: ["shoulders"] },
  "arms": { body_part: ["upper arms", "lower arms"] },
  "core": { body_part: ["waist"], target: ["abs", "obliques"] },
  "full body": {},
  "conditioning": { body_part: ["cardio"], name: ["squat", "burpee", "lunge", "push", "row"] },
  "cardio": { body_part: ["cardio"] },
  "endurance": { body_part: ["cardio"] },
  "interval": { body_part: ["cardio"] },
  "tempo": { body_part: ["cardio"] },
  "hip": { body_part: ["hips", "upper legs"], target: ["glutes", "hip flexors", "adductors"] },
  "spinal": { body_part: ["waist", "back"], target: ["spine", "abs"] },
  "stability": { target: ["abs", "obliques", "spine"] },
  "mobility": { name: ["stretch", "mobility", "rotation", "circle", "swing"] },
  "movement": { name: ["squat", "lunge", "hinge", "push", "pull", "carry"] },
  "metabolic": { name: ["burpee", "thruster", "swing", "snatch", "clean", "jump"] },
  "challenge": { name: ["burpee", "thruster", "complex", "jump"] },
  "calorie": { body_part: ["cardio"], name: ["burpee", "jump", "swing"] },
  "fat loss": { name: ["burpee", "thruster", "swing", "jump"] },
  "carries": { name: ["carry", "farmer", "suitcase"] },
  "power": { name: ["jump", "clean", "snatch", "throw", "swing"] },
  "thoracic": { name: ["thoracic", "t-spine", "rotation"] },
  "posterior": { target: ["glutes", "hamstrings", "lower back"] },
  "legs": { body_part: ["upper legs", "lower legs", "legs", "hips"] },
  "glutes": { target: ["glutes"] },
  "quadriceps": { target: ["quadriceps", "quads"] },
  "quads": { target: ["quadriceps", "quads"] },
  "hamstrings": { target: ["hamstrings"] },
  "calves": { target: ["calves", "gastrocnemius", "soleus"] },
  "biceps": { target: ["biceps"] },
  "triceps": { target: ["triceps"] },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWholePhrase(text: string, phrase: string): boolean {
  const pattern = phrase
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("[^a-z0-9]+");
  return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, "i").test(text || "");
}

function fieldMatchesAny(value: string | null | undefined, terms?: string[]): boolean {
  if (!terms?.length) return false;
  const text = (value || "").toLowerCase();
  return terms.some((term) => hasWholePhrase(text, term.toLowerCase()));
}

function matchesFocus(ex: LibExercise, focus: string): boolean {
  const focusLower = focus.toLowerCase();
  const activeKeys = Object.keys(DAY_FOCUS_KEYWORDS).filter((key) => hasWholePhrase(focusLower, key));
  if (!activeKeys.length) return true;

  for (const key of activeKeys) {
    const def = DAY_FOCUS_KEYWORDS[key];
    if (!def.body_part && !def.target && !def.name) return true;
    if (fieldMatchesAny(ex.body_part, def.body_part)) return true;
    if (fieldMatchesAny(ex.target, def.target)) return true;
    if (fieldMatchesAny(ex.name, def.name)) return true;
  }
  return false;
}

function isBodyweightExercise(ex: LibExercise): boolean {
  return BODYWEIGHT_EQUIPMENT.has((ex.equipment || "").toLowerCase().trim());
}

function isHomeBodyweightFriendly(ex: LibExercise): boolean {
  return isBodyweightExercise(ex) && !APPARATUS_DEPENDENT_BODYWEIGHT.some((pattern) => pattern.test(ex.name || ""));
}

function isStaticHoldExercise(ex: LibExercise): boolean {
  const name = (ex.name || "").toLowerCase().trim();
  if (/^front\s+lever\s+reps$/i.test(name)) return true;
  if (/^flag$|^full\s+planche$|^handstand$/i.test(name)) return true;
  if (!name || /\breps?\b|tap|twist|row|fly|raise|press|push|pull|wiper|walk|crawl/i.test(name)) return false;

  return [
    /^back\s+lever$/i,
    /^front\s+lever$/i,
    /\bl-?sit\b/i,
    /\bplanche\b/i,
    /\bwall\s+sit\b/i,
    /\bdead\s+hang\b/i,
    /\bsupport\s+hold\b/i,
    /\bhollow\s+(?:body\s+)?hold\b/i,
    /\barch\s+hold\b/i,
    /\bforearm\s+plank\b/i,
    /^bodyweight\s+incline\s+side\s+plank$/i,
    /\bisometric\s+chest\s+squeeze\b/i,
    // Anything whose name ends in "hold" is a position, not a set of reps.
    /\bhold$/i,
  ].some((pattern) => pattern.test(name));
}

function excludesStaticHolds(ex: LibExercise): boolean {
  return !isStaticHoldExercise(ex);
}

function isAdvancedTier(difficulty?: string | null): boolean {
  return tierOf(difficulty) === "Advanced";
}

function isSkillExercise(ex: LibExercise, difficulty?: string | null): boolean {
  const name = ex.name || "";
  if (ABSOLUTE_SKILL_PATTERNS.some((pattern) => pattern.test(name))) return true;
  if (CONDITIONAL_ADVANCED_SKILL_PATTERNS.some((pattern) => pattern.test(name))) return true;
  return false;
}

function excludesSkillExercises(ex: LibExercise, difficulty?: string | null): boolean {
  return !isSkillExercise(ex, difficulty);
}

function ruleForCategory(category: string): CategoryRule | null {
  if (!hasProgramDoctrine(category)) return null;
  const doctrine = programDoctrine(category);
  return {
    preferred: doctrine.preferred,
    forbidden: doctrine.forbidden,
    allowCardioBodyPart: doctrine.allowCardioBodyPart,
    rejectCardioBodyPart: doctrine.rejectCardioBodyPart,
  };
}


function exerciseSearchText(ex: LibExercise): string {
  return `${ex.name || ""} ${ex.body_part || ""} ${ex.target || ""} ${ex.description || ""}`;
}

function matchesCategoryRule(ex: LibExercise, category: string): boolean {
  const rule = ruleForCategory(category);
  if (!rule) return true;
  const text = exerciseSearchText(ex);
  if (rule.forbidden.some((pattern) => pattern.test(text))) return false;
  if (rule.rejectCardioBodyPart && (ex.body_part || "").toLowerCase() === "cardio") return false;
  if (rule.allowCardioBodyPart && (ex.body_part || "").toLowerCase() === "cardio") return true;
  return rule.preferred.some((pattern) => pattern.test(text));
}

function categorySelectionPool(library: LibExercise[], category: string, needed: number, difficulty?: string | null): LibExercise[] {
  const safe = library
    .filter((ex) => excludesSkillExercises(ex, difficulty))
    // Coach's permanent bans — bosu loading, unstable surfaces, elevated
    // single-leg squats, lever/gymnastic complexity. Same rules as workouts.
    .filter((ex) => isSelectable(ex.name || ""));
  const format = programMainFormat(category, 1);
  const doctrineSafe = safe.filter((ex) => !programWorkExerciseViolation({
    ...ex,
    equipment: ex.equipment ?? null,
    target_muscle: ex.target,
  }, category, format));
  if (!ruleForCategory(category)) return doctrineSafe;
  const categoryMatched = doctrineSafe.filter((ex) => matchesCategoryRule(ex, category));
  return categoryMatched.length ? categoryMatched : doctrineSafe;
}

function defaultPrescription(category: string, dayTitle: string): string {
  const cat = category.toUpperCase();
  const title = dayTitle.toLowerCase();
  if (cat.includes("HYPERTROPHY")) return "4 × 8–12 reps, tempo 3-1-1, rest 75–90 sec";
  if (cat.includes("FUNCTIONAL STRENGTH")) return "4 × 6–10 reps, rest 90 sec";
  if (cat.includes("WEIGHT LOSS") || title.includes("metabolic")) return "3 rounds × 40 sec work / 20 sec transition, rest 90 sec after each round";
  if (cat.includes("CARDIO") || title.includes("interval") || title.includes("conditioning")) return "3 rounds × 45 sec work / 15 sec transition, rest 90 sec after each round";
  if (cat.includes("MOBILITY") || cat.includes("LOW BACK")) return "2–3 × 10–12 controlled reps, rest 45 sec";
  return "3 × 10–12 reps, rest 60 sec";
}

export function prescriptionForExercise(ex: LibExercise, category: string, dayTitle: string): string {
  if (!isStaticHoldExercise(ex)) return defaultPrescription(category, dayTitle);

  const cat = category.toUpperCase();
  const title = dayTitle.toLowerCase();
  if (cat.includes("FUNCTIONAL STRENGTH")) return "4 × 8-sec holds";
  if (cat.includes("CARDIO") || title.includes("interval") || title.includes("conditioning")) return "4 × 15-sec holds";
  if (cat.includes("WEIGHT LOSS") || title.includes("metabolic")) return "3 rounds × 20-sec holds";
  if (cat.includes("MOBILITY") || cat.includes("LOW BACK")) return "2 × 20-sec holds";
  return "3 × 10-sec holds";
}

export function buildExerciseBullet(ex: LibExercise, category: string, dayTitle: string): string {
  return `• {{exercise:${ex.id}:${ex.name}}} – ${prescriptionForExercise(ex, category, dayTitle)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY-DRIVEN WORKOUT PROTOCOL (AMRAP / CIRCUIT / TABATA / EMOM / SETS & REPS / HOLDS)
// Each daily Main Workout inside a training program must follow a real workout
// protocol selected from the program category — exactly like our standalone
// workouts. Prescription ALWAYS appears BEFORE the {{exercise:ID:Name}} token.
// ═══════════════════════════════════════════════════════════════════════════════

export type ProtocolStyle =
  | "AMRAP"
  | "CIRCUIT"
  | "TABATA"
  | "EMOM"
  | "FOR TIME"
  | "INTERVALS"
  | "REPS & SETS"
  | "HOLDS";

interface CategoryProtocol {
  main: ProtocolStyle;
  mainIntro: string;
  finisher: ProtocolStyle;
  finisherIntro: string;
}

function rotate<T>(list: T[], index: number): T {
  return list[(index - 1 + list.length) % list.length];
}

/**
 * Pick the protocol the daily Main Workout must follow.
 * Rotates across Week A vs Week B for variety, but never violates the
 * category's "Never use" rules (LOW BACK / MOBILITY = SETS & REPS / HOLDS only).
 */
export function categoryProtocol(category: string, weekIndex: number): CategoryProtocol {
  const cat = (category || "").toUpperCase();

  if (cat.includes("CARDIO")) {
    const main = rotate<ProtocolStyle>(["AMRAP", "EMOM", "INTERVALS", "CIRCUIT"], weekIndex);
    return {
      main,
      mainIntro:
        main === "AMRAP"
          ? "20-minute AMRAP — complete as many rounds as possible at a sustainable aerobic pace."
          : main === "EMOM"
            ? "20-minute EMOM — at the top of every minute perform the prescribed reps, rest the remainder."
            : main === "INTERVALS"
              ? "6 rounds × 3 min work / 1 min easy recovery — hold a strong-but-sustainable Zone 3–4 effort."
              : "5 rounds for quality — 60 sec work / 30 sec transition, rest 90 sec after each full round.",
      finisher: "FOR TIME",
      finisherIntro: "Finisher for time (5-minute cap) — steady aerobic pace, scale reps before scaling form.",
    };
  }

  if (cat.includes("WEIGHT LOSS")) {
    const main = rotate<ProtocolStyle>(["CIRCUIT", "TABATA", "EMOM", "AMRAP"], weekIndex);
    return {
      main,
      mainIntro:
        main === "TABATA"
          ? "Tabata blocks — 8 rounds × 20 sec work / 10 sec rest per exercise, 60 sec rest between exercises."
          : main === "EMOM"
            ? "16-minute EMOM — alternate exercises every minute, hit prescribed reps, rest the remainder."
            : main === "AMRAP"
              ? "18-minute AMRAP — keep moving, scale reps before form, breathe steadily."
              : "5 rounds × 40 sec work / 20 sec rest per station, rest 90 sec between rounds.",
        finisher: "TABATA",
        finisherIntro: "Finisher Tabata — 4-minute block, 8 rounds × 20 sec work / 10 sec rest, alternate the two exercises.",
    };
  }

  if (cat.includes("HYPERTROPHY")) {
    return {
      main: "REPS & SETS",
      mainIntro: "Hypertrophy block — controlled tempo, 1–2 reps in reserve on every working set.",
      finisher: "REPS & SETS",
      finisherIntro: "Accessory finisher — high-rep pump work, focus on the working muscle, strict form.",
    };
  }

  if (cat.includes("FUNCTIONAL STRENGTH")) {
    return {
      main: "REPS & SETS",
      mainIntro: "Sets and reps — practical compound strength, full rest, every rep technically perfect.",
      finisher: "REPS & SETS",
      finisherIntro: "Accessory finisher — 3 sets with controlled reps and complete rest; stop if form breaks.",
    };
  }

  if (cat.includes("LOW BACK")) {
    return {
      main: "REPS & SETS",
      mainIntro: "Sets and reps only — every rep must be pain-free. Reduce range before reducing load. No circuits, AMRAPs, EMOMs, Tabata, HIIT, jumps, sprints, burpees, or box jumps.",
      finisher: "REPS & SETS",
      finisherIntro: "Stability finisher — sets and reps only, breathe through every rep, stop the moment quality drops.",
    };
  }

  if (cat.includes("MOBILITY")) {
    return {
      main: "REPS & SETS",
      mainIntro: "Sets, reps, and timed holds only — never AMRAP, EMOM, circuit, Tabata, HIIT, burpees, sprints, jumps, or metabolic circuits.",
      finisher: "REPS & SETS",
      finisherIntro: "Controlled work only — breathe steadily and never force depth or speed.",
    };
  }

  // Default: balanced strength + conditioning
  return {
    main: "REPS & SETS",
    mainIntro: "Sets and reps — controlled tempo, full rest between working sets.",
    finisher: "AMRAP",
    finisherIntro: "Finisher AMRAP (6-minute cap) — sustainable pace, stop the round if form breaks.",
  };
}

function protocolMainPrescription(style: ProtocolStyle, ex: LibExercise, slotIndex: number, category: string, dayTitle: string): string {
  const token = `{{exercise:${ex.id}:${ex.name}}}`;
  const isHold = isStaticHoldExercise(ex);

  switch (style) {
    case "AMRAP":
      if (isHold) return `• 20 sec ${token}`;
      return `• 12 reps ${token}`;
    case "CIRCUIT":
      if (isHold) return `• 30 sec ${token}`;
      return `• 40 sec ${token}`;
    case "TABATA":
      if (isHold) return `• 8 rounds × 20 sec hold ${token} / 10 sec rest`;
      return `• 8 rounds × 20 sec ${token} / 10 sec rest`;
    case "EMOM":
      if (isHold) return `• Min ${slotIndex} — 30 sec hold ${token}`;
      return `• Min ${slotIndex} — 12 reps ${token}`;
    case "FOR TIME":
      if (isHold) return `• 60 sec accumulated hold ${token}`;
      return `• 30 reps ${token}`;
    case "INTERVALS":
      if (isHold) return `• 3 min × 30 sec hold ${token} / 30 sec easy`;
      return `• 3 min steady effort ${token}`;
    case "HOLDS":
      return `• 2 × 30 sec ${token}`;
    case "REPS & SETS":
    default:
      if (isHold) {
        const cat = category.toUpperCase();
        if (cat.includes("FUNCTIONAL STRENGTH")) return `• 4 sets × 15 sec hold ${token} — rest 60 sec`;
        if (cat.includes("HYPERTROPHY")) return `• 3 sets × 20 sec hold ${token} — rest 45 sec`;
        if (cat.includes("LOW BACK") || cat.includes("MOBILITY")) return `• 2 sets × 30 sec ${token} — rest 45 sec`;
        return `• 3 sets × 20 sec hold ${token} — rest 45 sec`;
      }
      const cat = category.toUpperCase();
      if (cat.includes("HYPERTROPHY")) {
        // Bodyweight hypertrophy cannot add load, so the set itself must reach
        // close to technical failure — that is where the tension comes from.
        return programBodyweightToFailure(category) && isBodyweightExercise(ex)
          ? `• 4 sets × max reps ${token} — stop 1 rep short of technical failure (aim 12–20), tempo 3-1-1, rest 75 sec`
          : `• 4 sets × 10 reps ${token} — tempo 3-1-1, rest 75 sec`;
      }

      if (cat.includes("FUNCTIONAL STRENGTH")) return `• 4 sets × 6 reps ${token} — rest 120 sec`;
      if (cat.includes("LOW BACK")) return `• 3 sets × 10 reps ${token} — pain-free range, rest 60 sec`;
      if (cat.includes("MOBILITY")) return `• 2 sets × 10 reps ${token} — full controlled range, rest 45 sec`;
      return `• 3 sets × 10 reps ${token} — rest 60 sec`;
  }
}

function protocolFinisherPrescription(style: ProtocolStyle, ex: LibExercise, category: string): string {
  const token = `{{exercise:${ex.id}:${ex.name}}}`;
  const isHold = isStaticHoldExercise(ex);
  switch (style) {
    case "AMRAP":
      return isHold ? `• 20 sec ${token}` : `• 10 reps ${token}`;
    case "TABATA":
      return isHold ? `• 8 rounds × 20 sec hold ${token} / 10 sec rest` : `• 8 rounds × 20 sec ${token} / 10 sec rest`;
    case "FOR TIME":
      return isHold ? `• 45 sec accumulated hold ${token}` : `• 20 reps ${token}`;
    case "HOLDS":
      return `• 2 × 30 sec ${token}`;
    case "REPS & SETS":
    default:
      return isHold ? `• 3 × 20 sec hold ${token} — rest 30 sec` : `• 3 × 12 reps ${token} — rest 45 sec`;
  }
}

/**
 * Pick `n` exercises from `library` that best match `dayTitle`.
 * Deterministic seed: uses (week, day) indices to vary picks across weeks while
 * preserving day focus. Falls back to general selection if focus produces too few.
 */
export function pickExercisesForDay(
  library: LibExercise[],
  dayTitle: string,
  weekIndex: number,
  dayIndex: number,
  n: number,
  category = "",
  difficulty?: string | null,
): LibExercise[] {
  if (!library.length) return [];
  const categoryPool = categorySelectionPool(
    library,
    category,
    category.toUpperCase().includes("WEIGHT LOSS") ? 24 : n,
    difficulty,
  );
  const matched = categoryPool.filter((ex) => matchesFocus(ex, dayTitle));
  const fallbackPool = categoryPool.length ? categoryPool : library.filter((ex) => excludesSkillExercises(ex, difficulty));
  const pool = matched.length > 0 ? matched : fallbackPool;
  // Deterministic rotation so weeks vary but stay stable for the same input
  const seed = (weekIndex * 31 + dayIndex * 7) % Math.max(pool.length, 1);
  const rotated = Array.from({ length: pool.length }, (_, i) => pool[(seed + i) % pool.length]);
  // Coach priority: reference-list matches first (simplest variation of each
  // movement first), then everything else, then never-promoted equipment.
  const tier = (ex: LibExercise) => selectionTier(ex.name || "", category);
  const candidates = [0, 1, 2, 3].flatMap((t) => rotated.filter((ex) => tier(ex) === t));
  const picks: LibExercise[] = [];
  const usedIds = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const ex of candidates) {
    if (picks.length >= n) break;
    const family = exerciseFamily(ex.name || "", ex.body_part, ex.target);
    if (usedIds.has(ex.id)) continue;
    if (usedFamilies.has(family) && picks.length < Math.min(n, 4)) continue;
    usedIds.add(ex.id);
    usedFamilies.add(family);
    picks.push(ex);
  }
  for (const ex of candidates) {
    if (picks.length >= n) break;
    if (usedIds.has(ex.id)) continue;
    usedIds.add(ex.id);
    picks.push(ex);
  }
  return picks;
}

function sessionWarmUp(category: string, dayTitle: string): string[] {
  const cat = category.toUpperCase();
  if (cat.includes("MOBILITY") || cat.includes("LOW BACK")) {
    return ["• 3 minutes easy breathing and spinal decompression", "• 4–5 minutes gentle joint circles and pain-free range-of-motion rehearsal"];
  }
  if (cat.includes("WEIGHT LOSS") || dayTitle.toLowerCase().includes("metabolic")) {
    return ["• 3 minutes easy pulse-raiser", "• 3–5 minutes dynamic mobility for hips, shoulders, ankles, and trunk"];
  }
  return ["• 3–4 minutes easy cardio", "• 4–6 minutes dynamic mobility and ramp-up sets for the first two movements"];
}

function sessionFinisher(category: string, dayTitle: string): string {
  const cat = category.toUpperCase();
  const title = dayTitle.toLowerCase();
  if (cat.includes("MOBILITY") || cat.includes("LOW BACK")) return "• 4–6 minutes controlled breathing, unloaded carries, or gentle anti-rotation practice";
  if (cat.includes("HYPERTROPHY")) return "• 2 rounds of the final two movements with lighter load, controlled tempo, and 45 sec rest";
  if (cat.includes("FUNCTIONAL STRENGTH")) return "• 6 minutes density work using the safest loaded carry or full-body pattern from the main block";
  if (cat.includes("CARDIO") || cat.includes("WEIGHT LOSS") || title.includes("conditioning")) return "• 6–8 minutes steady finisher: repeat the final 3 movements at sustainable pace, rest only as needed";
  return "• 5 minutes easy density work using movements already listed above";
}

function sessionDuration(category: string): string {
  // legacy — replaced by sessionDurationFor(difficulty)
  return sessionDurationFor("Intermediate");
}

export type DifficultyTier = "Beginner" | "Intermediate" | "Advanced";

function tierOf(difficulty?: string | null): DifficultyTier {
  const d = (difficulty || "").toLowerCase();
  if (d.startsWith("adv")) return "Advanced";
  if (d.startsWith("beg")) return "Beginner";
  return "Intermediate";
}

function sessionDurationFor(difficulty: DifficultyTier): string {
  if (difficulty === "Beginner") return "40–50 minutes";
  if (difficulty === "Advanced") return "70–80 minutes";
  return "55–65 minutes";
}

function exerciseCountsFor(difficulty: DifficultyTier): { main: number; finisher: number } {
  if (difficulty === "Beginner") return { main: 5, finisher: 1 };
  if (difficulty === "Advanced") return { main: 9, finisher: 2 };
  return { main: 7, finisher: 2 };
}

function softTissueLines(category: string): string[] {
  const cat = category.toUpperCase();
  if (cat.includes("LOW BACK") || cat.includes("MOBILITY")) {
    return [
      "• 90 sec diaphragmatic breathing — supine, knees bent, hands on belly",
      "• 2–3 min gentle self-massage / foam roll on glutes, lats, and thoracic spine — pain-free pressure only",
    ];
  }
  return [
    "• 1–2 min foam roll quads, glutes, lats, and t-spine — 5–8 slow passes per area",
    "• 1 min lacrosse-ball or self-massage on tight spots feeding today's main movements",
  ];
}

function activationLines(category: string, dayTitle: string): string[] {
  const cat = category.toUpperCase();
  const title = dayTitle.toLowerCase();
  if (cat.includes("LOW BACK")) {
    return [
      "• Cat-Cow × 8 slow reps",
      "• Dead Bug × 6/side, breathing into the brace",
      "• Glute Bridge × 10, 2-sec squeeze at the top",
    ];
  }
  if (cat.includes("MOBILITY")) {
    return [
      "• World's Greatest Stretch × 4/side",
      "• 90/90 hip switches × 6/side",
      "• Thoracic open-book × 6/side",
    ];
  }
  if (cat.includes("CARDIO") || title.includes("interval") || title.includes("conditioning") || cat.includes("WEIGHT LOSS")) {
    return [
      "• 3 min easy pulse-raiser (jog, bike, jump rope)",
      "• Leg swings × 10/side, arm circles × 10/direction, A-skips × 20 m",
      "• Two warm-up rounds at 50% effort of the first main-block movement",
    ];
  }
  if (cat.includes("HYPERTROPHY") || cat.includes("FUNCTIONAL STRENGTH")) {
    return [
      "• 3 min easy cardio (row, bike, or rope skips)",
      "• Dynamic mobility: hip openers, t-spine rotations, scapular CARs × 8/side",
      "• 2 ramp-up sets of the first main lift at 40% and 60% of working load",
    ];
  }
  return [
    "• 3 min easy cardio",
    "• Dynamic mobility flow for hips, shoulders, ankles, t-spine — 5 min",
  ];
}

function coolDownLines(category: string): string[] {
  const cat = category.toUpperCase();
  if (cat.includes("LOW BACK") || cat.includes("MOBILITY")) {
    return [
      "• Child's pose × 60 sec — deep nasal breathing",
      "• Supine figure-4 stretch × 45 sec/side",
      "• Box breathing 4-4-4-4 × 6 cycles to down-regulate",
    ];
  }
  return [
    "• 3 min easy walk or bike — gradually drop heart rate",
    "• Static stretches for the muscles trained today: 30 sec hold × 2 per area",
    "• 6 cycles of 4-sec inhale / 6-sec exhale to finish",
  ];
}

function coachingNote(category: string, dayTitle: string, weekIndex: number, totalWeeks: number, difficulty: DifficultyTier): string {
  const cat = category.toUpperCase();
  const phase = weekIndex === 1 ? "Foundation week"
    : weekIndex >= Math.ceil(totalWeeks * 0.85) ? "Peak week"
    : weekIndex === Math.ceil(totalWeeks / 2) ? "Mid-program checkpoint"
    : "Progressive overload week";

  const focus = (() => {
    if (cat.includes("LOW BACK")) return "Keep every rep pain-free. If anything pinches, reduce range before reducing load.";
    if (cat.includes("MOBILITY")) return "Move slowly through full pain-free range. Quality of control beats depth.";
    if (cat.includes("HYPERTROPHY")) return "Leave 1–2 reps in reserve on the working sets. Control the eccentric (lowering) phase deliberately.";
    if (cat.includes("FUNCTIONAL STRENGTH")) return "Move heavy loads with technical precision. Stop the set the moment form breaks down.";
    if (cat.includes("CARDIO")) return "Hold the prescribed pace — don't sprint the early rounds and crash later.";
    if (cat.includes("WEIGHT LOSS")) return "Move continuously, breathe steadily. The goal is sustained density, not maximum intensity.";
    return "Focus on movement quality, breathing, and consistency. Stop sets if technique deteriorates.";
  })();

  const avoid = difficulty === "Beginner"
    ? "Avoid going to failure today. If you can't speak a short sentence between sets, reduce load or extend rest."
    : difficulty === "Advanced"
      ? "Manage fatigue across the session — don't burn out on movement #2 and limp through the rest."
      : "Build, don't max. Today is one piece of a multi-week plan.";

  return `<em>${phase} — ${dayTitle}. ${focus} ${avoid}</em>`;
}

/** Marker used by the compliance audit to prove a cardio day carries real locomotion. */
export const LOCOMOTION_HEADER = "🏃 Locomotion";

function locomotionModality(equipmentIds: string[]): string {
  if (equipmentIds.includes("cardio") || equipmentIds.includes("fullgym")) {
    return "outdoors, on a treadmill, bike, rower, or elliptical — keep the same effort whichever you choose";
  }
  return "outdoors on flat ground or a track — walk the recovery portions whenever pace drops";
}

/**
 * Real endurance content. A cardio program is not a list of calisthenics: every
 * day carries timed or distance locomotion — continuous runs, walk-run
 * intervals, tempo efforts, or shuttle runs — with the machine equivalent when
 * the athlete has one.
 */
function locomotionLines(
  category: string,
  dayTitle: string,
  weekIndex: number,
  dayIndex: number,
  difficulty: DifficultyTier,
  equipmentIds: string[],
): string[] {
  const mode = programLocomotionMode(category);
  if (mode === "none") return [];
  if (mode === "optional" && (weekIndex + dayIndex) % 2 === 0) return [];

  const where = locomotionModality(equipmentIds);
  const scale = difficulty === "Beginner" ? 0 : difficulty === "Advanced" ? 2 : 1;
  const title = dayTitle.toLowerCase();

  const plan = (() => {
    if (mode === "optional") {
      const minutes = [8, 10, 12][scale];
      return [
        `• ${minutes} min easy continuous locomotion — walk-jog ${where}. Conversational pace only.`,
      ];
    }
    if (title.includes("interval")) {
      const reps = [5, 6, 8][scale];
      return [
        `• ${reps} × 400 m at a strong-but-repeatable pace — 90 sec easy walk-jog recovery between reps, ${where}.`,
        `• Hold every rep within 5 sec of the first. If you slow more than that, stop the last rep.`,
      ];
    }
    if (title.includes("tempo")) {
      const minutes = [12, 16, 20][scale];
      return [
        `• ${minutes} min continuous tempo effort — comfortably hard, 3–4 word answers only, ${where}.`,
        `• 5 min easy jog or brisk walk to close the block.`,
      ];
    }
    if (title.includes("long")) {
      const minutes = [25, 35, 45][scale];
      return [
        `• ${minutes} min continuous easy-pace locomotion — Zone 2, full sentences possible throughout, ${where}.`,
      ];
    }
    if (title.includes("recovery")) {
      const minutes = [15, 20, 25][scale];
      return [
        `• ${minutes} min very easy recovery locomotion — nasal breathing only, ${where}.`,
      ];
    }
    if (title.includes("mixed") || title.includes("modal") || title.includes("conditioning")) {
      const rounds = [6, 8, 10][scale];
      return [
        `• ${rounds} × 20 m shuttle runs — turn on both feet, 40 sec easy walk between shuttles, ${where}.`,
        `• 5 min steady jog to finish the block at a controlled pace.`,
      ];
    }
    const minutes = [15, 20, 25][scale];
    return [
      `• ${minutes} min continuous aerobic base run or walk-run — even pacing, ${where}.`,
      `• Every 5 min, check that you can still speak a full sentence; slow down if you cannot.`,
    ];
  })();

  const window = mode === "optional" ? "8–12 minutes" : difficulty === "Advanced" ? "25–45 minutes" : "15–30 minutes";
  return [`<strong>${LOCOMOTION_HEADER} — ${window}</strong>`, ...plan];
}

/** Marker used by the compliance audit for recovery-character categories. */
export const DOWN_REGULATION_HEADER = "🌬 Recovery & Down-Regulation";

function downRegulationLines(category: string): string[] {
  if (!programHasRecoveryCharacter(category)) return [];
  return [
    `<strong>${DOWN_REGULATION_HEADER} — 3–4 minutes</strong>`,
    "• Supine 90/90 breathing × 8 slow cycles — 4-sec inhale, 6-sec exhale, ribs down",
    "• Constructive rest position × 2 min — let the low back settle, no stretching, no effort",
  ];
}

/**
 * Build the bullet lines for one training day, including `{{exercise:ID:Name}}`
 * tokens (eye icon) and a default sets×reps prescription.
 */
export function buildDayBullets(
  library: LibExercise[],
  category: string,
  dayTitle: string,
  weekIndex: number,
  dayIndex: number,
  count = 5,
  difficulty?: string | null,
  totalWeeks: number = 8,
  equipmentIds: string[] = [],
): string[] {

  const tier = tierOf(difficulty);
  const counts = exerciseCountsFor(tier);
  const totalNeeded = counts.main + counts.finisher;
  const selectionPool = categorySelectionPool(library, category, totalNeeded, difficulty);
  const picks = pickExercisesForDay(selectionPool, dayTitle, weekIndex, dayIndex, totalNeeded, category, difficulty);
  const mainPicks = picks.slice(0, counts.main);
  const finisherPicks = picks.slice(counts.main, counts.main + counts.finisher);
  if (mainPicks.length < 4) {
    mainPicks.push(...finisherPicks.splice(0, 4 - mainPicks.length));
  }
  if (mainPicks.length < 4 && mainPicks.length) {
    const originals = [...mainPicks];
    while (mainPicks.length < 4) mainPicks.push(originals[mainPicks.length % originals.length]);
  }

  const mainTimeWindow = tier === "Beginner" ? "22–28 minutes" : tier === "Advanced" ? "40–50 minutes" : "30–38 minutes";

  // Category-driven workout protocol (AMRAP / CIRCUIT / TABATA / EMOM / SETS & REPS / HOLDS)
  // chosen exactly like our standalone workouts. Prescription always BEFORE the token.
  const proto = categoryProtocol(category, weekIndex);

  const mainBullets = mainPicks.length
    ? mainPicks.map((ex, i) => protocolMainPrescription(proto.main, ex, i + 1, category, dayTitle))
    : Array.from({ length: counts.main }, (_, i) => `• Exercise ${i + 1} — sets × reps, rest period`);

  // A Finisher is a work section: it must always carry real, linked exercises.
  // When the pool ran dry, recycle the safest movements already used in the
  // Main Workout rather than printing prose with no exercises.
  const finisherSource = finisherPicks.length
    ? finisherPicks
    : mainPicks.slice(-Math.max(1, Math.min(counts.finisher || 2, mainPicks.length)));
  const finisherBullets = finisherSource.length
    ? finisherSource.map((ex) => protocolFinisherPrescription(proto.finisher, ex, category))
    : [sessionFinisher(category, dayTitle)];


  const finisherLines = programAllowsFinisher(category)
    ? [
        `<strong>💥 Finisher (${proto.finisher}) — 4–5 minutes</strong>`,
        `<em>${proto.finisherIntro}</em>`,
        ...finisherBullets,
      ]
    : [];

  return [
    coachingNote(category, dayTitle, weekIndex, totalWeeks, tier),
    `<strong>Estimated session time: ${sessionDurationFor(tier)}</strong>`,
    "<strong>🔥 Soft Tissue Preparation — 3–5 minutes</strong>",
    ...softTissueLines(category),
    "<strong>⚡ Activation / Warm-Up — 6–8 minutes</strong>",
    ...activationLines(category, dayTitle),
    `<strong>🏋 Main Workout (${proto.main}) — ${mainTimeWindow}</strong>`,
    `<em>${proto.mainIntro}</em>`,
    ...locomotionLines(category, dayTitle, weekIndex, dayIndex, tier, equipmentIds),
    ...mainBullets,
    ...finisherLines,
    ...downRegulationLines(category),
    "<strong>🧘 Cool Down — 5 minutes</strong>",
    ...coolDownLines(category),
  ];

}

/**
 * Filter the full library down to the exercises permitted for a program.
 * Order is strict and non-negotiable:
 * 1. Equipment mode: bodyweight means bodyweight-only; equipment means equipment-only.
 * 2. Difficulty: exact difficulty only. No silent fallback to easier/harder tiers.
 * 3. Day focus is applied later in pickExercisesForDay without falling back to unrelated muscles.
 */
export function filterLibraryForProgram(
  library: LibExercise[],
  equipment: string,
  difficulty?: string,
  category = "",
  equipmentIds: string[] = [],
): LibExercise[] {
  const equipLower = (equipment || "").toLowerCase();
  let pool = library;
  if (equipLower.includes("bodyweight") || equipLower === "body weight" || equipLower === "none - running shoes only") {
    pool = pool.filter(isHomeBodyweightFriendly);
  } else {
    // Equipment is a ceiling, never a requirement: bodyweight always remains
    // legal alongside the apparatus selected by the coach.
    // When the admin named the exact apparatus, only those are legal — same
    // rule the single-workout engine uses, so the two can never disagree.
    if (equipmentIds.length && !equipmentIds.includes("fullgym")) {
      pool = pool.filter((ex) =>
        isBodyweightExercise(ex) || matchesSelectedEquipment(ex as unknown as Parameters<typeof matchesSelectedEquipment>[0], equipmentIds),
      );
    }
  }
  pool = pool.filter(excludesStaticHolds);
  pool = pool.filter((ex) => excludesSkillExercises(ex, difficulty));
  const hasCategoryRule = !!ruleForCategory(category);
  const categoryPool = categorySelectionPool(
    pool,
    category,
    category.toUpperCase().includes("WEIGHT LOSS") ? 24 : 1,
    difficulty,
  );
  const intentPool = categoryPool.length ? categoryPool : pool;
  if (!difficulty) return intentPool;

  const targetDiff = difficulty.toLowerCase();
  const exactDifficultyPool = intentPool.filter((ex) => (ex.difficulty || "").toLowerCase() === targetDiff);
  if (!hasCategoryRule) return exactDifficultyPool;
  // Category intent is safer than forcing an exact DB difficulty label. If the
  // exact-level pool is too small, use same-category movements from easier
  // tiers and progress them with volume, density, load, or control.
  return exactDifficultyPool.length >= 24 ? exactDifficultyPool : intentPool;
}