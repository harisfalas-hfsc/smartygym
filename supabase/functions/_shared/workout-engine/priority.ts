/**
 * PRIORITY VOCABULARY (Haris Falas coaching list).
 *
 * These are the movements and stations the coach wants the engine to reach for
 * FIRST whenever they are legal for the requested category, focus, difficulty
 * and equipment. They are never a whitelist: anything legal in the pool can
 * still be programmed, but priority names are kept in the sample the model
 * sees and are marked as preferred in the prompt.
 */

export const PRIORITY_MACHINE = [
  "leg press", "hack squat", "leg extension", "leg curl", "seated leg curl", "lying leg curl",
  "hip abduction", "hip adduction", "calf raise", "smith machine squat", "chest press",
  "incline chest press", "pec deck fly", "lat pulldown", "seated row", "shoulder press",
  "rear delt machine fly", "assisted pull-up", "assisted dip", "machine dip",
  "triceps pushdown", "cable crossover", "cable row", "cable curl", "cable lateral raise",
  "machine ab crunch", "back extension", "hip thrust machine", "glute kickback",
  "seated calf raise", "t-bar row", "preacher curl", "leverage row", "leverage press",
];

export const PRIORITY_FREE_WEIGHT = [
  "barbell squat", "barbell front squat", "barbell deadlift", "romanian deadlift",
  "barbell hip thrust", "barbell bench press", "incline bench press", "barbell row",
  "barbell overhead press", "barbell lunge", "barbell curl", "dumbbell bench press",
  "dumbbell shoulder press", "dumbbell row", "dumbbell lunge", "dumbbell squat",
  "dumbbell romanian deadlift", "dumbbell curl", "hammer curl", "lateral raise",
  "front raise", "rear delt fly", "dumbbell fly", "triceps extension", "skull crusher",
  "goblet squat", "bulgarian split squat", "step-up", "farmer's carry", "renegade row",
  "kettlebell swing", "kettlebell goblet squat", "kettlebell deadlift", "kettlebell clean",
  "kettlebell press", "kettlebell row", "kettlebell curl", "kettlebell halo",
  "dumbbell thruster", "dumbbell snatch", "shrug", "upright row", "pullover",
];

export const PRIORITY_BODYWEIGHT = [
  "push-up", "wide-grip push-up", "incline push-up", "decline push-up", "diamond push-up",
  "pull-up", "chin-up", "inverted row", "dip", "squat", "jump squat", "split squat",
  "reverse lunge", "walking lunge", "lateral lunge", "glute bridge", "single-leg glute bridge",
  "hip thrust", "donkey kick", "fire hydrant", "calf raise", "step-up", "wall sit",
  "plank", "side plank", "mountain climber", "bicycle crunch", "dead bug", "bird dog",
  "hollow hold", "superman", "burpee", "jumping jack", "high knees", "skater jump",
  "tuck jump", "lateral bound", "bear crawl", "crab walk", "inchworm", "toe touches",
  "sit-up", "leg raise", "flutter kick", "russian twist", "v-up",
];

export const PRIORITY_PILATES = [
  "the hundred", "roll up", "roll-up", "single leg circle", "rolling like a ball",
  "single leg stretch", "double leg stretch", "scissors", "criss cross", "spine stretch forward",
  "open leg rocker", "corkscrew", "saw", "swan", "single leg kick", "double leg kick",
  "neck pull", "shoulder bridge", "spine twist", "jackknife", "side kick", "teaser",
  "swimming", "leg pull front", "leg pull back", "side bend", "boomerang", "seal",
  "pelvic curl", "chest lift", "leg lowers", "clam", "side lying leg lift", "mermaid",
  "cat cow", "table top", "hip roll", "arm circles", "spine articulation",
];

