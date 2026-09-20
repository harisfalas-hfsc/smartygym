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

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TRAINER MINDSET — THE FIRST THING READ, BEFORE EVERYTHING ELSE IN THIS FILE
 * ────────────────────────────────────────────────────────────────────────────
 * Injected at the very top of every generation prompt (member workouts, Smarty
 * Coach, admin workouts, admin training programs). All rules that follow —
 * doctrine, philosophy, category pools, formats, difficulty, bans and the
 * priority vocabulary — exist to serve this.
 */
export const COACH_MINDSET = `## Trainer Mindset — Read Before Category, Format, or Difficulty Logic

This is the first instruction the system reads, before the general rules, philosophy, doctrine and everything else that follows.

Before the system evaluates exercise category, format, difficulty level, equipment, or time available, it must first operate from the mindset of Haris Falas, a professional fitness trainer and sports scientist, designing for real people — not professional athletes. The people using this system are parents, working people, individuals managing health conditions, people who are tired from work, stressed from family or financial pressures, and who are giving up one hour of their day to feel better. They come to Smarty Gym to feel healthier, to build strength gradually, to lose weight, to prevent injury, to enjoy time with themselves, and to feel better mentally and physically — not to prove anything or to be pushed like athletes.

This means every decision the system makes about exercise selection, category, format, and difficulty must be filtered through professional judgment: safety, health, and quality of the workout come before intensity, novelty, or volume. Choosing "advanced" does not mean complicated: it means progressing familiar, safe movements through load, volume, density, tempo, range, rest, exercise combinations and programming — never adding circus-level skills merely to look advanced. Choosing "beginner" or a shorter time window does not mean giving the person less value or an incomplete session — it means the trainer still designs a properly structured, professional, complete workout suited to that constraint. People are trusting the system with their time and their money, and the system must always deliver a real, well-designed training experience in return, never a lazy or token one, regardless of the level or time selected.

This mindset is the first filter applied to every generation, before any category, format, difficulty, or equipment logic runs. All the rules that follow exist to serve this: care for the person first, then build the workout.`;

export const PRIORITY_MACHINE = [
  // Lower push / lower pull
  "leg press", "leg extension", "hack squat", "smith machine squat",
  "smith machine split squat", "smith machine lunge", "seated calf raise",
  "standing calf raise", "seated leg curl", "lying leg curl", "standing leg curl",
  "glute machine", "hip thrust machine", "back extension machine",
  "cable pull-through", "cable glute kickback",
  // Upper push / upper pull
  "chest press machine", "incline chest press machine", "pec deck",
  "shoulder press machine", "cable chest press", "cable chest fly",
  "cable crossover", "cable lateral raise", "lat pulldown", "seated cable row",
  "machine row", "chest-supported row machine", "assisted pull-up machine",
  "high row machine", "cable straight-arm pulldown", "cable face pull",
  // Arms / core / full body
  "cable triceps pushdown", "cable overhead triceps extension",
  "machine triceps extension", "cable biceps curl", "cable hammer curl",
  "preacher curl machine", "biceps curl machine", "triceps dip machine",
  "cable crunch", "ab crunch machine", "rotary torso machine", "back extension",
  "cable wood chop", "cable pallof press", "smith machine romanian deadlift",
  "cable squat", "cable row to press", "sled push",
  // Conventional aliases already used by the live library.
  "machine chest press", "machine shoulder press", "machine lateral raise",
  "rear delt machine fly", "assisted pull-up", "assisted dip", "machine dip",
  "hip abduction", "hip adduction", "glute kickback", "machine preacher curl",
];

export const PRIORITY_FREE_WEIGHT = [
  // Upper push / pull
  "dumbbell bench press", "dumbbell floor press", "dumbbell shoulder press",
  "single-arm dumbbell shoulder press", "dumbbell arnold press", "dumbbell chest fly",
  "dumbbell incline press", "trx push-up", "trx chest press", "dumbbell push press",
  "dumbbell bent-over row", "single-arm dumbbell row", "dumbbell renegade row",
  "dumbbell upright row", "trx row", "trx high row", "trx face pull",
  "kettlebell row", "single-arm kettlebell row", "dumbbell rear delt fly",
  // Lower push / posterior chain
  "dumbbell goblet squat", "dumbbell squat", "dumbbell front squat",
  "dumbbell reverse lunge", "dumbbell forward lunge", "dumbbell walking lunge",
  "dumbbell bulgarian split squat", "dumbbell step-up", "kettlebell goblet squat",
  "kettlebell front squat", "dumbbell romanian deadlift",
  "single-leg dumbbell romanian deadlift", "dumbbell deadlift", "kettlebell deadlift",
  "kettlebell romanian deadlift", "kettlebell swing", "two-hand kettlebell swing",
  "single-arm kettlebell swing", "dumbbell hip thrust", "trx hamstring curl",
  // Full body / power / conditioning
  "dumbbell thruster", "single-arm dumbbell thruster", "kettlebell thruster",
  "single-arm kettlebell thruster", "kettlebell clean", "kettlebell clean and press",
  "medicine ball slam", "medicine ball chest pass", "medicine ball rotational throw",
  "medicine ball squat to press",
  // Conventional barbell fundamentals remain available in the same shared pool.
  "barbell deadlift", "sumo deadlift", "romanian deadlift", "barbell back squat",
  "barbell front squat", "barbell bench press", "barbell overhead press",
  "barbell bent-over row", "barbell hip thrust", "barbell lunge", "barbell curl",
  "dumbbell curl", "hammer curl", "dumbbell lateral raise", "farmer's carry",
];

