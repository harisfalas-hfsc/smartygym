/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXERCISE SELECTION — SINGLE SOURCE OF TRUTH
 * ════════════════════════════════════════════════════════════════════════════
 * EVERY exercise selection in the platform goes through this one file:
 *   • member "Create Your Own Workout"  (create-custom-workout)
 *   • Smarty Coach workout creation     (same generator)
 *   • Admin workout generator           (generate-admin-workout)
 *   • Admin training program generator  (generate-admin-program, restructure)
 *   • Every other generator that builds an exercise reference list
 *
 * There is ONE ban list, ONE priority order and ONE "simplest wins" rule.
 * Consumers must call isSelectable / selectionTier / applySelectionPolicy —
 * never re-implement their own bans or ordering.
 *
 * PRIORITY VOCABULARY (Haris Falas coaching reference list).
 *
 * The master reference for what a "normal, common, recognizable" exercise looks
 * like. Names here are the coach's wording — the library may word things
 * differently, so matching is semantic (word order, equipment prefixes and
 * synonyms are ignored).
 *
 * It is never a whitelist: category, format, questionnaire, equipment and
 * difficulty still decide WHICH movement is needed. The list decides WHICH
 * VARIATION of that movement gets picked, and the simplest match always wins.
 *
 * Used by: create-custom-workout (member generator + Smarty Coach),
 * generate-admin-workout, generate-admin-program.
 */

export const PRIORITY_MACHINE = [
  // Stations / equipment
  "leg extension machine", "leg curl machine", "leg press", "hack squat machine",
  "smith machine", "squat rack", "power rack", "chest press machine", "pec deck",
  "butterfly machine", "lat pulldown machine", "seated row machine",
  "cable crossover machine", "shoulder press machine", "lateral raise machine",
  "assisted pull-up machine", "assisted dip machine", "dip station", "pull-up bar",
  "hip abductor machine", "hip adductor machine", "glute kickback machine",
  "hip thrust machine", "calf raise machine", "preacher curl bench",
  "triceps pushdown cable station", "roman chair", "back extension bench",
  "abdominal crunch machine",
  // Machine-based exercises
  "leg extension", "single-leg extension", "lying leg curl", "seated leg curl",
  "single-leg press", "hack squat", "smith machine squat", "smith machine lunge",
  "smith machine bench press", "smith machine incline press",
  "smith machine shoulder press", "barbell back squat", "front squat",
  "overhead press", "flat bench press", "incline bench press", "decline bench press",
  "close-grip bench press", "wide-grip bench press", "machine chest press",
  "pec deck fly", "cable crossover", "cable crossover high to low",
  "cable crossover low to high", "lat pulldown", "wide grip lat pulldown",
  "close grip lat pulldown", "reverse grip lat pulldown", "seated cable row",
  "standing cable row", "single-arm cable row", "machine shoulder press",
  "machine lateral raise", "cable lateral raise", "cable face pull",
  "rear delt machine fly", "assisted pull-up", "assisted dip", "machine dip",
  "hip abduction", "hip adduction", "glute kickback", "hip thrust machine press",
  "standing calf raise", "seated calf raise", "machine preacher curl",
  "cable bicep curl", "cable triceps pushdown", "cable overhead triceps extension",
  "machine ab crunch", "back extension",
];

export const PRIORITY_FREE_WEIGHT = [
  "barbell deadlift", "sumo deadlift", "romanian deadlift",
  "dumbbell romanian deadlift", "kettlebell deadlift", "barbell back squat",
  "barbell front squat", "goblet squat", "dumbbell squat", "kettlebell squat",
  "barbell bench press", "dumbbell bench press", "incline dumbbell press",
  "barbell overhead press", "dumbbell shoulder press", "kettlebell push press",
  "barbell bent-over row", "dumbbell bent-over row", "kettlebell bent-over row",
  "single-arm dumbbell row", "pendlay row", "barbell upright row",
  "dumbbell upright row", "barbell curl", "dumbbell curl", "hammer curl",
  "kettlebell curl", "skull crusher", "dumbbell overhead triceps extension",
  "barbell hip thrust", "dumbbell lunge", "barbell lunge", "walking lunge",
  "bulgarian split squat", "kettlebell swing", "kettlebell snatch",
  "dumbbell snatch", "ground to overhead", "kettlebell clean",
  "dumbbell clean and press", "barbell clean and jerk", "barbell power clean",
  "turkish get-up", "dumbbell lateral raise", "dumbbell front raise",
  "dumbbell rear delt fly", "farmer's carry", "dumbbell pullover",
  "kettlebell halo", "renegade row", "shrug", "dumbbell fly",
];

