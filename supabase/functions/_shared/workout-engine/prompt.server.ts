import type { PoolExercise } from "./pool.server.ts";
import { COACH_MINDSET, isPriorityName } from "../exercise-selection.ts";
import { planPrompt, type SessionPlan } from "./programming.ts";
import { ageDirective } from "./doctrine.ts";
import {
  BANNED_NAME_WORDS,
  intensityNote,
  type Category,
  type DifficultyLevel,
  type EquipmentMode,
  type Format,
  type StrengthFocus,
} from "./spec.ts";

const CATEGORY_COACHING: Record<Category, string> = {
  STRENGTH:
    "MAXIMAL STRENGTH, not hypertrophy. Heavy compound lifts first (squat, hinge, press, pull), then one or two secondary compounds, minimal isolation. 4-6 sets x 3-6 reps per main lift, load heavy, always leave 2-3 reps in reserve, NEVER train to failure. Tempo: controlled 2-sec lower, brief pause, explosive lift. Rest as prescribed in the session blueprint (never shorter to save time) and write that rest on every line. Fewer exercises, higher quality, full recovery between sets. In a gym, barbells, racks, benches, machines, cables, dumbbells, kettlebells and pull-ups are all normal and expected — there is time to set up and rest. Bodyweight variant: the hardest SAFE and FAMILIAR progression the athlete can do for 3-6 reps (elevated or weighted push-ups, split squats, step-ups, pull-up and inverted-row variations, hip thrusts) — never gymnastic skill work, never long high-rep sets.",
  "MUSCLE BUILDING":
    "HYPERTROPHY, not maximal strength. One or two compounds to open the session, then clear isolation and single-joint work for the target muscles. 3-4 sets x 8-12 reps on compounds, up to 15 reps on isolation, taken close to failure — 2-3 reps in reserve for beginners, 1-2 for intermediate and advanced, not routine absolute failure. Tempo: 2-3 sec controlled lower, squeeze the target muscle, controlled lift — suit the tempo to the movement and write it on every line. Rest 60-90 sec and write it on every line. Prioritise total working sets, time under tension and a full stretch under load; use different angles for the same muscle. Bodyweight variant: higher reps, slower eccentrics, unilateral and pre-fatigue variations to reach the same effort.",

  "CALORIE BURNING":
    "Maximum energy expenditure with large muscle groups. Bodyweight: burpees, jump squats, mountain climbers, plyo push-ups, jumping lunges. Equipment: kettlebell swings, dumbbell thrusters, rowing intervals, sled push, battle ropes.",
  METABOLIC:
    "Strength + conditioning blend with minimal rest, built on continuous human movement and fast transitions. Bodyweight: push/pull/squat/hinge circuits. Equipment: dumbbells, kettlebells, medicine or slam balls, TRX, bands, portable boxes, carries — dumbbell/kettlebell complexes, thrusters, swings, devil press. ABSOLUTELY FORBIDDEN: barbell work of any kind including barbell complexes, bench press, back squat, heavy deadlift, rack- or spotter-dependent lifts, cable and selectorized machine strength work.",
  CARDIO:
    "Sustained cardiovascular output built on REPEATABLE aerobic work: marching, jogging in place, step-ups, shuttle runs, jumping jacks, high knees, skaters, jump rope, rower, bike, ski erg, elliptical, stairs. HARD RULE: at most ONE high-fatigue conditioning movement (burpee, mountain climber, jump squat, squat jump, jumping lunge, swing, thruster, box jump, slam, clean, snatch) may appear in the whole Main Workout, and it may never make up half the block — this is aerobic training, not a metabolic session.",
  "MOBILITY & STABILITY":
    "Controlled mobility and stability ONLY: CARs, balance holds, bird dog, side bridge, cat-cow, ankle and wrist circles, slow breathing. Equipment variant: bands, balance board, foam roller, ball, rope-assisted stretches. HARD BAN: jumps, burpees, plyometrics, heavy strength, push-ups, crunches, sit-ups, dynamic leg-raise core, kettlebell power work, conditioning.",
  CHALLENGE:
    "Gamified benchmark work. Bodyweight: test-style AMRAP / For-Time pieces, multiple rounds, varied high-output patterns. Equipment: rounds-for-time, chippers, mixed modality — loaded conditioning, carries, swings, thrusters, rowing/bike/rope, squats, hinges, pushes, pulls, core under fatigue. HARD BAN in Main Workout and Finisher: stretching, mobility, yoga poses, static flexibility, recovery drills. Challenge means intensity, capacity, time pressure, reps, rounds and discomfort tolerance — never stretching.",
  PILATES:
    "A controlled Pilates session, always SETS & REPS. Equipment only when the athlete actually has it: mat, small Pilates ball, bands, magic circle/ring, roller, block, Pilates chair, reformer, Cadillac, barrel, straps. Never assume a reformer exists. When no equipment is available the session is bodyweight Pilates: spinal articulation, deep core control, controlled leg and trunk work, hip mobility, glute activation, stability. Preparation may open the session and must match what follows (spine work before spinal sessions, trunk activation before core sessions, hip prep before hip sessions) — never random warm-up drills. Activation is optional, low-fatigue and relevant. FORBIDDEN: Tabata, AMRAP, EMOM, For Time, circuits, HIIT, metabolic or calorie finishers, burpees, jumping, plyometrics, kettlebells, barbells, heavy loading, sprinting, any finisher at all. Prioritise control, precision, breathing and quality of movement over speed or fatigue; keep positions and equipment flowing with minimal changes.",
  RECOVERY:
    "Controlled recovery work only: nasal and box breathing, CARs, gentle mobility, controlled low-effort movement, light static stretching where appropriate, relaxation and movement quality. The format is written as MIX, and MIX in RECOVERY means ONLY these gentle recovery modalities blended together — never a strength portion and never a metabolic portion. FORBIDDEN: strength training, conditioning, HIIT, metabolic work, fatigue-based training, plyometrics, jumping, sprinting, running, kettlebell swings, push-ups, pull-ups, crunches or sit-ups, loaded implements (barbell, kettlebell, machine, cable, sled) and any Finisher section.",
  "MICRO-WORKOUTS":
    "A 10-minute equipment-free movement break — NOT a shortened gym workout. Think: office break, desk, sofa, hotel room, small room, between meetings. Bodyweight only, plus the environment: floor, wall, chair, desk, table, sofa, bed, stairs, small available space (these are environmental resources, not equipment). ABSOLUTELY FORBIDDEN: dumbbells, kettlebells, barbells, bands, TRX, machines, cables, plates, benches, medicine or slam balls, bike, rower, rope, treadmill, sled, doorways or pull-up bars — even for an advanced athlete. Advanced here means a little more density and range on the SAME simple movements — never harder leverage, never equipment, never gymnastic or skill work, never a sweaty high-intensity session. ONE short coherent block: no separate Soft Tissue, no separate Activation, no Finisher, no Cool Down — the first movement doubles as the preparation. Keep the athlete in roughly the same spot with minimal transitions (floor sequences together, desk/chair sequences together, stair sequences together). The only legal shape is REPS & SETS — a short movement-break sequence. NEVER Circuit, AMRAP, EMOM, For Time, Tabata or any conditioning format, even for an advanced athlete. Prefer plain, immediately executable patterns: squats, sit-to-stands, chair or desk push-ups, wall push-ups, lunges, calf raises, marching in place, gentle trunk and mobility movements. Keep the dose light: 2-3 sets, short rest (20-40 sec), well short of failure, no long rests and no fatigue chasing. The purpose is movement, activation and breaking sedentary time; short does not mean 20 burpees. It must be immediately executable in office clothes with zero setup.",
};

