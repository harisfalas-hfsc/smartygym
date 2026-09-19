// ---------------------------------------------------------------------------
// SMARTY WORKOUT — HARD PROGRAMMING DOCTRINE
//
// Deterministic legality rules shared by the pool filter, the blueprint, the
// enforcement pass and the validator. Nothing here is advisory: every function
// returns a concrete violation string that becomes a hard error upstream.
// The AI is never the final authority — this module is.
// ---------------------------------------------------------------------------

import type { Category, Format, StrengthFocus } from "./spec.ts";

export type ExerciseLike = {
  id?: string;
  name: string;
  equipment: string | null;
  body_part?: string | null;
  target_muscle?: string | null;
  description?: string | null;
  instructions?: string[] | null;
};

const textOf = (e: ExerciseLike) =>
  `${e.name} ${e.target_muscle ?? ""} ${e.body_part ?? ""} ${e.equipment ?? ""} ${e.description ?? ""} ${(e.instructions ?? []).join(" ")}`.toLowerCase();


// --- 2. Category doctrine ---------------------------------------------------

/** Quality / controlled categories — REPS & SETS only. */
export const QUALITY_CATEGORIES: Category[] = [
  "STRENGTH",
  "MUSCLE BUILDING",
  "PILATES",
  "MOBILITY & STABILITY",
];

/** Dynamic / conditioning categories. */
export const DYNAMIC_CATEGORIES: Category[] = [
  "CALORIE BURNING",
  "CARDIO",
  "METABOLIC",
  "CHALLENGE",
];

/**
 * The five clock-driven formats. The machine / rack / bench / high-skill
 * restriction is a property of THESE FORMATS, never of a category: a REPS &
 * SETS session always keeps full gym access, whatever the category.
 */
export const DYNAMIC_FORMATS: Format[] = ["TABATA", "CIRCUIT", "AMRAP", "EMOM", "FOR TIME"];

export function isDynamicFormat(format: Format): boolean {
  return DYNAMIC_FORMATS.includes(format);
}

/** Alias — clock-driven == the five conditioning formats. */
export const isClockFormat = isDynamicFormat;

export function isDynamicCategory(category: Category): boolean {
  return DYNAMIC_CATEGORIES.includes(category);
}

/** Categories locked to REPS & SETS by doctrine. */
export function isRepsAndSetsOnly(category: Category): boolean {
  return (
    category === "STRENGTH" ||
    category === "MUSCLE BUILDING" ||
    category === "PILATES" ||
    category === "MOBILITY & STABILITY" ||
    category === "MICRO-WORKOUTS"
  );
}


/** Pilates, Mobility & Stability, Recovery and Micro Workouts never carry a Finisher. */
export function categoryAllowsFinisher(category: Category): boolean {
  return (
    category !== "PILATES" &&
    category !== "MOBILITY & STABILITY" &&
    category !== "RECOVERY" &&
    category !== "MICRO-WORKOUTS"
  );
}

/**
 * §4 — the authoritative legal-format table. Nothing else in the engine may
 * decide which formats a category can wear. Controlled categories are REPS &
 * SETS only; dynamic categories carry the conditioning formats; Micro Workout
 * is a movement break, never a shortened conditioning session.
 */
export const LEGAL_FORMATS: Record<Category, Format[]> = {
  STRENGTH: ["REPS & SETS"],
  "MUSCLE BUILDING": ["REPS & SETS"],
  PILATES: ["REPS & SETS"],
  "MOBILITY & STABILITY": ["REPS & SETS"],
  RECOVERY: ["MIX"],
  "MICRO-WORKOUTS": ["REPS & SETS"],

  CARDIO: ["CIRCUIT", "EMOM", "FOR TIME", "AMRAP", "TABATA"],
  METABOLIC: ["CIRCUIT", "AMRAP", "EMOM", "FOR TIME", "TABATA"],
  "CALORIE BURNING": ["CIRCUIT", "TABATA", "AMRAP", "FOR TIME", "EMOM"],
  CHALLENGE: ["CIRCUIT", "TABATA", "AMRAP", "EMOM", "FOR TIME", "MIX"],
};

export function legalFormats(category: Category): Format[] {
  return LEGAL_FORMATS[category];
}

/** STRENGTH + EMOM, PILATES + AMRAP, MUSCLE BUILDING + TABATA … are invalid. */
export function categoryFormatViolation(category: Category, format: Format): string | null {
  if (isRepsAndSetsOnly(category) && format !== "REPS & SETS")
    return `${category} must be programmed as REPS & SETS — ${format} is not a legal format for this category.`;
  if (!LEGAL_FORMATS[category].includes(format))
    return `${format} is not a legal format for ${category}.`;
  return null;
}

// --- 3 / 7 / 8 / 14. Category vocabulary doctrine ---------------------------
// One definition of what each category may never contain. The pool filter, the
// enforcement pass and the validator all read these — no parallel regex lists.

/** Stretching / mobility / yoga vocabulary — banned in CHALLENGE main work. */
export const STRETCH_RE =
  /\b(stretch|stretching|cat-?cow|cobra|sphinx|upward facing dog|downward dog|child'?s pose|pigeon|butterfly|world'?s greatest|skin the cat|inchworm|yoga|mobility|foam roll|myofascial|release)\b/i;