export const PRIORITY_BODYWEIGHT = [
  "bodyweight squat", "jump squat", "walking lunge", "reverse lunge",
  "forward lunge", "lateral lunge", "bulgarian split squat", "step-up", "push-up",
  "wide-grip push-up", "diamond push-up", "decline push-up", "incline push-up",
  "pike push-up", "pull-up", "chin-up", "inverted row", "dip", "plank",
  "side plank", "sit-up", "crunch", "bicycle crunch", "russian twist",
  "leg raise", "hanging leg raise", "v-up", "mountain climber", "flutter kick",
  "toe touches", "glute bridge", "single-leg glute bridge", "superman",
  "bird dog", "burpee", "jumping jack", "high knees", "wall sit", "calf raise",
  "box jump", "broad jump", "lateral bound", "bear crawl", "crab walk",
  "skater jump", "shoulder tap plank", "plank to push-up", "donkey kick",
  "fire hydrant", "tuck jump",
];

export const PRIORITY_PILATES = [
  "the hundred", "roll-up", "roll-over", "single leg circle",
  "rolling like a ball", "single leg stretch", "double leg stretch",
  "spine stretch forward", "open leg rocker", "corkscrew", "saw", "swan dive",
  "single leg kick", "double leg kick", "neck pull", "scissors", "bicycle",
  "shoulder bridge", "spine twist", "jackknife", "side kick", "side kick circles",
  "teaser", "hip twist", "swimming", "leg pull front", "leg pull back",
  "side bend", "mermaid", "boomerang", "seal", "crab", "control balance",
  "pilates push-up", "pelvic curl", "chest lift", "chest lift with rotation",
  "criss-cross", "ab prep", "standing roll-down", "pilates plank",
  "stability ball roll-out", "stability ball hip bridge", "stability ball pike",
  "stability ball hamstring curl", "stability ball russian twist",
  "band-assisted leg circle", "seated band pull-apart", "seated band rowing",
  "band assisted roll-up", "mermaid stretch with band",
];

export const PRIORITY_RECOVERY = [
  "cat-cow", "child's pose", "90/90 hip rotation", "bird dog", "dead bug",
  "world's greatest stretch", "thoracic spine rotation", "thread the needle",
  "kneeling hip flexor stretch", "couch stretch", "pigeon pose",
  "figure-4 stretch", "butterfly stretch", "frog stretch", "deep squat hold",
  "ankle rocks", "hip cars", "shoulder cars", "arm circles",
  "scapular wall slides", "band pull-apart", "doorway chest stretch",
  "cross-body shoulder stretch", "neck rotations", "cervical side bend stretch",
  "standing quad stretch", "standing hamstring stretch", "seated forward fold",
  "lying hamstring stretch", "piriformis stretch", "supine spinal twist",
  "cobra stretch", "sphinx pose", "downward dog", "standing calf stretch",
  "ankle circles", "glute bridge", "clamshell", "fire hydrant",
  "lateral lunge stretch", "kneeling hip flexor with reach", "wall angels",
  "foam roll it band", "foam roll quads", "foam roll upper back",
  "foam roll glutes", "bear crawl hold", "single-leg balance",
  "single-leg rdl balance reach", "standing 90/90 hip switch",
];

export const ALL_PRIORITY_NAMES = [
  ...PRIORITY_MACHINE,
  ...PRIORITY_FREE_WEIGHT,
  ...PRIORITY_BODYWEIGHT,
  ...PRIORITY_PILATES,
  ...PRIORITY_RECOVERY,
].map((n) => n.toLowerCase());

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Library wording that means the same movement under a different name.
 * Applied before matching so "lever chest press", "lying triceps extension"
 * and "farmers walk" all resolve to their priority movement.
 */