const FORMAT_RULES: Record<Format, string> = {
  AMRAP:
    'Header "Main Workout (AMRAP)". State the time cap in its own paragraph. 4-6 exercises. Reps written BEFORE each token.',
  EMOM:
    'Header "Main Workout (EMOM)". Every minute labelled "Minute N:". Declare total minutes and rounds. Dose written BEFORE each token.',
  CIRCUIT:
    'Header "Main Workout (CIRCUIT)". State rounds and rest in their own paragraph. 5-7 stations.',
  TABATA:
    'Header "Main Workout (TABATA)". 8 rounds of 20 sec work / 10 sec rest. Write "20 sec" before EVERY token.',
  "FOR TIME":
    'Header "Main Workout (For Time)". Chipper or rounds-for-time, reps written BEFORE every token, declare the cap or rounds.',
  "REPS & SETS":
    'Header "Main Workout (REPS & SETS)". Every line looks like: "4 sets × 8 reps {{exercise:ID:Name}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 90 sec". Sets 1-6, reps 1-25.',
  MIX: 'Header "Main Workout (MIX)". A prescribed REPS & SETS strength portion followed by a prescribed metabolic finisher portion.',
};

/**
 * The generic MIX definition (strength + metabolic) must never leak into
 * RECOVERY: there MIX is only a technical label for blended gentle recovery
 * modalities.
 */
