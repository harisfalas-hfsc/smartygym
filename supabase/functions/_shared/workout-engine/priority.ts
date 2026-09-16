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

const PRIORITY_NORMALISED = [...new Set(ALL_PRIORITY_NAMES.map(norm))];

/**
 * True when a library exercise name is (or clearly contains) one of the
 * coach's priority movements — "barbell hip thrust", "cable crossover (high to
 * low)" and "seated leg curl machine" all resolve to their priority entry.
 */
export function isPriorityName(name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return PRIORITY_NORMALISED.some((p) => n === p || n.includes(p));
}

/** Resolves the ids in a library/pool that match the coach's priority list. */
export function priorityIds(list: { id: string; name: string }[]): Set<string> {
  return new Set(list.filter((e) => isPriorityName(e.name)).map((e) => e.id));
}