const SYNONYMS: [RegExp, string][] = [
  [/\blever\b|\bleverage\b|\bmachine\b|\bsled\b(?= )/g, " "],
  [/\bsmith\b/g, "smith machine"],
  [/\bfarmers?\s+(walk|carry)\b/g, "farmer s carry"],
  [/\blying tricep(s)? extension\b/g, "skull crusher"],
  [/\bfrench press\b/g, "triceps extension"],
  [/\btricep\b/g, "triceps"],
  [/\bpush ?down\b/g, "pushdown"],
  [/\bchest fly\b|\bpectoral fly\b|\bbutterfly\b/g, "pec deck fly"],
  [/\bcurl up\b|\bcrunch floor\b/g, "sit up"],
  [/\bglute bridge (two legs|one leg)\b/g, "glute bridge"],
  [/\bhyperextension\b/g, "back extension"],
  [/\bbulgarian\b/g, "bulgarian split squat"],
  [/\bsissy squat\b/g, "squat"],
  [/\bseated row cable\b|\bcable seated row\b/g, "seated cable row"],
  [/\bfront pulldown\b|\bpull down\b/g, "lat pulldown"],
  [/\bheel raise\b/g, "calf raise"],
  [/\babduction\b/g, "hip abduction"],
  [/\badduction\b/g, "hip adduction"],
  [/\bknee extension\b/g, "leg extension"],
  [/\bknee flexion\b|\bhamstring curl\b/g, "leg curl"],
  [/\bmilitary press\b/g, "overhead press"],
  [/\bsplit jump\b/g, "jump squat"],
  [/\bpress up\b/g, "push up"],
  [/\bswiss ball\b|\bexercise ball\b|\bphysio ball\b/g, "stability ball"],
  [/\bget ?up\b/g, "get up"],
  [/\bflutter kicks\b/g, "flutter kick"],
  [/\bone (arm|leg)\b/g, "single $1"],
  [/\bsingle ?arm\b/g, "single arm"],
  [/\bsingle ?leg\b/g, "single leg"],
];

export const canonical = (s: string) => {
  let n = norm(s);
  for (const [re, to] of SYNONYMS) n = n.replace(re, to);
  return norm(n);
};

const PRIORITY_NORMALISED = [...new Set(ALL_PRIORITY_NAMES.map(canonical))];
/** Token sets of each priority entry, for "same words, different order" matches. */
const PRIORITY_TOKENS = PRIORITY_NORMALISED.map((p) => p.split(" ").filter((t) => t.length > 2));

/**
 * Equipment the coach does NOT want promoted. Legal, but never preferred and
 * always sorted last.
 */
const DEPRIORITISED_RE = /\bbosu\b|\bwobble\b|\bbalance (?:board|disc|pad|cushion)\b/i;

/** Unsafe or unwanted pairings that must never be programmed at all. */
const FORBIDDEN_RE =
  /\bbosu\b.*\b(squat|deadlift|lunge|press|row|clean|snatch|jump|curl|step)\b|\b(squat|deadlift|lunge|press|row|clean|snatch|jump|curl|step)\b.*\bbosu\b/i;

/**
 * Unstable-surface and elevated single-leg squat work. Anything named in the
 * reference list (single-leg balance, single-leg RDL reach, the stability-ball
 * Pilates entries) is exempted before this test runs.
 */
const UNSTABLE_RE =
  /\b(bosu|wobble board|balance board|balance disc|balance cushion|stability disc|slackline|airex)\b/i;

/** The only unstable tool the reference list itself uses (Pilates entries). */
const REFERENCE_UNSTABLE_RE = /\bstability ball\b/i;

const ELEVATED_SINGLE_LEG_SQUAT_RE =
  /\b(single leg|one leg|pistol|shrimp)\b[^.]*\bsquat\b[^.]*\b(bench|box|step|chair|elevated|platform)\b|\b(bench|box|step|chair|elevated|platform)\b[^.]*\b(single leg|one leg|pistol|shrimp)\b[^.]*\bsquat\b/i;

/**
 * Circus / gymnastic complexity the coach never wants programmed. Smarty Gym
 * trains simple, common, understandable movements — no levers, planches,
 * flags, muscle-ups, handstands or pistols, at any level.
 */
const COMPLEXITY_RE =
  /\b(front lever|back lever|lever (?:reps|hold|raise|pull)|planche|human flag|flag hold|muscle[- ]?up|handstand|pistol|shrimp squat|iron cross|dragon flag|maltese|victorian|skin the cat|stalder|archer push[- ]?up|clock push[- ]?up|single arm (?:pull[- ]?up|push[- ]?up)|one[- ]arm (?:pull[- ]?up|push[- ]?up)|90 degree push[- ]?up|tiger bend|hefesto|impossible dip)\b/i;

/** Movements that must never be programmed. */
export function isForbiddenName(name: string): boolean {
  if (COMPLEXITY_RE.test(name) || FORBIDDEN_RE.test(name)) return true;
  if (ELEVATED_SINGLE_LEG_SQUAT_RE.test(canonical(name))) return true;
  // Unstable-surface variations are banned unless the reference list asks for
  // that exact item (e.g. the stability-ball Pilates exercises).
  if (UNSTABLE_RE.test(name) && !(REFERENCE_UNSTABLE_RE.test(name) && matchesReference(name))) return true;
  return false;
}