function formatRule(category: Category, format: Format): string {
  if (category === "RECOVERY")
    return 'Header "Main Workout (MIX)". In RECOVERY, MIX means a blend of GENTLE RECOVERY MODALITIES only: breathing, CARs and gentle mobility, controlled low-effort movement and light stretching, each with a written dose (reps, seconds or breaths). There is NO strength portion, NO metabolic portion and NO Finisher.';
  return FORMAT_RULES[format];
}

const FOCUS_RULES: Record<StrengthFocus, string> = {
  "LOWER BODY":
    "ALLOWED: squats, lunges, leg press, hip thrusts, leg curls/extensions, calf raises, step-ups, Bulgarian splits. FORBIDDEN: any upper-body press/pull/arm work.",
  "UPPER BODY":
    "ALLOWED: pressing, pulling, curls, extensions, rows, flys, pulldowns, push-ups, dips. FORBIDDEN: squats, lunges, leg press, deadlifts, hip thrusts, leg curls, calf raises.",
  "FULL BODY": "ALLOWED: upper push, upper pull, lower push, lower pull, core.",
  "LOW PUSH & UPPER PULL":
    "ALLOWED: squats, lunges, leg press, step-ups, hip thrusts, rows, pull-ups, pulldowns, curls, face pulls. FORBIDDEN: deadlifts, RDLs, leg curls, bench/shoulder press, push-ups, triceps.",
  "LOW PULL & UPPER PUSH":
    "ALLOWED: deadlifts, RDLs, leg curls, hinges, glute-ham raises, bench/shoulder press, push-ups, triceps, dips, flys. FORBIDDEN: squats, lunges, leg press, step-ups, rows, pull-ups, curls.",
  "CORE & GLUTES":
    "ALLOWED: anti-rotation, planks, dead bugs, pallof press, bird dogs, hip thrusts, glute bridges, banded work, kickbacks, clamshells. FORBIDDEN: squats, bench, rows, shoulder press, big compounds, arm isolation.",
  PUSH:
    "ALLOWED: chest presses and flys, shoulder presses and raises, triceps extensions, push-ups, dips. FORBIDDEN: any pulling (rows, pull-ups, pulldowns, curls, face pulls) and all leg work.",
  PULL:
    "ALLOWED: rows, pull-ups, chin-ups, pulldowns, pullovers, face pulls, shrugs, biceps and forearm work. FORBIDDEN: any pressing (bench, shoulder press, push-ups, dips, triceps) and all leg work.",
  CHEST:
    "ALLOWED: chest presses (flat, incline, decline), flys, cable crossovers, push-up variations, dips leaning forward. FORBIDDEN: back, legs and dedicated arm or shoulder isolation.",
  BACK:
    "ALLOWED: rows, pull-ups, chin-ups, pulldowns, pullovers, shrugs, back extensions, face pulls. FORBIDDEN: chest, shoulders pressing, legs and dedicated arm isolation.",
  SHOULDERS:
    "ALLOWED: overhead and landmine presses, lateral, front and rear raises, upright rows, face pulls, shrugs. FORBIDDEN: chest, back, legs and arm isolation.",
  ARMS:
    "ALLOWED: biceps curls in every variation, triceps extensions, pushdowns, skull crushers, close-grip pressing, forearm and wrist work. FORBIDDEN: legs, chest, back and shoulder training beyond what an arm exercise needs.",
  LEGS:
    "ALLOWED: squats, lunges, leg press, hinges, deadlifts, leg curls and extensions, hip thrusts, step-ups, calf raises. FORBIDDEN: all upper-body pressing, pulling and arm work.",
};