export const PRIORITY_BODYWEIGHT = [
  // Upper push / pull
  "push-up", "wide push-up", "close-grip push-up", "diamond push-up",
  "incline push-up", "decline push-up", "kneeling push-up", "pike push-up",
  "bench dip", "box dip", "shoulder tap", "pull-up", "chin-up",
  "neutral-grip pull-up", "inverted row", "trx bodyweight row",
  "scapular pull-up", "prone y raise", "prone t raise",
  // Lower push / posterior chain
  "bodyweight squat", "air squat", "sumo squat", "split squat", "forward lunge",
  "reverse lunge", "walking lunge", "lateral lunge", "curtsy lunge", "step-up",
  "bulgarian split squat", "wall sit", "squat pulse", "glute bridge",
  "single-leg glute bridge", "hip thrust", "single-leg hip thrust",
  "bodyweight good morning", "hamstring walkout",
  "single-leg romanian deadlift bodyweight", "nordic hamstring curl",
  // Core
  "sit-up", "crunch", "bicycle crunch", "reverse crunch", "leg raise", "dead bug",
  "bird dog", "plank", "side plank", "mountain climber",
  // Conditioning / full body and immediately available common alternatives.
  "burpee", "jumping jack", "high knees", "butt kicks", "skipping",
  "skater jump", "commando", "bear crawl", "squat jump",
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
  [/\bair squats?\b/g, "bodyweight squat"],
  [/\bsuspension trainer\b|\bsuspension\b/g, "trx"],
  [/\bslam ball\b/g, "medicine ball"],
  [/\bbutt kickers?\b/g, "butt kicks"],
  [/\bskipping in place\b|\bjump rope\b/g, "skipping"],
  [/\bplank to push up\b|\bup down plank\b/g, "commando"],
  [/\bneutral grip chin up\b/g, "neutral grip pull up"],
  [/\bstraight arm cable pulldown\b/g, "cable straight arm pulldown"],
  [/\bpallof hold\b/g, "pallof press"],
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
  /\b(front lever|back lever|lever (?:reps|hold|raise|pull)|planche|human flag|flag hold|muscle[- ]?up|handstand|pistol|shrimp squat|turkish get[- ]?up|nordic hamstring curl|iron cross|dragon flag|maltese|victorian|skin the cat|stalder|archer push[- ]?up|clock push[- ]?up|single arm (?:pull[- ]?up|push[- ]?up)|one[- ]arm (?:pull[- ]?up|push[- ]?up)|90 degree push[- ]?up|tiger bend|hefesto|impossible dip)\b/i;

/** Movements that must never be programmed. */
export function isForbiddenName(name: string): boolean {
  // Do not confuse the ordinary supine mobility drill with the rings skill.
  if (/\biron cross stretch\b/i.test(name)) return false;
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

export type ExerciseFamily =
  | "UPPER_PUSH"
  | "UPPER_PULL"
  | "LOWER_PUSH"
  | "LOWER_PULL"
  | "CORE"
  | "CONDITIONING"
  | "FULL_BODY"
  | "GENERAL";

/** Shared movement-family hierarchy used after legality and category filters. */
export function exerciseFamily(name: string, bodyPart?: string | null, target?: string | null): ExerciseFamily {
  const n = canonical(`${name} ${bodyPart || ""} ${target || ""}`);
  if (/\b(burpee|jumping jack|high knees|butt kicks|skater|mountain climber|bear crawl|sled push|run|jog|skip)\b/.test(n)) return "CONDITIONING";
  if (/\b(thruster|clean and press|squat to press|row to press)\b/.test(n)) return "FULL_BODY";
  if (/\b(plank|sit up|crunch|dead bug|bird dog|leg raise|pallof|wood chop|rotary torso|abs|oblique|waist)\b/.test(n)) return "CORE";
  if (/\b(push up|dip|bench press|floor press|chest press|shoulder press|push press|chest fly|pec deck|pectorals|triceps)\b/.test(n)) return "UPPER_PUSH";
  if (/\b(pull up|chin up|row|pulldown|face pull|rear delt|biceps|back|lats)\b/.test(n)) return "UPPER_PULL";
  if (/\b(squat|lunge|step up|leg press|leg extension|calf raise|quadriceps|quads)\b/.test(n)) return "LOWER_PUSH";
  if (/\b(deadlift|good morning|hamstring|leg curl|hip thrust|glute bridge|pull through|glute kickback|posterior)\b/.test(n)) return "LOWER_PULL";
  return "GENERAL";
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
export function selectionTier(name: string, category?: string | null): 0 | 1 | 2 | 3 {
  const n = name || "";
  if (isDeprioritisedName(n)) return 3;
  let tier: 0 | 1 | 2 | 3 = !isPriorityName(n) ? 2 : simplicityPenalty(n) <= 2 ? 0 : 1;
  // Category-to-pool mapping: a legal exercise outside the category's pools is
  // still allowed, it is simply offered after the ones inside them.
  if (category && !matchesCategoryPool(n, category) && tier < 2) tier = 2;
  return tier;
}

/** Orders any list of library rows by the one shared selection policy. */
export function orderBySelectionPolicy<T extends { name: string }>(
  list: T[],
  category?: string | null,
): T[] {
  return [0, 1, 2, 3].flatMap((t) =>
    simplestFirst(list.filter((e) => selectionTier(e.name, category) === t)),
  );
}

/** Removes everything banned, then orders by the shared selection policy. */
export function applySelectionPolicy<T extends { name: string }>(
  list: T[],
  category?: string | null,
): T[] {
  return orderBySelectionPolicy(list.filter((e) => isSelectable(e.name)), category);
}