/** Legal, but never promoted as a coach priority. */
export function isDeprioritisedName(name: string): boolean {
  return DEPRIORITISED_RE.test(name);
}

/** Pure semantic match against the reference list, ignoring the ban lists. */
function matchesReference(name: string): boolean {
  const n = canonical(name);
  if (!n) return false;
  if (PRIORITY_NORMALISED.some((p) => n === p || n.includes(p))) return true;
  const words = new Set(n.split(" "));
  return PRIORITY_TOKENS.some((tokens) => tokens.length > 1 && tokens.every((t) => words.has(t)));
}

/**
 * True when a library exercise name is (or clearly means) one of the coach's
 * reference movements — "lever chest press", "cable crossover (high to low)",
 * "seated leg curl machine", "farmers walk" and "lying triceps extension" all
 * resolve even though the library wording differs.
 */
export function isPriorityName(name: string): boolean {
  if (isDeprioritisedName(name) || isForbiddenName(name)) return false;
  return matchesReference(name);
}

/**
 * "Simplest wins" tie-break. When several library entries mean the same
 * movement, the plainest standard version must be chosen. Lower = simpler.
 */
const COMPLEXITY_PENALTIES: [RegExp, number][] = [
  [/\blever\b|\bleverage\b|\bplate[- ]loaded\b|\bsled\b/i, 6],
  [/\bstability ball\b|\bswiss ball\b|\bexercise ball\b|\bbosu\b|\bwobble\b|\bbalance (board|disc|pad)\b/i, 6],
  [/\bsingle[- ](arm|leg)\b|\bone[- ](arm|leg)\b|\bunilateral\b|\balternating\b/i, 3],
  [/\bdeficit\b|\bpause\b|\btempo\b|\bpin\b|\bchain\b|\bband[- ]resisted\b|\bsuspended\b|\btrx\b|\bsuspension\b/i, 4],
  [/\barcher\b|\bexplosive\b|\bplyo\b|\bjumping\b(?!\s*jack)|\bclapping\b|\bspiderman\b|\bcossack\b|\bsissy\b/i, 4],
  [/\bbehind the neck\b|\bzercher\b|\bsafety bar\b|\blandmine\b|\bhex bar\b|\btrap bar\b|\bsafety squat\b/i, 5],
  [/\bon (a )?(bench|box|step|chair|ball)\b|\belevated\b|\bdeclined?\b(?!\s*(bench press|push))/i, 2],
  [/\bcable\b|\bsmith\b/i, 1],
];

export function simplicityPenalty(name: string): number {
  let score = 0;
  for (const [re, pts] of COMPLEXITY_PENALTIES) if (re.test(name)) score += pts;
  // Longer, wordier names are almost always the fancier variation.
  score += Math.max(0, name.trim().split(/\s+/).length - 3) * 0.5;
  return score;
}

/** Movement family key used to compare "the same movement, different variation". */
export function movementKey(name: string): string {
  const n = canonical(name);
  const words = n.split(" ").filter(Boolean);
  return words.slice(-2).join(" ") || n;
}

/**
 * Keeps, for each movement family, only the simplest variation available —
 * preferring reference-list matches. Everything else is returned after it, so
 * nothing is lost, the plain version is simply first.
 */
export function simplestFirst<T extends { name: string }>(list: T[]): T[] {
  const score = (e: T) => (isPriorityName(e.name) ? 0 : 10) + simplicityPenalty(e.name);
  const best = new Map<string, T>();
  for (const e of list) {
    const key = movementKey(e.name);
    const current = best.get(key);
    if (!current || score(e) < score(current)) best.set(key, e);
  }
  const chosen = new Set(best.values());
  const winners = [...chosen].sort((a, b) => score(a) - score(b));
  const rest = list.filter((e) => !chosen.has(e)).sort((a, b) => score(a) - score(b));
  return [...winners, ...rest];
}

/** Resolves the ids in a library/pool that match the coach's reference list. */
export function priorityIds(list: { id: string; name: string }[]): Set<string> {
  return new Set(list.filter((e) => isPriorityName(e.name)).map((e) => e.id));
}


// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED SELECTION POLICY — the only API consumers should use.
// ═══════════════════════════════════════════════════════════════════════════

/** Hard gate: false means the exercise may never be programmed, anywhere. */
export function isSelectable(name: string): boolean {
  return !isForbiddenName(name || "");
}