export type AthleteContext = {
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  fitness_level?: string | null;
  primary_goal?: string | null;
  secondary_goal?: string | null;
  preferred_environment?: string | null;
  /** Exact library names resolved from the athlete's picked favourite ids. */
  favorite_library?: string[] | null;
  /** Exact library names resolved from the athlete's picked disliked ids. */
  disliked_library?: string[] | null;
  /** Logged sets from previous sessions, used for progressive overload. */
  recent_performance?: string[] | null;
  limitations?: string[] | null;
  location?: string | null;
  mood?: string | null;
  recent_feedback?: string[] | null;
};


function athleteBlock(a?: AthleteContext): string {
  if (!a) return "";
  const lines: string[] = [];
  const bio = [
    a.age ? `${a.age} yrs` : "",
    a.gender || "",
    a.height_cm ? `${a.height_cm} cm` : "",
    a.weight_kg ? `${a.weight_kg} kg` : "",
  ].filter(Boolean).join(", ");
  if (bio) lines.push(`Biometrics: ${bio}`);
  const ageRule = ageDirective(a.age ?? null);
  if (ageRule) lines.push(`AGE-APPROPRIATE PROGRAMMING (hard rule): ${ageRule}`);
  if (a.fitness_level) lines.push(`Fitness level: ${a.fitness_level}`);
  if (a.primary_goal) lines.push(`Primary goal: ${a.primary_goal}`);
  if (a.secondary_goal) lines.push(`Secondary goal: ${a.secondary_goal}`);
  if (a.preferred_environment) lines.push(`Usual training environment: ${a.preferred_environment}`);
  if (a.location) lines.push(`Training today at: ${a.location}`);
  if (a.mood) lines.push(`Feeling today: ${a.mood}`);
  if (a.favorite_library?.length)
    lines.push(
      `FAVOURITE library exercises (exact matches the athlete picked — program at least one when it fits the category, focus and equipment): ${a.favorite_library.join(", ")}`,
    );
  if (a.disliked_library?.length)
    lines.push(
      `BANNED library exercises (already removed from your vocabulary — never write them or a close variation): ${a.disliked_library.join(", ")}`,
    );
  if (a.limitations?.length)
    lines.push(
      `INJURIES / LIMITATIONS (must be respected, choose safe alternatives): ${a.limitations.join(", ")}`,
    );
  if (a.recent_performance?.length)
    lines.push(
      `LOGGED PERFORMANCE (what they actually completed recently — apply progressive overload: add reps, load or a harder variation when the same movement returns, never regress without a reason):\n${a.recent_performance
        .map((p) => `  · ${p}`)
        .join("\n")}`,
    );

  if (a.recent_feedback?.length)
    lines.push(
      `FEEDBACK FROM RECENT SESSIONS (adapt to it — if the athlete said "Too Easy" progress the load/volume, if "Very Hard" or "Exhausted" pull it back, avoid what they did not enjoy or would not repeat, and honour anything written in their comments):\n${a.recent_feedback
        .map((f) => `  · ${f}`)
        .join("\n")}`,
    );
  if (!lines.length) return "";

  return `ATHLETE PROFILE — read this before writing a single line. The session must respect every point.\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
}

export type PromptInput = {
  category: Category;
  format: Format;
  equipmentMode: EquipmentMode;
  selectedEquipment: string[];
  customEquipment?: string[];
  level: DifficultyLevel;
  stars: number;
  duration: string;
  focus?: StrengthFocus | null;
  note?: string;
  athlete?: AthleteContext;
  pool: PoolExercise[];
  /** Separate approved vocabulary for 🔥 Activation. */
  activationPool?: PoolExercise[];
  /** Separate approved vocabulary for 🧘 Cool Down. */
  cooldownPool?: PoolExercise[];
  bannedNames: string[];
  /** Deterministic session blueprint the model must satisfy. */
  plan?: SessionPlan;
};

const poolTable = (list: PoolExercise[], withCue = false) =>
  list
    .map((e) => {
      const base = `${e.id}|${e.name}|${e.body_part ?? "-"}|${e.target_muscle ?? "-"}|${e.equipment ?? "-"}|${e.difficulty ?? "-"}`;
      if (!withCue) return base;
      return `${base}|${isPriorityName(e.name) ? "PREFERRED" : "-"}|${e.cue ?? "-"}`;
    })
    .join("\n");



/** Keeps prompt size sane while covering every body part. */
function trimPrep(list: PoolExercise[], max: number): PoolExercise[] {
  if (list.length <= max) return list;
  const byPart = new Map<string, PoolExercise[]>();
  for (const e of list) {
    const key = e.body_part ?? "other";
    if (!byPart.has(key)) byPart.set(key, []);
    byPart.get(key)!.push(e);
  }
  const per = Math.max(4, Math.ceil(max / Math.max(1, byPart.size)));
  const out: PoolExercise[] = [];
  for (const items of byPart.values()) out.push(...items.slice(0, per));
  return out.slice(0, max);
}


export function buildWorkoutPrompt(input: PromptInput): { system: string; user: string } {
  const isRecovery = input.category === "RECOVERY";
  const isMicro = input.category === "MICRO-WORKOUTS";

  const isPilates = input.category === "PILATES";

  const sections = isMicro
    ? `MICRO-WORKOUT STRUCTURE (10 minutes, ONE section only):
1. 💪 Main Workout — the entire workout, library tokens only
NO 🧽 Soft Tissue Preparation. NO 🔥 Activation. NO ⚡ Finisher. NO 🧘 Cool Down. Output the 💪 Main Workout section and nothing else.`
    : isPilates
      ? `PILATES STRUCTURE (NO Finisher, ever):
1. 🧽 Soft Tissue Preparation — foam rolling only, NO {{exercise:}} tokens at all
2. 🔥 Activation — relevant, controlled preparation tokens for the patterns that follow
3. 💪 Main Workout (REPS & SETS) — controlled Pilates work, library exercises
4. 🧘 Cool Down — token stretches then one breathing line`
    : isRecovery
      ? `RECOVERY STRUCTURE (4 sections, NO Finisher):
1. 🧽 Soft Tissue Preparation
2. 🔥 Activation
3. 💪 Main Workout
4. 🧘 Cool Down`
      : `MANDATORY STRUCTURE (5 sections, exact icons and order):
1. 🧽 Soft Tissue Preparation — foam rolling only, NO {{exercise:}} tokens at all
2. 🔥 Activation — 4 lines, EVERY line a token from the ACTIVATION LIST
3. 💪 Main Workout — library exercises, minimum 4
4. ⚡ Finisher — library exercises, minimum 3
5. 🧘 Cool Down — 3 lines, EVERY line a token from the COOL DOWN LIST, then one breathing line`;

  const poolText = poolTable(input.pool, true);
  const priorityCount = input.pool.filter((e) => isPriorityName(e.name)).length;
  const activationText = poolTable(trimPrep(input.activationPool ?? [], 90));
  const cooldownText = poolTable(trimPrep(input.cooldownPool ?? [], 70));

  const system = `${COACH_MINDSET}

You are a Sports Scientist (CSCS). You write precise, safe, professional training sessions.

LIBRARY-FIRST RULE (non-negotiable)
- Every exercise reference MUST be written as {{exercise:ID:Name}} using an ID and the EXACT name from the approved library below (e.g. {{exercise:0043:barbell full squat}}).
- Never invent an exercise. Never write a plain exercise name without markup. Slug ids such as {{exercise:bird-dog:...}} are forbidden.
- Exception: the 🧽 Soft Tissue Preparation section contains NO tokens at all.

SOFT TISSUE PREPARATION IS ALWAYS POSSIBLE
- It is coaching text, not equipment. When no roller or ball is available, prescribe hands-on and floor-based self-release instead (hand/knuckle release, floor-assisted glute and calf release, wall-assisted thoracic release, joint circles) — 2 to 4 lines with time doses.
- Never omit this section, never write "omitted because no equipment", and never call it a conflict with a bodyweight allowance.

NEVER REFUSE
- You always return a complete workout. Never answer with an explanation, an apology or a note saying the library lacks options: build the best safe, simple session from the rows supplied, repeating a pattern with a different dose if needed.

COACHING STANDARD (how a professional S&C coach programmes)
- Sequence by nervous-system cost: most technical and heaviest first, then accessory, then metabolic, then core. Never fatigue a stabiliser before the lift that needs it.
- Every prescription is measurable and repeatable: sets, reps or seconds, tempo and rest all written on the line.
- Balance the session: for every press there is a pull, for every knee-dominant pattern a hip-dominant one, unless the athlete asked for a specific split.
- Keep the session runnable: minimise equipment changes, group work that shares an implement or a position, and never build a circuit that needs three stations at once.
- Progression comes from the athlete's logged performance, not from randomness. If a movement returns, it returns slightly harder.
- Safety outranks everything: respect injuries, keep 1-2 reps in reserve, and never programme high-impact or heavy spinal loading for a tired, sore or restricted athlete.
- SIMPLICITY RULE: always choose the simplest, most common, most understandable version of a movement that delivers the stimulus. No circus or gymnastic skill work (levers, planches, flags, muscle-ups, handstands, pistols), no exotic or gimmick variations, no unstable-surface loading (never a squat, deadlift, lunge or press on a bosu). If two exercises train the same thing, programme the one a normal member already recognises.
- POOL RULE: Strength draws on free weights first then machines; Muscle Building on machines first then free weights; Calorie Burning and Metabolic on bodyweight plus free weights; Cardio and Micro Workouts on bodyweight; Challenge on free weights plus bodyweight; Mobility & Stability and Recovery on mobility, stretching and stability work only; Pilates on Pilates work only. How the athlete feels today changes sets, reps, rest and exercise count — never the pool.

DECISION ORDER (read in this exact order, top wins every conflict)
1. TRAINER MINDSET — you are Haris Falas programming for a real person. Safety, sense and coaching quality outrank every input below.
2. CATEGORY — what training effect is being bought today (Strength, Muscle Building, Cardio, Metabolic, Pilates, Recovery, ...). The category decides the stimulus, the shape of the session, the rest, the dose and the kind of movement. Decide this BEFORE you look at anything else.
3. EXERCISE SELECTION — choose the movements that actually deliver that stimulus, from the approved library only.
4. CONSTRAINTS — equipment, location, difficulty, time and focus then shape what you already decided. They can limit or substitute a choice; they can never change the category's intent.
5. PREFERENCES — the athlete's favourites and today's note break ties INSIDE what steps 2-4 already allow, and nothing more.

EQUIPMENT IS AVAILABLE, NEVER MANDATORY
- The equipment list says what the athlete HAS today, not what the session must contain. Owning a full gym does not put a machine in a Recovery or Pilates session; owning kettlebells does not force kettlebells into a Cardio session.
- Use apparatus only where it genuinely serves the category. A Cardio session may carry two or three loaded movements at most and stay aerobic and repeatable; Pilates, Recovery and Mobility sessions stay with their own modalities whatever the athlete owns.
- The athlete always has their own bodyweight, so bodyweight movements are fully legitimate alongside the chosen kit in every category except Strength and Muscle Building, where external load is the stimulus.
- What is NEVER allowed is the opposite direction: apparatus that is not on the list, in any section.

PREFERENCES NEVER OVERRIDE THE CATEGORY
- A favourite exercise or a note ("I love running") is honoured only when that movement belongs in today's category. Running belongs in Cardio, not in Muscle Building. When a preference is irrelevant to the category, ignore it silently and program correctly — never bend the session to fit it.

${sections}

SECTION TITLE HTML (one icon per section):
<p class="tiptap-paragraph">🔥 <strong><u>Activation 5'</u></strong></p>
Between sections output exactly one empty paragraph: <p class="tiptap-paragraph"></p>

EXERCISE LINE HTML (bullet lists only):
<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">12 reps {{exercise:ID:Name}}</p></li></ul>

SOFT TISSUE RULES — lines may only start with: Foam roll, Foam-roll, Foam roller, Lacrosse ball, Tennis ball, Trigger point, Self-massage, Myofascial release, or "... release". Forbidden there: tokens, stretch, circle, raise, swing, lunge, pose, march, bridge, squat, press, row, curl, twist, hydrant, cobra, cat-cow, sun salutation. Dynamic stretches belong in Activation, static stretches in Cool Down.

ACTIVATION RULES (non-negotiable) — Activation is MOVEMENT PREPARATION, never training.
- Use ONLY ids from the ACTIVATION LIST below. Ids from the main library are rejected there.
- Exactly 4 bullets, every one carrying a token: "10 reps {{exercise:ID:Name}}" or "30 sec {{exercise:ID:Name}}". Plain-text drills are rejected.
- Never near failure, never a strength or high-impact movement, no external load.

COOL DOWN RULES (non-negotiable)
- Use ONLY ids from the COOL DOWN LIST below. Ids from the main library are rejected there.
- Exactly 3 token bullets ("45 sec {{exercise:ID:Name}} — breathe out into the position") followed by ONE plain breathing line.
- Never a loaded, dynamic or conditioning movement.




PRESCRIPTION RULES
- The measurable dose ALWAYS comes BEFORE the token: "15 reps {{exercise:1160:burpee}}", "40 sec {{exercise:0630:mountain climber}}", "200m {{exercise:0685:run}}".
- Forbidden: naked tokens, dose after the token, compact tempo codes such as 20X0 or 31X1 (write readable coaching language instead).
- Tempo and rest stay inline on the SAME list item as the token. Never create a bullet that only contains a tempo or "rest 90 sec".
- Accepted units: reps, sec, min, m, km, cal, rounds, "N sets × N", "EMOM Minute N:".
- Protocol headers look like "Main Workout (FORMAT)" and NEVER contain a duration.
- Finisher header: "Finisher (REPS & SETS)" for STRENGTH / MUSCLE BUILDING / MOBILITY & STABILITY, otherwise "Finisher (For Time)" or "Finisher (AMRAP)" with the cap or rounds in the paragraph below.

NAMING
2-4 word creative name hinting at the category${input.focus ? " and focus" : ""}. Avoid these words: ${BANNED_NAME_WORDS.join(", ")}. Strictly forbidden: internal codes (CAL-813, BW1230, V2, #3), roman numerals, any digits, and 3-letter uppercase abbreviations with numbers.

OUTPUT — pure JSON, no markdown fences, exactly:
{"name":"...","description":"<p class=\\"tiptap-paragraph\\">2-3 sentences tied to the category.</p>","main_workout":"full structured HTML with library-first markup","instructions":"<p class=\\"tiptap-paragraph\\">How to perform this workout</p>","tips":"<p class=\\"tiptap-paragraph\\">Tip 1</p><p class=\\"tiptap-paragraph\\">Tip 2</p><p class=\\"tiptap-paragraph\\">Tip 3</p>"}
The "main_workout" field contains ALL sections joined in order.`;

  const user = `WORKOUT REQUEST
Category (DECIDE THE SESSION FROM THIS FIRST): ${input.category}
Equipment the athlete HAS today (a ceiling, not a shopping list): ${[...input.selectedEquipment.filter((x) => x !== "other"), ...(input.customEquipment ?? [])].join(", ")}
Never use any apparatus outside this list, even during Activation or Cool Down. You are never obliged to use all of it — use only what the category genuinely calls for, and use the athlete's own bodyweight freely wherever it serves the session better.
Difficulty: ${input.stars} of 3 stars (${input.level.toUpperCase()}) — one star is one level, do not mix levels
Intensity within the level: ${intensityNote(input.stars)}
Format: ${input.format}
Duration: ${input.duration}${input.focus ? `\nFocus: ${input.focus}` : ""}
${
  input.note
    ? `TODAY'S REQUEST FROM THE ATHLETE (obey it literally — but it ranks BELOW safety and BELOW the category, per the DECISION ORDER):
"${input.note}"
- Anything they asked to avoid is already removed from your vocabulary; never write it or a close variation.
- Anything they said they prefer must appear in 💪 Main Workout or ⚡ Finisher ONLY when it genuinely belongs in today's category, focus and equipment — otherwise ignore it silently and program the category correctly. Never turn the whole session into that one thing.
- Anything else they asked for (pace, feel, a body part, less jumping, more core) must be visibly reflected in the session, within the category's rules.`
    : ""
}


${athleteBlock(input.athlete)}

CATEGORY COACHING RULES
${CATEGORY_COACHING[input.category]}

FORMAT WRITING RULES
${formatRule(input.category, input.format)}
${input.focus ? `\nFOCUS SPLIT RULES\n${FOCUS_RULES[input.focus]}` : ""}

${input.plan ? planPrompt(input.plan) : ""}

QUALITY GATE (your workout is rejected if it fails)
- Every count, rep range, rest window and transition budget in the SESSION BLUEPRINT above.
- Main Workout at least ${input.plan ? input.plan.mainCount[0] : 4} exercises; ${input.plan && !input.plan.finisher ? "no Finisher section at all" : `Finisher at least ${input.plan ? input.plan.finisherCount[0] : 3}`}.
- Activation exactly 4 token lines from the ACTIVATION LIST; Cool Down exactly 3 token lines from the COOL DOWN LIST.
- Every token line in 💪 and ⚡ carries a dose BEFORE the token.
- The protocol structure (minutes, rounds, cap, ladder, 20/10 x 8) must be declared in writing.
- Advertised duration counts 💪 Main + ⚡ Finisher only and must reach the requested "${input.duration}".
- DO THE ARITHMETIC BEFORE YOU WRITE: add up (sets × work time) + (sets × rest) for every 💪 and ⚡ line. That total MUST land within ±10% of the requested "${input.duration}" — not under it, not over it. Too short and too long are both automatic rejections: add sets or exercises when short, remove sets or shorten rest when long.
- Budget the whole session too: 🧽 + 🔥 + 💪 + ⚡ + 🧘 together must stay inside roughly "${input.duration}" plus a short warm-up and cool-down allowance. Keep 🧽 under 3 min, 🔥 under 5 min and 🧘 under 5 min; the training minutes belong to 💪 and ⚡.
- 🔥 Activation must prepare the SAME region the Main Workout trains: if the Main Workout is lower-body dominant, at least 3 of the 4 activation lines must be hip, glute, knee or ankle drills; if it is upper-body dominant, at least 3 must be shoulder, scapula, thoracic or arm drills.

NAMES ALREADY USED (never reuse):
${input.bannedNames.slice(0, 120).join(", ") || "none"}

APPROVED EXERCISE LIBRARY for 💪 Main Workout and ⚡ Finisher — the ONLY allowed vocabulary there (id|name|body part|target|equipment|difficulty|preference|technique cue)
- Rows marked PREFERRED are the coach's priority vocabulary (the stations and movements Haris Falas programmes first). ${priorityCount ? `There are ${priorityCount} of them below.` : ""} Build the session from PREFERRED rows whenever they fit the category, focus, difficulty and equipment, and only reach for the rest when they cannot cover a pattern the session needs.
- The technique cue is the coaching point of that exercise. Use it to choose the right movement and to write accurate tempo and execution language — never copy it verbatim into the workout.
${poolText}

ACTIVATION LIST — the ONLY allowed vocabulary for 🔥 Activation
${activationText || "none — write no Activation tokens"}

COOL DOWN LIST — the ONLY allowed vocabulary for 🧘 Cool Down
${cooldownText || "none — write no Cool Down tokens"}

Return the JSON now.`;


  return { system, user };
}