export const PRIORITY_RECOVERY = [
  "child's pose", "cat cow", "cat-cow", "thread the needle", "downward dog", "cobra",
  "sphinx", "supine spinal twist", "figure-4 stretch", "butterfly stretch",
  "seated forward fold", "hamstring stretch", "quad stretch", "couch stretch",
  "hip flexor stretch", "pigeon", "90/90 hip rotation", "deep squat hold", "ankle rocks",
  "calf stretch", "hip cars", "shoulder cars", "arm circles", "wall angels",
  "scapular wall slides", "doorway chest stretch", "cross-body shoulder stretch",
  "neck rotations", "thoracic rotation", "foam roll quads", "foam roll it band",
  "foam roll upper back", "foam roll glutes", "foam roll hamstrings", "foam roll calves",
  "single-leg balance", "single-leg rdl", "dead bug", "bird dog", "glute bridge",
  "box breathing", "diaphragmatic breathing",
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
 * Left = wording used in the exercise library, right = the coach's entry.
 * Applied before matching so "lever chest press", "lying triceps extension"
 * and "farmers walk" all resolve to their priority movement.
 */
const SYNONYMS: [RegExp, string][] = [
  [/\blever\b|\bleverage\b|\bmachine\b|\bsled\b(?= )/g, " "],
  [/\bsmith\b/g, "smith machine"],
  [/\bpulldown\b/g, "pulldown"],
  [/\bfarmers?\s+(walk|carry)\b/g, "farmer s carry"],
  [/\blying triceps extension\b|\blying tricep extension\b/g, "skull crusher"],
  [/\bfrench press\b/g, "triceps extension"],
  [/\bpush ?down\b/g, "pushdown"],
  [/\bchest fly\b|\bpectoral fly\b|\bbutterfly\b/g, "pec deck fly"],
  [/\bcurl up\b|\bcrunch floor\b/g, "sit up",],
  [/\bglute bridge (two legs|one leg)\b/g, "glute bridge"],
  [/\bhyperextension\b/g, "back extension"],
  [/\bsplit squat\b(?=.*bulgarian)|\bbulgarian\b/g, "bulgarian split squat"],
  [/\bstep up\b/g, "step up"],
  [/\bchin up\b/g, "chin up"],
  [/\bsissy squat\b/g, "squat"],
  [/\bseated row cable\b|\bcable seated row\b/g, "seated row"],
  [/\bfront pulldown\b|\bpull down\b/g, "lat pulldown"],
  [/\bstanding calf raise\b|\bheel raise\b/g, "calf raise"],
  [/\babduction\b/g, "hip abduction"],
  [/\badduction\b/g, "hip adduction"],
  [/\bknee extension\b/g, "leg extension"],
  [/\bknee flexion\b|\bhamstring curl\b/g, "leg curl"],
  [/\bmilitary press\b|\boverhead press\b/g, "overhead press"],
  [/\bsplit jump\b/g, "jump squat"],
  [/\bpress up\b/g, "push up"],
];

const canonical = (s: string) => {
  let n = norm(s);
  for (const [re, to] of SYNONYMS) n = n.replace(re, to);
  return norm(n);
};

const PRIORITY_NORMALISED = [...new Set(ALL_PRIORITY_NAMES.map(canonical))];
/** Token sets of each priority entry, for "same words, different order" matches. */
const PRIORITY_TOKENS = PRIORITY_NORMALISED.map((p) => p.split(" ").filter((t) => t.length > 2));

/**
 * Equipment the coach does NOT want promoted. These stay legal (they can still
 * appear occasionally) but are never marked preferred and sort last.
 */
const DEPRIORITISED_RE = /\bbosu\b/i;

/** Unsafe or unwanted pairings that must never be programmed at all. */
const FORBIDDEN_RE =
  /\bbosu\b.*\b(squat|deadlift|lunge|press|row|clean|snatch|jump)\b|\b(squat|deadlift|lunge|press|row|clean|snatch|jump)\b.*\bbosu\b/i;

/** Movements that must never be programmed (e.g. squatting on a bosu). */
export function isForbiddenName(name: string): boolean {
  return FORBIDDEN_RE.test(name);
}

/** Legal, but never promoted as a coach priority. */
export function isDeprioritisedName(name: string): boolean {
  return DEPRIORITISED_RE.test(name);
}

/**
 * True when a library exercise name is (or clearly means) one of the coach's
 * priority movements — "lever chest press", "cable crossover (high to low)",
 * "seated leg curl machine", "farmers walk" and "lying triceps extension" all
 * resolve to their priority entry even though the library wording differs.
 */
export function isPriorityName(name: string): boolean {
  const n = canonical(name);
  if (!n) return false;
  if (isDeprioritisedName(name) || isForbiddenName(name)) return false;
  if (PRIORITY_NORMALISED.some((p) => n === p || n.includes(p))) return true;
  // Fuzzy fallback: every meaningful word of a priority entry present in the
  // library name, in any order ("squat barbell full" -> "barbell squat").
  const words = new Set(n.split(" "));
  return PRIORITY_TOKENS.some((tokens) => tokens.length > 1 && tokens.every((t) => words.has(t)));
}

/** Resolves the ids in a library/pool that match the coach's priority list. */
export function priorityIds(list: { id: string; name: string }[]): Set<string> {
  return new Set(list.filter((e) => isPriorityName(e.name)).map((e) => e.id));
}