// ── Category → reference pool mapping ───────────────────────────────────────
// Which of the coach's five reference pools a category should draw from first.
// This is a PREFERENCE layer, applied after the hard filters (user constraints,
// category doctrine, equipment, difficulty) — it never unlocks or blocks a
// movement pattern, it only decides which pool is offered first.

export type PriorityPool =
  | "MACHINE"
  | "FREE_WEIGHT"
  | "BODYWEIGHT"
  | "PILATES"
  | "RECOVERY";

const POOL_LISTS: [PriorityPool, string[]][] = [
  ["MACHINE", PRIORITY_MACHINE],
  ["FREE_WEIGHT", PRIORITY_FREE_WEIGHT],
  ["BODYWEIGHT", PRIORITY_BODYWEIGHT],
  ["PILATES", PRIORITY_PILATES],
  ["RECOVERY", PRIORITY_RECOVERY],
];

const POOL_NORMALISED: [PriorityPool, string[]][] = POOL_LISTS.map(
  ([pool, list]) => [pool, [...new Set(list.map(canonical))]],
);

export const CATEGORY_POOLS: Record<string, PriorityPool[]> = {
  STRENGTH: ["FREE_WEIGHT", "MACHINE"],
  "MUSCLE BUILDING": ["MACHINE", "FREE_WEIGHT"],
  "CALORIE BURNING": ["BODYWEIGHT", "FREE_WEIGHT"],
  CARDIO: ["BODYWEIGHT"],
  METABOLIC: ["BODYWEIGHT", "FREE_WEIGHT"],
  CHALLENGE: ["FREE_WEIGHT", "BODYWEIGHT"],
  "MOBILITY & STABILITY": ["RECOVERY"],
  RECOVERY: ["RECOVERY"],
  PILATES: ["PILATES"],
  "MICRO-WORKOUTS": ["BODYWEIGHT"],
};

/** Equipment wording fallback when a name matches no reference entry. */
const EQUIP_POOL_RE: [PriorityPool, RegExp][] = [
  ["RECOVERY", /\b(stretch|mobility|foam roll|cars|pose|cat[- ]cow|breath)\b/i],
  ["PILATES", /\bpilates\b/i],
  ["MACHINE", /\b(machine|cable|smith|lever|leverage|pulldown|press machine|pulley)\b/i],
  ["FREE_WEIGHT", /\b(barbell|dumbbell|kettlebell|ez[- ]bar|medicine ball|plate)\b/i],
];

/** The reference pools a library exercise belongs to. */
export function poolsOf(name: string): PriorityPool[] {
  const n = canonical(name || "");
  if (!n) return [];
  const words = new Set(n.split(" "));
  const hits: PriorityPool[] = [];
  for (const [pool, list] of POOL_NORMALISED) {
    const match = list.some((p) => {
      if (n === p || n.includes(p)) return true;
      const tokens = p.split(" ").filter((t) => t.length > 2);
      return tokens.length > 1 && tokens.every((t) => words.has(t));
    });
    if (match) hits.push(pool);
  }
  if (hits.length) return hits;
  for (const [pool, re] of EQUIP_POOL_RE) if (re.test(name)) return [pool];
  return [];
}

/** True when the exercise sits in a pool this category should draw from. */
export function matchesCategoryPool(name: string, category?: string | null): boolean {
  if (!category) return true;
  const eligible = CATEGORY_POOLS[category.toUpperCase()];
  if (!eligible) return true;
  const pools = poolsOf(name);
  if (!pools.length) return false;
  return pools.some((p) => eligible.includes(p));
}

/**
 * Coach preference order for a legal exercise (lower = offered first):
 *   0 simplest reference-list movement
 *   1 reference-list movement, fancier variation
 *   2 everything else that is legal
 *   3 legal but never promoted (bosu / wobble / balance boards)
 */
export function selectionTier(name: string): 0 | 1 | 2 | 3 {
  const n = name || "";
  if (isDeprioritisedName(n)) return 3;
  if (!isPriorityName(n)) return 2;
  return simplicityPenalty(n) <= 2 ? 0 : 1;
}

/** Orders any list of library rows by the one shared selection policy. */
export function orderBySelectionPolicy<T extends { name: string }>(list: T[]): T[] {
  return [0, 1, 2, 3].flatMap((t) =>
    simplestFirst(list.filter((e) => selectionTier(e.name) === t)),
  );
}

/** Removes everything banned, then orders by the shared selection policy. */
export function applySelectionPolicy<T extends { name: string }>(list: T[]): T[] {
  return orderBySelectionPolicy(list.filter((e) => isSelectable(e.name)));
}