/** Apparatus that does not exist in a home / bodyweight setting. */
export const HOME_APPARATUS_RE =
  /\b(bar|barbell|cage|rack|machine|ring|rings|sled|parallel bars|pull-?up bar|dip bar|gymnastic|lever|smith|cable|bench press|captain'?s chair|roman chair|treadmill|elliptical|ergometer|stationary bike|skierg|stepmill|rope climb)\b/i;

/** Static holds break momentum categories. */
export const STATIC_HOLD_RE =
  /\b(hold|plank|isometric|wall sit|hollow|l-?sit|bridge hold|static)\b/i;

const PILATES_BAN_RE =
  /\b(kettlebell|barbell|machine|cable|smith|sled|jump|jumping|plyo|burpee|sprint|box jump|snatch|clean|jerk|thruster)\b/i;

/** §8 — Mobility & Stability is light: no heavy loading, no conditioning. */
const MOBILITY_BAN_RE =
  /\b(jump|jumping|plyo|burpee|sprint|snatch|clean|jerk|thruster|push-?up|pushup|crunch|sit-?up|leg raise|kettlebell|barbell|smith|leverage|sled|machine|cable|box jump|deadlift|bench press|squat rack|heavy)\b/i;

/**
 * §3 — RECOVERY is controlled recovery work: breathing, gentle mobility,
 * controlled movement, light stretching, relaxation and movement quality.
 * It may never turn into strength, conditioning, HIIT or metabolic work.
 */
const RECOVERY_BAN_RE =
  /\b(jump|jumping|plyo|burpee|sprint|snatch|clean|jerk|thruster|crunch|sit-?up|deadlift|bench press|heavy|barbell|kettlebell|machine|cable|smith|leverage|sled|swing|box jump|mountain climber|high knee|skater|battle rope|jump rope|rower|row erg|skierg|assault bike|air bike|treadmill|push-?up|pushup|pull-?up|chin-?up|dip|squat jump|run|carry)\b/i;

const MICRO_BAN_RE =
  /\b(dumbbell|kettlebell|barbell|band|machine|bike|rower|rope|treadmill|sled|cable|smith|ez|olympic|medicine ball|bosu|stability ball|pull-?up|chin-?up|hang(ing)?|dip bar|parallette|bench press|box jump|doorway|door frame)\b/i;

/**
 * Calorie Burning is continuous conditioning, not strength exercises performed
 * quickly. Every work movement must be simple, repeatable and keep the athlete
 * moving without lying on a bench, hanging from a bar or setting up a station.
 */
const CALORIE_BURNING_MOVEMENT_RE =
  /\b(run|jog|walk|march|bike|cycle|row|ski ?erg|elliptical|stepper|stair|jump rope|skip|shuttle|sprint|battle rope|burpee|jumping jack|high knee|skater|mountain climber|bear crawl|crab walk|squat|lunge|step-?up|carry|swing|thruster|slam|wall ball|push-?up|plank jack|toe tap)\b/i;
const CALORIE_BURNING_SETUP_RE =
  /\b(lie|lying|lay|flat on (?:a |the )?bench|on (?:a |the )?bench|hang from|hanging|pull-?up bar|dip station|parallel bars|preacher|chest-supported|incline bench|decline bench)\b/i;
const CALORIE_BURNING_ISOLATION_RE =
  /\b(curl|extension|lateral raise|front raise|fly|pullover|pull-over|shrug|kickback|skull crusher|triceps|biceps|calf raise|wrist|neck)\b/i;

/**
 * Category-level legality for a single exercise, independent of format.
 * Returns a concrete violation string, never a soft preference.
 */
export function categoryExerciseViolation(e: ExerciseLike, category: Category): string | null {
  const t = textOf(e);
  if (category === "CHALLENGE" && STRETCH_RE.test(t))
    return `"${e.name}" is stretching or mobility work, which is not Challenge main work.`;
  if (category === "PILATES" && PILATES_BAN_RE.test(t))
    return `"${e.name}" is loaded or conditioning work, which Pilates never uses.`;
  if (category === "MOBILITY & STABILITY" && MOBILITY_BAN_RE.test(t))
    return `"${e.name}" is heavy or conditioning work, which Mobility & Stability never uses.`;
  if (category === "RECOVERY" && RECOVERY_BAN_RE.test(t))
    return `"${e.name}" is too intense for a Recovery session.`;
  if (category === "MICRO-WORKOUTS" && (MICRO_BAN_RE.test(t) || HOME_APPARATUS_RE.test(t)))
    return `"${e.name}" needs equipment or a special setup, which a Micro Workout never uses.`;
  if (category === "CALORIE BURNING") {
    if (CALORIE_BURNING_SETUP_RE.test(t))
      return `"${e.name}" requires a bench, hanging position or setup change, which breaks continuous movement in Calorie Burning.`;
    if (CALORIE_BURNING_ISOLATION_RE.test(t))
      return `"${e.name}" is isolated strength work, not a continuous Calorie Burning movement.`;
    if (!CALORIE_BURNING_MOVEMENT_RE.test(t))
      return `"${e.name}" is not a simple, continuously repeatable Calorie Burning movement.`;
  }
  return null;
}


// --- 11 / 12 / 13. Dynamic-format equipment legality ------------------------

/** Genuine cardio equipment: aerobic, continuous, zero setup once mounted. */
const ERGOMETER_RE =
  /\b(stationary bike|assault bike|air bike|spin bike|bike erg|rower|rowing machine|row erg|skierg|ski erg|ergometer|treadmill|elliptical|stepmill|stair ?climber|jump rope|rope|battle rope)\b/i;

/** Equipment families that require loading, racking, pins, cables or a bench. */
const SETUP_EQUIPMENT_RE =
  /\b(barbell|ez ?barbell|olympic barbell|trap bar|smith machine|cable|leverage machine|selectorized|pec deck|weighted)\b/i;

/** Movement names that are setup-, rack-, bench- or spotter-dependent. */
const SETUP_MOVEMENT_RE =
  /\b(bench press|jm press|jm bench|guillotine|floor press|rack|power rack|squat rack|pin press|back squat|front squat|full squat|hack squat|overhead squat|zercher|good morning|leg press|leg extension|leg curl machine|lying leg curl|seated leg curl|pec deck|lat pulldown|pulldown|crossover|cable fly|cable crossover|machine chest press|machine shoulder press|chest press machine|smith|spotter|clean and press|clean and jerk|power clean|hang clean|muscle snatch|one-?arm snatch|snatch|jerk|preacher curl)\b/i;

/** Machine-strength names that must never be treated as cardio. */
const MACHINE_STRENGTH_RE =
  /\b(leverage|smith|selectorized|pec deck|lat pulldown|leg press|leg extension|leg curl|machine (chest|shoulder|row|press)|cable)\b/i;

/**
 * High-skill gymnastic and single-limb movements. Nobody hits a handstand
 * push-up or a pistol squat under a running clock in a conditioning session —
 * these are skill work, never calorie-burning vocabulary.
 */
export const HIGH_SKILL_RE =
  /\b(handstand|hand stand|pistol|shrimp squat|archer|planche|front lever|back lever|human flag|muscle-?up|nordic|one-?arm|one arm|single-?arm|single arm|one-?legged squat|iron cross|turkish get-?up|get-?up|windmill|bent press)\b/i;

/**
 * HUMAN REALISM (global).
 *
 * "Would a professional coach realistically give this exercise to an ordinary
 * adult client?" Everything below fails that test in EVERY category and EVERY
 * format: circus gymnastics, levers, exceptional-mobility work and technically
 * demanding Olympic lifting. Smarty Coach trains working adults in their 30s,
 * 40s and 50s — familiar, effective, achievable movements only.
 */
export const IMPRACTICAL_MOVEMENT_RE =
  /\b(turkish get-?up|get-?up|handstand|hand stand|headstand|forearm stand|pike push-?up|pistol squat|pistol|shrimp squat|sissy squat|planche|front lever|back lever|human flag|iron cross|dragon flag|skin the cat|muscle-?up|nordic|crow pose|frog stand|typewriter|aztec|clapping push-?up|superman push-?up|hollow back|windmill|bent press|jefferson|zercher|overhead squat|snatch|jerk|power clean|hang clean|squat clean|split clean|clean and press|clean and jerk|kipping|butterfly pull-?up|behind[- ]the[- ]neck|good morning)\b/i;

/**
 * Global legality: an exercise that a real coach would not hand to a normal
 * adult is rejected before anything else looks at it.
 */
export function humanRealismViolation(e: ExerciseLike): string | null {
  if (IMPRACTICAL_MOVEMENT_RE.test(e.name.toLowerCase()))
    return `"${e.name}" is a high-skill, gymnastic or technically demanding movement that a coach would not program for a normal adult client.`;
  return null;
}

/**
 * §18 — the environment decides what is realistic. Outdoors means portable
 * implements only: no machines, no cables, no racks, no barbells, whatever the
 * athlete ticked in their equipment list. "Anywhere" makes the same promise:
 * the athlete asked for a session they can run wherever they happen to be, so
 * it may never depend on a fixed gym station either.
 */
const OUTDOOR_FAMILIES = new Set([
  "bodyweight",
  "dumbbell",
  "kettlebell",
  "band",
  "ball",
  "suspension",
]);

/** Locations that can only host equipment an athlete can carry. */
const PORTABLE_ONLY_LOCATIONS = new Set(["outdoors", "anywhere"]);

/** Apparatus that only exists as a fixed station in a real gym. */
const FIXED_STATION_RE =
  /\b(machine|cable|smith|leverage|rack|power rack|squat rack|pulldown|pec deck|leg press|leg extension|leg curl|treadmill|elliptical|stepmill|ergometer|rowing machine|skierg|stationary bike|sled)\b/i;

export function locationEquipmentViolation(
  e: ExerciseLike,
  location: string | null | undefined,
): string | null {
  const l = (location ?? "").toLowerCase();
  if (!PORTABLE_ONLY_LOCATIONS.has(l)) return null;
  const where = l === "anywhere" ? "an anywhere session" : "an outdoor session";
  const family = equipmentFamilyOf(e.equipment);
  if (FIXED_STATION_RE.test(`${e.equipment ?? ""} ${e.name}`))
    return `"${e.name}" needs a fixed gym station — ${where} uses portable equipment only.`;
  if (OUTDOOR_FAMILIES.has(family)) return null;
  if (/\b(rope|jump rope|sandbag|sled|box|step|bench|bar)\b/.test((e.equipment ?? "").toLowerCase()))
    return `"${e.name}" needs ${e.equipment} — ${where} uses portable equipment only.`;
  return `"${e.name}" needs ${e.equipment ?? "gym apparatus"}, which cannot be assumed in ${where}.`;
}

/** Equipment ids that only exist as a fixed station in a real gym. */
const GYM_ONLY_EQUIPMENT = new Set(["machines", "cables", "barbell", "rack", "bench", "cardio"]);

/**
 * §18 — "Anywhere" promises a session the athlete can run wherever they are, so
 * it is filtered as a portable location. When the athlete explicitly ticked
 * fixed-station equipment they contradicted themselves; equipment outranks the
 * environment preference (injuries > equipment > level > goal > likes >
 * dislikes), so the session is resolved to a gym session instead of shrinking
 * the pool to nothing.
 */
export function resolveLocation(
  location: string | null | undefined,
  selectedEquipment: readonly string[] = [],
): string {
  const l = (location ?? "").toLowerCase() || "anywhere";
  if (l !== "anywhere") return l;
  return selectedEquipment.some((id) => GYM_ONLY_EQUIPMENT.has(String(id).toLowerCase()))
    ? "gym"
    : "anywhere";
}




/** High-output conditioning vocabulary — the athlete is breathing hard after it. */
const HIGH_FATIGUE_RE =
  /\b(burpee|sprint|jump squat|jumping lunge|jump lunge|box jump|thruster|mountain climber|high knee|skater|battle rope|jump rope|assault bike|air bike|rower|row erg|skierg|swing|shuttle|run)\b/i;

/** Movements that need control, balance, precision or a loaded bar. */
const TECHNICAL_AFTER_FATIGUE_RE =
  /\b(handstand|pistol|turkish|get-?up|lever|planche|balance|bosu|stability ball|overhead squat|snatch|jerk|clean|barbell|bench press|deadlift|single-?leg (?:deadlift|balance)|pull-?over)\b/i;

/**
 * Sequencing realism: never send an athlete straight from a high-fatigue
 * conditioning movement into a technical, balance- or precision-dependent one
 * inside a clock-driven format.
 */
export function sequenceViolation(
  exercises: ExerciseLike[],
  format: Format,
): string | null {
  if (!isDynamicFormat(format)) return null;
  for (let i = 1; i < exercises.length; i++) {
    const prev = exercises[i - 1]!.name.toLowerCase();
    const next = exercises[i]!.name.toLowerCase();
    if (HIGH_FATIGUE_RE.test(prev) && TECHNICAL_AFTER_FATIGUE_RE.test(next))
      return `"${exercises[i]!.name}" straight after "${exercises[i - 1]!.name}" is not realistic — a technical movement never follows a high-fatigue one under a clock.`;
  }
  return null;
}

/**
 * Orders a block so the sequence rule above can never be broken: under a clock,
 * technical movements are placed BEFORE high-fatigue ones. Any other order is
 * preserved, so this only moves what has to move.
 */
export function orderForSequence<T extends ExerciseLike>(exercises: T[], format: Format): T[] {
  if (!isDynamicFormat(format)) return exercises;
  const rank = (e: T) => {
    const n = e.name.toLowerCase();
    if (TECHNICAL_AFTER_FATIGUE_RE.test(n)) return 0;
    if (HIGH_FATIGUE_RE.test(n)) return 2;
    return 1;
  };
  return exercises
    .map((e, i) => ({ e, i, r: rank(e) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

/**
 * The clock-driven contract. Whenever the FORMAT is AMRAP, EMOM, CIRCUIT,
 * TABATA or FOR TIME — whatever the category — every movement must start
 * immediately and repeat safely. Machines, racks, benches, cables, spotter- or
 * setup-dependent lifts and high-skill gymnastic / single-limb movements are
 * rejected regardless of the athlete's equipment list. Genuine cardio
 * ergometers stay legal. REPS & SETS is untouched: full gym access, machines
 * included, exactly as a trainer would program it.
 */
export function dynamicExerciseViolation(
  e: ExerciseLike,
  category: Category,
  format: Format,
): string | null {
  if (!isDynamicFormat(format)) return null;
  const equipment = (e.equipment ?? "").toLowerCase();
  const name = e.name.toLowerCase();
  const context = `${e.description ?? ""} ${(e.instructions ?? []).join(" ")}`.toLowerCase();
  const both = `${name} ${equipment} ${context}`;

  if (HIGH_SKILL_RE.test(name))
    return `"${e.name}" is a high-skill or single-limb movement and is never programmed inside a ${format} session.`;

  const isErgo = ERGOMETER_RE.test(both) && !MACHINE_STRENGTH_RE.test(name);
  if (isErgo) return null;

  if (SETUP_EQUIPMENT_RE.test(equipment))
    return `"${e.name}" uses ${e.equipment} — setup-dependent strength equipment is not legal in a ${format} ${category} session.`;
  if (SETUP_MOVEMENT_RE.test(both) || CALORIE_BURNING_SETUP_RE.test(both))
    return `"${e.name}" is a setup-, rack-, bench- or spotter-dependent movement and cannot be repeated inside a ${format}.`;
  if (MACHINE_STRENGTH_RE.test(both))
    return `"${e.name}" is machine strength work, which is not legal in a ${format} ${category} session.`;
  return null;
}



// --- 15. Micro Workout ------------------------------------------------------

const MICRO_EQUIPMENT_RE =
  /\b(dumbbell|kettlebell|barbell|band|machine|cable|smith|leverage|bike|rower|erg|treadmill|sled|rope|medicine ball|slam ball|stability ball|bosu|trx|suspension|plate|bench)\b/i;

export function microExerciseViolation(e: ExerciseLike): string | null {
  const both = `${e.name} ${e.equipment ?? ""}`.toLowerCase();
  if (!both.includes("body weight") && !/\b(chair|desk|table|wall|sofa|floor|bed|stair|stairs|step)\b/.test(both))
    return `"${e.name}" is not an equipment-free movement — Micro Workouts are bodyweight and environment only.`;
  if (MICRO_EQUIPMENT_RE.test(both))
    return `"${e.name}" needs training equipment, which Micro Workouts never use.`;
  return null;
}

// --- 16. Body focus hard filter --------------------------------------------

export type FocusRule = { allow?: RegExp; deny?: RegExp; parts?: string[]; targets?: RegExp };

export const FOCUS_RULES: Record<StrengthFocus, FocusRule> = {
  "LOWER BODY": {
    parts: ["upper legs", "lower legs"],
    deny: /\b(press|push-?up|pushup|row|pull-?up|pulldown|curl|fly|dip|triceps|biceps|shoulder|chest|lat)\b/i,
  },
  "UPPER BODY": {
    parts: ["chest", "back", "shoulders", "upper arms", "lower arms"],
    deny: /\b(squat|lunge|leg press|deadlift|hip thrust|leg curl|leg extension|calf|step-?up|glute bridge)\b/i,
  },
  "FULL BODY": {},
  "LOW PUSH & UPPER PULL": {
    deny: /\b(deadlift|romanian|rdl|leg curl|bench press|shoulder press|push-?up|pushup|triceps|dip)\b/i,
  },
  "LOW PULL & UPPER PUSH": {
    deny: /\b(squat|lunge|leg press|step-?up|row|pull-?up|pulldown|curl|chin-?up)\b/i,
  },
  "CORE & GLUTES": {
    allow:
      /\b(plank|dead bug|pallof|bird dog|hip thrust|glute bridge|kickback|clamshell|anti-rotation|abdominal|core|oblique|glute)\b/i,
  },
  PUSH: {
    parts: ["chest", "shoulders", "upper arms"],
    targets: /\b(pectorals|delts|triceps|serratus)\b/i,
  },
  PULL: {
    parts: ["back", "upper arms", "lower arms"],
    targets: /\b(lats|traps|upper back|biceps|forearms|rhomboids)\b/i,
  },
  CHEST: { parts: ["chest"] },
  BACK: { parts: ["back"] },
  SHOULDERS: { parts: ["shoulders"] },
  ARMS: { parts: ["upper arms", "lower arms"] },
  LEGS: { parts: ["upper legs", "lower legs"] },
};

const focusText = (e: ExerciseLike) =>
  `${e.name} ${e.target_muscle ?? ""} ${e.body_part ?? ""} ${e.equipment ?? ""}`.toLowerCase();

/** Hard focus legality — never widened because a pool ran thin. */
export function focusViolation(e: ExerciseLike, focus: StrengthFocus | null): string | null {
  if (!focus) return null;
  const rule = FOCUS_RULES[focus];
  if (rule.deny && rule.deny.test(focusText(e)))
    return `"${e.name}" is outside the requested ${focus} focus.`;
  if (rule.parts?.length) {
    const part = (e.body_part ?? "").toLowerCase().trim();
    const targetOk = rule.targets ? rule.targets.test(e.target_muscle ?? "") : false;
    if (part && !rule.parts.includes(part) && !targetOk)
      return `"${e.name}" trains ${part}, which is outside the requested ${focus} focus.`;
  }
  if (rule.allow && !rule.allow.test(focusText(e)))
    return `"${e.name}" does not belong to the requested ${focus} focus.`;
  return null;
}

// --- 14. Activation relevance ----------------------------------------------

export type BodyRegion = "lower" | "upper" | "core" | "full";

const LOWER_PARTS = new Set(["upper legs", "lower legs"]);
const UPPER_PARTS = new Set(["chest", "back", "shoulders", "upper arms", "lower arms"]);
const CORE_PARTS = new Set(["waist"]);

export function regionOf(e: ExerciseLike): BodyRegion {
  const part = (e.body_part ?? "").toLowerCase().trim();
  if (LOWER_PARTS.has(part)) return "lower";
  if (UPPER_PARTS.has(part)) return "upper";
  if (CORE_PARTS.has(part)) return "core";
  const name = e.name.toLowerCase();
  if (/\b(squat|lunge|hinge|deadlift|calf|glute|hip|step-?up|leg)\b/.test(name)) return "lower";
  if (/\b(press|row|pull|curl|fly|dip|shoulder|chest|lat)\b/.test(name)) return "upper";
  return "full";
}

/** The region a focus asks activation to prepare. */
export function focusRegion(focus: StrengthFocus | null | undefined): BodyRegion {
  switch (focus) {
    case "LOWER BODY":
    case "LEGS":
      return "lower";
    case "UPPER BODY":
    case "PUSH":
    case "PULL":
    case "CHEST":
    case "BACK":
    case "SHOULDERS":
    case "ARMS":
      return "upper";
    case "CORE & GLUTES":
      return "core";
    default:
      return "full";
  }
}

/** The dominant region actually trained by a list of main-workout exercises. */
export function dominantRegion(main: ExerciseLike[]): BodyRegion {
  const counts: Record<BodyRegion, number> = { lower: 0, upper: 0, core: 0, full: 0 };
  for (const e of main) counts[regionOf(e)] += 1;
  const total = main.length;
  if (!total) return "full";
  const ranked = (Object.keys(counts) as BodyRegion[]).sort((a, b) => counts[b] - counts[a]);
  const top = ranked[0]!;
  if (counts[top] / total < 0.5) return "full";
  return top;
}

/** Movement pattern of an exercise, used to check activation specificity. */
export type MovementPattern = "push" | "pull" | "squat" | "hinge" | "core" | "other";

export function patternOf(e: ExerciseLike): MovementPattern {
  const n = e.name.toLowerCase();
  if (/\b(row|pull-?up|pull-?down|chin-?up|face pull|pull ?over|curl|shrug|reverse fly|rear delt)\b/.test(n))
    return "pull";
  if (/\b(press|push-?up|dip|fly|push press|overhead|bench)\b/.test(n)) return "push";
  if (/\b(squat|lunge|step-?up|leg press|split squat|leg extension)\b/.test(n)) return "squat";
  if (/\b(deadlift|hinge|good morning|swing|hip thrust|glute bridge|romanian|leg curl|hamstring)\b/.test(n))
    return "hinge";
  if (/\b(plank|crunch|sit-?up|dead bug|bird dog|hollow|rotation|twist|carry|pallof)\b/.test(n))
    return "core";
  return "other";
}

/** Preparation patterns that legitimately serve a given main-block pattern. */
const PATTERN_PREP: Record<MovementPattern, MovementPattern[]> = {
  push: ["push", "core", "other"],
  pull: ["pull", "core", "other"],
  squat: ["squat", "hinge", "core", "other"],
  hinge: ["hinge", "squat", "core", "other"],
  core: ["core", "other"],
  other: ["push", "pull", "squat", "hinge", "core", "other"],
};

/** The pattern a main block is built around, when one clearly dominates. */
export function dominantPattern(main: ExerciseLike[]): MovementPattern {
  const counts: Record<MovementPattern, number> = {
    push: 0,
    pull: 0,
    squat: 0,
    hinge: 0,
    core: 0,
    other: 0,
  };
  for (const e of main) counts[patternOf(e)] += 1;
  const ranked = (Object.keys(counts) as MovementPattern[])
    .filter((p) => p !== "other")
    .sort((a, b) => counts[b] - counts[a]);
  const top = ranked[0]!;
  if (!main.length || counts[top] / main.length < 0.6) return "other";
  return top;
}

/**
 * §21 — activation must prepare the demand of the Main Workout, in BOTH the
 * body region and the movement pattern. Band pull-aparts before a pressing day
 * hit the right region but the wrong demand, so region alone is not enough.
 */
export function activationRelevanceViolation(
  activation: ExerciseLike[],
  main: ExerciseLike[],
): string | null {
  if (activation.length < 2 || main.length < 2) return null;
  const target = dominantRegion(main);
  if (target !== "full") {
    const relevant = activation.filter((e) => {
      const r = regionOf(e);
      return (
        r === target ||
        r === "full" ||
        (target === "lower" && r === "core") ||
        (target === "core" && r === "lower")
      );
    }).length;
    if (relevant / activation.length < 0.5)
      return `Activation prepares the wrong region: the Main Workout is ${target}-body dominant but most activation drills are not.`;
  }

  const pattern = dominantPattern(main);
  if (pattern === "other") return null;
  const allowed = PATTERN_PREP[pattern];
  const onPattern = activation.filter((e) => allowed.includes(patternOf(e))).length;
  if (onPattern / activation.length < 0.5)
    return `Activation prepares the wrong demand: the Main Workout is a ${pattern}-dominant block but most activation drills do not prepare that pattern.`;
  return null;
}


// --- 12. Equipment family doctrine ------------------------------------------

/** Canonical equipment family for the transition / family rules. */
export function equipmentFamilyOf(equipment: string | null | undefined): string {
  const e = (equipment ?? "").toLowerCase();
  if (!e || e.includes("body weight")) return "bodyweight";
  if (e.includes("dumbbell")) return "dumbbell";
  if (e.includes("kettlebell")) return "kettlebell";
  if (e.includes("barbell") || e.includes("trap bar") || e.includes("olympic")) return "barbell";
  if (e.includes("band")) return "band";
  if (e.includes("cable")) return "cable";
  if (e.includes("machine") || e.includes("leverage") || e.includes("smith")) return "machine";
  if (e.includes("bike") || e.includes("erg") || e.includes("rower") || e.includes("ski"))
    return "ergometer";
  if (e.includes("ball")) return "ball";
  if (e.includes("assisted")) return "suspension";
  return e.split(" ")[0] ?? "other";
}

/**
 * §12 — a dynamic session must be runnable without assembling a gym. Bodyweight
 * never counts against the budget; two implement families are the hard ceiling
 * for a conditioning format, three for anything else.
 */
export function equipmentFamilyLimit(category: Category, format: Format): number {
  if (isDynamicFormat(format)) return 2;
  if (category === "MICRO-WORKOUTS") return 0;
  return 3;
}

export function equipmentFamilyViolation(
  exercises: ExerciseLike[],
  category: Category,
  format: Format,
): string | null {
  if (!exercises.length) return null;
  const limit = equipmentFamilyLimit(category, format);
  const families = new Set(
    exercises.map((e) => equipmentFamilyOf(e.equipment)).filter((f) => f !== "bodyweight"),
  );
  if (families.size > limit)
    return `The session spans ${families.size} equipment families (${[...families].join(", ")}) — a ${format} ${category} session may use at most ${limit} beyond bodyweight.`;
  return null;
}

// --- 19. Time math ----------------------------------------------------------

/** Hard ceiling: work (Main + Finisher) may never balloon past the request. */
export function durationOverflowViolation(
  estimatedMinutes: number,
  targetMinutes: number,
): string | null {
  const ceiling = Math.round(targetMinutes * 1.15) + 4;
  if (estimatedMinutes > ceiling)
    return `Prescribed work (~${estimatedMinutes} min) materially exceeds the advertised ${targetMinutes} min session.`;
  return null;
}

/**
 * §19 — the advertised duration is TRAINING TIME: Main Workout + Finisher.
 * Activation and cool down sit on top of it as a bounded allowance, so prep
 * can never eat the session and a 30-minute request really trains 30 minutes.
 */
export function activationAllowanceMinutes(targetMinutes: number): number {
  if (targetMinutes <= 15) return 5;
  if (targetMinutes <= 30) return 6;
  return 8;
}

export function cooldownAllowanceMinutes(targetMinutes: number): number {
  return targetMinutes <= 15 ? 4 : 5;
}

/** Activation may never exceed its allowance. */
export function activationOverflowViolation(
  activationMinutes: number,
  targetMinutes: number,
): string | null {
  const ceiling = activationAllowanceMinutes(targetMinutes) + 3;
  if (activationMinutes > ceiling)
    return `Activation (~${activationMinutes} min) is too long — preparation may take at most about ${activationAllowanceMinutes(targetMinutes)} min on top of the ${targetMinutes} min of training.`;
  return null;
}

/** Cool down may never exceed its allowance. */
export function cooldownOverflowViolation(
  cooldownMinutes: number,
  targetMinutes: number,
): string | null {
  const ceiling = cooldownAllowanceMinutes(targetMinutes) + 3;
  if (cooldownMinutes > ceiling)
    return `Cool down (~${cooldownMinutes} min) is too long — it may take at most about ${cooldownAllowanceMinutes(targetMinutes)} min on top of the ${targetMinutes} min of training.`;
  return null;
}

/**
 * Sanity ceiling for the WHOLE session: advertised training time plus the two
 * prep allowances. It exists to catch a runaway session, never to shorten a
 * properly dosed one.
 */
export function sessionOverflowViolation(
  sessionMinutes: number,
  targetMinutes: number,
): string | null {
  const ceiling =
    Math.round(targetMinutes * 1.05) +
    activationAllowanceMinutes(targetMinutes) +
    cooldownAllowanceMinutes(targetMinutes) +
    2;
  if (sessionMinutes > ceiling)
    return `The complete session (~${sessionMinutes} min including activation, main work, rest, finisher and cool down) is far beyond the requested ${targetMinutes} min of training.`;
  return null;
}

/**
 * §19 — the section budgets must actually ADD UP. Soft tissue + activation +
 * main work + rest + transitions + finisher + cool down are summed and checked
 * against the requested training time plus its two prep allowances. This is the
 * shortfall side of the contract (the overflow side is above): a session that
 * only prescribes half the requested work is rejected, not shipped.
 */
// --- 19b. Cardio stays cardio ----------------------------------------------

/**
 * High-fatigue conditioning vocabulary. These movements raise heart rate, but
 * they are the language of METABOLIC / CALORIE BURNING — not of an aerobic
 * session. They may appear in Cardio, but they may never define it.
 */
export const HIGH_FATIGUE_CONDITIONING_RE =
  /\b(burpee|thruster|kettlebell swing|dumbbell swing|american swing|russian swing|ball slam|slam ball|wall ball|devil press|man ?maker|snatch|clean|box jump|jump squat|squat jump|jumping lunge|jump lunge|mountain climber)\b/i;

/** Cyclical or simple repeatable aerobic vocabulary — the core of Cardio. */
export const AEROBIC_RE =
  /\b(run|running|jog|walk|walking|bike|cycling|cycle|row|rowing|elliptical|stair|step-?mill|stepper|ski ?erg|skierg|ergometer|treadmill|jump rope|skipping|march|shuttle|sprint|swim)\b/i;

/**
 * §4 — CARDIO must produce an aerobic stimulus, not a disguised metabolic
 * session. At most ONE high-fatigue conditioning movement may appear in the
 * main block, and it may never make up the majority of it.
 */
export function cardioDominanceViolation(
  exercises: Array<{ name: string }>,
  category: Category,
): string | null {
  if (category !== "CARDIO" || exercises.length === 0) return null;
  const hot = exercises.filter((e) => HIGH_FATIGUE_CONDITIONING_RE.test(e.name));
  if (hot.length > 1 || hot.length * 2 > exercises.length)
    return `CARDIO is an aerobic session, not a metabolic one: ${hot
      .map((e) => `"${e.name}"`)
      .join(", ")} are high-fatigue conditioning movements — at most one may appear, and the block must be dominated by repeatable aerobic work.`;
  return null;
}

// --- 27. Mood and biometrics: deterministic dose ----------------------------

/** Impact and plyometric vocabulary — the first thing to go on a bad day. */
export const HIGH_IMPACT_RE =
  /\b(jump|jumping|jump squat|squat jump|box jump|broad jump|tuck jump|plyo|plyometric|bound|hop|hopping|burpee|depth jump|skater jump|jumping jack|jumping lunge|jump lunge|sprint|slam)\b/i;

const LOW_ENERGY_MOODS = new Set(["tired", "stressed", "low", "sore"]);

export function isLowEnergyMood(mood: string | null | undefined): boolean {
  return LOW_ENERGY_MOODS.has((mood ?? "").toLowerCase().trim());
}

/**
 * §27 — mood changes DOSE, and the change must be verifiable, not just asked
 * for in the prompt. On a low-energy day repeated high-impact work is rejected
 * outright: at most one impact movement may survive in the main block.
 */
export function moodDoseViolation(
  mood: string | null | undefined,
  exercises: ExerciseLike[],
): string | null {
  if (!isLowEnergyMood(mood) || exercises.length === 0) return null;
  const impact = exercises.filter((e) => HIGH_IMPACT_RE.test(e.name));
  if (impact.length > 1)
    return `The athlete reported feeling ${(mood ?? "").toLowerCase()}, but the session still prescribes repeated high-impact work (${impact
      .map((e) => `"${e.name}"`)
      .join(", ")}). Reduce impact and volume on a low-energy day.`;
  return null;
}

/**
 * §2 — biometrics are not decoration. Past 60 the joints, not the willingness,
 * set the ceiling: repeated impact is replaced with low-impact equivalents.
 */
export function ageSafetyViolation(
  age: number | null | undefined,
  exercises: ExerciseLike[],
): string | null {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 60) return null;
  const impact = exercises.filter((e) => HIGH_IMPACT_RE.test(e.name));
  const limit = age >= 70 ? 0 : 1;
  if (impact.length > limit)
    return `The athlete is ${Math.round(age)}: ${impact
      .map((e) => `"${e.name}"`)
      .join(", ")} ${impact.length === 1 ? "is" : "are"} repeated high-impact work. Use low-impact equivalents (step-ups, marches, fast bodyweight squats, carries, cycling).`;
  return null;
}

/** Deterministic coaching directive derived from age, shown to the model. */
export function ageDirective(age: number | null | undefined): string {
  if (typeof age !== "number" || !Number.isFinite(age)) return "";
  if (age >= 70)
    return "The athlete is over 70: no jumping, hopping, plyometrics or impact of any kind. Prefer supported, stable, low-complexity movements, longer rest and a slightly lower total volume. Strength work stays — it matters more at this age, not less.";
  if (age >= 60)
    return "The athlete is over 60: at most one low-amplitude impact movement in the whole session, prefer stable and well-supported variations, extend rest slightly and avoid heavy spinal loading late in the session.";
  if (age >= 50)
    return "The athlete is over 50: keep impact moderate, warm the joints properly and prefer controlled tempo over ballistic speed. Volume and loading stay appropriate to their level.";
  if (age <= 17)
    return "The athlete is under 18: prioritise technique, bodyweight and light loading, no maximal or near-maximal loads, and no fatigue-to-failure work.";
  return "";
}

export function sessionBudgetViolation(

  sessionMinutes: number,
  workMinutes: number,
  targetMinutes: number,
): string | null {
  if (targetMinutes <= 0) return null;
  if (workMinutes < Math.round(targetMinutes * 0.6))
    return `The prescribed sections only add up to ~${workMinutes} min of training against a requested ${targetMinutes} min — the session is materially short.`;
  const floorTotal = Math.round(targetMinutes * 0.7);
  if (sessionMinutes < floorTotal)
    return `The complete session (~${sessionMinutes} min across all blocks) falls far short of the requested ${targetMinutes} min.`;
  return null;
}



/**
 * The human-realism preamble every session sees, whatever the category.
 */
export const HUMAN_REALISM_PROMPT = `HUMAN REALISM (HARD RULE, EVERY CATEGORY AND FORMAT)
Before choosing any exercise ask: "Would a professional coach realistically give this to an ordinary adult client — a working 35, 45 or 55 year old who wants to get fit, strong and lean — in THIS workout?" If the answer is no, do not use it.
NEVER program: Turkish get-ups, pistol squats, shrimp/sissy squats, handstands or handstand push-ups, headstands, pike push-ups, levers (front/back/human flag), planches, muscle-ups, nordic curls, dragon flags, skin the cat, clapping/aztec push-ups, kipping or butterfly pull-ups, windmills, bent presses, overhead squats, snatches, cleans, jerks, behind-the-neck pressing, or any movement needing exceptional mobility, balance, skill or coordination. Bodyweight does not make an exercise appropriate, and advanced does not make it better.
ALWAYS prefer the common, familiar, effective movements from the library: squats, goblet squats, lunges, reverse lunges, step-ups, hip thrusts, glute bridges, push-ups, presses, rows, pulldowns, TRX rows, dumbbell and kettlebell work, kettlebell swings, medicine-ball work, carries, simple core work, and genuine cardio (bike, rower, jump rope, running) where appropriate.
SEQUENCING: never place a technical, balance or precision movement straight after a high-fatigue one (burpees → handstand push-ups is unacceptable), and never chain movements that need completely different setups or locations inside a timed workout. The athlete must spend the session training, not preparing equipment.
FINAL TEST before you output: would you genuinely give this workout to that client, can they understand it, perform it safely, transition naturally between the exercises, and does it feel achievable rather than complicated? If not, replace the exercise.`;

/** Prompt text so the model sees the same doctrine the validator enforces. */
export function doctrinePrompt(category: Category, format: Format): string {
  if (category === "MICRO-WORKOUTS")
    return `HARD DOCTRINE: Micro Workouts are equipment-free and REPS & SETS only — never Circuit, AMRAP, EMOM, Tabata or For Time, whatever the athlete's level. Bodyweight plus everyday environment only (floor, wall, chair, desk, table, sofa, bed, stairs, a small space). No dumbbells, kettlebells, barbells, bands, TRX, machines, cables, medicine or slam balls, benches or any other gym equipment. No finisher, no separate soft tissue, activation or cool down.`;

  if (category === "RECOVERY")
    return `HARD DOCTRINE: RECOVERY is controlled recovery work written as MIX — and MIX here means ONLY gentle recovery modalities: breathing, gentle mobility and CARs, controlled low-effort movement, light stretching and relaxation. MIX never means a strength portion plus a metabolic portion in this category. FORBIDDEN: strength training, conditioning, HIIT, metabolic work, fatigue-based training, loaded implements (barbell, kettlebell, machine, cable, sled), jumping, sprinting, swings, push-ups, pull-ups, crunches and any finisher.`;

  if (isRepsAndSetsOnly(category))
    return `HARD DOCTRINE: ${category} is REPS & SETS only. Never AMRAP, EMOM, Tabata, For Time, circuit or chipper anywhere in the session.${
      categoryAllowsFinisher(category) ? "" : " This category carries NO finisher of any kind."
    }`;
  if (isDynamicFormat(format))
    return `HARD DOCTRINE: ${format} in ${category} is a continuous time/repetition format. Every movement must start immediately and repeat safely. FORBIDDEN: barbell work of any kind (including barbell complexes), bench press, back/front squat, barbell deadlift, cleans, snatches, jerks, rack- or spotter-dependent movements, Smith machine, cables, selectorized strength machines, and every high-skill or single-limb movement (handstand of any kind, pistol squat, archer push-up/row, planche, muscle-up, nordic curl, one-arm pressing or pulling). ALLOWED: bodyweight, dumbbells, kettlebells, medicine/slam balls, TRX, bands, portable boxes, carries, jump rope, sled push/pull and genuine cardio ergometers (bike, rower, SkiErg). Keep equipment families to a minimum so the athlete never assembles or adjusts equipment mid-workout.`;

  return "";
}
