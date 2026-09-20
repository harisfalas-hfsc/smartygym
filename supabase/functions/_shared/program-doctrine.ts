import {
  categoryExerciseViolation,
  dynamicExerciseViolation,
  finisherSizeViolation,
  humanRealismViolation,
  workSlotPrepViolation,
  type ExerciseLike,
} from "./workout-engine/doctrine.ts";
import type { Category, Format } from "./workout-engine/spec.ts";
import { isSelectable } from "./exercise-selection.ts";

/**
 * ONE source of truth for training-program category rules.
 *
 * Every program category is expressed as the Smarty Workout categories it
 * inherits. A day inside a program must behave exactly like a standalone
 * workout of those categories — the picker, the generator prose and the
 * compliance audit all read this table and nothing else.
 */
export type ProgramDoctrine = {
  /** Primary workout category this program category maps onto. */
  workoutCategory: Category;
  /** Every workout category whose rules the program may legally borrow. */
  companionCategories: Category[];
  mainFormats: Format[];
  finisherFormat: Format | null;
  /** Library-name intent filters (moved here from the picker). */
  preferred: RegExp[];
  forbidden: RegExp[];
  allowCardioBodyPart: boolean;
  rejectCardioBodyPart: boolean;
  /** Timed/distance locomotion (run, jog, shuttle, bike, row) belongs in the day. */
  locomotion: "required" | "optional" | "none";
  /** Blend restorative breathing / down-regulation into the session. */
  recoveryCharacter: boolean;
  /** Bodyweight sets must be taken close to technical failure. */
  bodyweightToFailure: boolean;
  adaptation: string;
  progression: string;
  philosophy: string;
};

const PROGRAM_DOCTRINE: Record<string, ProgramDoctrine> = {
  "CARDIO ENDURANCE": {
    workoutCategory: "CARDIO",
    companionCategories: ["CARDIO", "METABOLIC"],
    mainFormats: ["AMRAP", "EMOM", "CIRCUIT"],
    finisherFormat: "FOR TIME",
    preferred: [/walk|run|jog|step|jump\s*rope|rope|mountain\s*climber|jumping\s*jack|high\s*knee|burpee|bear\s*crawl|squat|lunge|push\s*up|skater|fast\s*feet|bike|row|elliptical|ski\s*erg|cardio/i],
    forbidden: [/sissy\s*squat|pistol|one\s*leg\s*squat|bench\s*press|deadlift|max|heavy|curl|triceps?\s*extension|calf\s*raise/i],
    allowCardioBodyPart: true,
    rejectCardioBodyPart: false,
    locomotion: "required",
    recoveryCharacter: false,
    bodyweightToFailure: false,
    adaptation:
      "Adaptation target: aerobic capacity, stamina, pacing, and sustained work. Every day carries real locomotion — timed or distance running, walk-run intervals, shuttle runs, tempo efforts, or the bike / rower / treadmill / elliptical equivalent — supported by simple repeatable calisthenics. Never maximal strength or elite skill work.",
    progression:
      "Progress by distance and pace first: extend the continuous run or main interval, then hold the same distance at a slightly stronger pace, then trim recovery. Add work before adding speed, and never both in the same week.",
    philosophy:
      "Zone-based endurance: Zone 2 base, threshold work, and controlled intervals, combined with locomotion (running, shuttle runs, bike, rower) and complementary indoor conditioning. Periodized base → intensity → peak.",
  },
  "FUNCTIONAL STRENGTH": {
    workoutCategory: "STRENGTH",
    companionCategories: ["STRENGTH"],
    mainFormats: ["REPS & SETS"],
    finisherFormat: "REPS & SETS",
    preferred: [/push\s*up|pull\s*up|chin\s*up|\bdip\b|split\s*squat|lunge|single\s*leg\s*rdl|rdl|deadlift|plank|side\s*plank|bear\s*crawl|goblet\s*squat|kettlebell|dumbbell\s*row|row|bench\s*press|floor\s*press|shoulder\s*press|farmer|carry|squat|press|hinge/i],
    forbidden: [/jumping\s*jack|high\s*knee|mountain\s*climber|burpee|skater|fast\s*feet|run|jog|elliptical|bike/i],
    allowCardioBodyPart: false,
    rejectCardioBodyPart: true,
    locomotion: "none",
    recoveryCharacter: false,
    bodyweightToFailure: false,
    adaptation:
      "Adaptation target: practical force production and movement quality. Exercise selection must favor presses, rows, squats, hinges, carries, split squats, planks, and pull-ups/chin-ups/dips when equipment and level allow — never endless cardio circuits.",
    progression:
      "Progress by load and movement quality: add 2–5% load when every rep is clean, then add one set or extend carry distance before increasing complexity.",
    philosophy:
      "Real-world strength: free-weight bias (deadlifts, squats, presses, pulls), carries, and swings, with sets and reps as the only format. Not bodybuilding.",
  },
  "MUSCLE HYPERTROPHY": {
    workoutCategory: "MUSCLE BUILDING",
    companionCategories: ["MUSCLE BUILDING", "STRENGTH"],
    mainFormats: ["REPS & SETS"],
    finisherFormat: "REPS & SETS",
    preferred: [/press|bench|row|pulldown|pull\s*up|chin\s*up|\bdip\b|squat|split\s*squat|bulgarian|rdl|deadlift|leg\s*press|shoulder\s*press|curl|extension|raise|fly|glute\s*bridge|push\s*up|lat|chest|biceps|triceps|quad|hamstring/i],
    forbidden: [/tabata|amrap|emom|burpee|jumping\s*jack|high\s*knee|mountain\s*climber|skater|fast\s*feet|run|jog|bike|elliptical|pistol|one\s*leg\s*squat/i],
    allowCardioBodyPart: false,
    rejectCardioBodyPart: true,
    locomotion: "none",
    recoveryCharacter: false,
    bodyweightToFailure: true,
    adaptation:
      "Adaptation target: muscle size through mechanical tension and training volume. Exercise selection must favor 6–15 rep compound and accessory work with controlled tempo and full rest. When the program is bodyweight, working sets are taken close to technical failure because load cannot be added.",
    progression:
      "Progress by load: roughly 65% 1RM in Week 1, 70% in Week 2, 75% in Week 3, 80% in Week 4, then small load, set, or rep increases without breaking tempo. On bodyweight days progress reps to failure, then tempo, then the harder listed variation.",
    philosophy:
      "Periodized hypertrophy with proper splits. Progressive overload, planned deloads, compound plus isolation work, 60–120 sec rest, tracked sets/reps/tempo.",
  },
  "WEIGHT LOSS": {
    workoutCategory: "CALORIE BURNING",
    companionCategories: ["CALORIE BURNING", "METABOLIC"],
    mainFormats: ["CIRCUIT", "TABATA", "EMOM", "AMRAP"],
    finisherFormat: "TABATA",
    preferred: [/squat|lunge|push\s*up|incline\s*push|step|mountain\s*climber|jumping\s*jack|jack\s*jump|star\s*jump|scissor\s*jump|high\s*knee|butt\s*kick|burpee|bear\s*crawl|dead\s*bug|glute\s*bridge|plank|skater|fast\s*feet|walk|run|jog|bike|row|swing|thruster|crawl/i],
    forbidden: [/sissy\s*squat|pistol|one\s*leg\s*squat|max|heavy|one\s*rep|bench\s*press|leg\s*press|preacher\s*curl|concentration\s*curl|step[ -]?up/i],
    allowCardioBodyPart: true,
    rejectCardioBodyPart: false,
    locomotion: "optional",
    recoveryCharacter: false,
    bodyweightToFailure: false,
    adaptation:
      "Adaptation target: caloric expenditure, continuous movement, work capacity, and elevated heart rate — metabolic and calorie-burning rules together. Exercise selection must favor squats, lunges, push-ups, mountain climbers, jumping jacks, burpees, high knees, bear crawls, bridges, and planks. Light locomotion may support a session but never replaces it.",
    progression:
      "Progress by density: raise work periods by about 10%, cut rest by about 10%, then add one round or move to the harder listed variation while movement quality stays realistic.",
    philosophy:
      "Strategic blend of metabolic conditioning and calorie-burning circuits with strength retention. Wave the intensity, avoid daily HIIT.",
  },
  "MOBILITY & STABILITY": {
    workoutCategory: "MOBILITY & STABILITY",
    companionCategories: ["MOBILITY & STABILITY", "RECOVERY"],
    mainFormats: ["REPS & SETS"],
    finisherFormat: null,
    preferred: [/world.?s\s*greatest\s*stretch|90\/?90|thoracic|rotation|deep\s*squat|single\s*leg\s*balance|bird\s*dog|dead\s*bug|hip\s*airplane|shoulder|ankle|mobility|stretch|balance|cat\s*cow|cat\s*camel|circle|cars?|plank|stability/i],
    forbidden: [/burpee|sprint|run|jump|box|thruster|snatch|clean|swing|high\s*knee|mountain\s*climber|jack|heavy/i],
    allowCardioBodyPart: false,
    rejectCardioBodyPart: true,
    locomotion: "none",
    recoveryCharacter: true,
    bodyweightToFailure: false,
    adaptation:
      "Adaptation target: mobility, joint control, balance, and movement quality, blended with recovery character. Sets, reps, and timed holds only, with breathing and down-regulation built into every session — never AMRAP, EMOM, Tabata, HIIT, sprints, burpees, or jump training.",
    progression:
      "Progress through range, control, hold duration, and balance complexity; never force depth or speed.",
    philosophy:
      "Joint-by-joint work — ankle and hip mobility, knee and lumbar stability, thoracic and shoulder mobility — with controlled 30–60 sec holds, breathing, and no explosive movement.",
  },
  "LOW BACK PAIN": {
    workoutCategory: "MOBILITY & STABILITY",
    companionCategories: ["MOBILITY & STABILITY", "RECOVERY"],
    mainFormats: ["REPS & SETS"],
    finisherFormat: null,
    preferred: [/dead\s*bug|bird\s*dog|mcgill|curl\s*up|glute\s*bridge|pallof|side\s*plank|cat\s*camel|cat\s*cow|hip|breathing|plank|stability|mobility|stretch|pelvic|child/i],
    forbidden: [/burpee|jump|sprint|run|box|thruster|snatch|clean|swing|high\s*knee|mountain\s*climber|jack|heavy|deadlift|good\s*morning|hyperextension/i],
    allowCardioBodyPart: false,
    rejectCardioBodyPart: true,
    locomotion: "none",
    recoveryCharacter: true,
    bodyweightToFailure: false,
    adaptation:
      "Adaptation target: pain reduction, spinal stability, core control, and movement confidence, blended with recovery character. Sets and reps only, with breathing and down-regulation in every session — never HIIT, circuits, jumps, sprints, or explosive work.",
    progression:
      "Progress only through pain-free control: increase range, time under tension, and stability demand before adding any load. Never chase fatigue or pain.",
    philosophy:
      "Therapeutic progression: pain-free range and core activation, then gentle strengthening and stability, then functional movement. No heavy loading, no explosive movement.",
  },
};

export function programDoctrine(category: string): ProgramDoctrine {
  const normalized = (category || "").toUpperCase();
  const key = Object.keys(PROGRAM_DOCTRINE).find((candidate) => normalized.includes(candidate));
  return key ? PROGRAM_DOCTRINE[key] : PROGRAM_DOCTRINE["FUNCTIONAL STRENGTH"];
}

/** True when this program category has an explicit doctrine entry. */
export function hasProgramDoctrine(category: string): boolean {
  const normalized = (category || "").toUpperCase();
  return Object.keys(PROGRAM_DOCTRINE).some((candidate) => normalized.includes(candidate));
}

export function programMainFormat(category: string, templateIndex: number): Format {
  const formats = programDoctrine(category).mainFormats;
  return formats[(Math.max(1, templateIndex) - 1) % formats.length];
}

export function programAllowsFinisher(category: string): boolean {
  return programDoctrine(category).finisherFormat !== null;
}

export function programAdaptationRule(category: string): string {
  return programDoctrine(category).adaptation;
}

export function programProgressionRule(category: string): string {
  return programDoctrine(category).progression;
}

export function programPhilosophy(category: string): string {
  return programDoctrine(category).philosophy;
}

export function programLocomotionMode(category: string): "required" | "optional" | "none" {
  return programDoctrine(category).locomotion;
}

export function programHasRecoveryCharacter(category: string): boolean {
  return programDoctrine(category).recoveryCharacter;
}

export function programBodyweightToFailure(category: string): boolean {
  return programDoctrine(category).bodyweightToFailure;
}

/**
 * An exercise is legal when it survives the shared selection policy AND is
 * legal for at least one of the workout categories this program inherits.
 * Weight Loss therefore reads Metabolic and Calorie Burning together; Low Back
 * Pain and Mobility read Mobility & Stability together with Recovery.
 */
export function programWorkExerciseViolation(
  exercise: ExerciseLike,
  programCategory: string,
  format: Format,
): string | null {
  if (!isSelectable(exercise.name)) {
    return `"${exercise.name}" is excluded by the shared exercise-selection policy.`;
  }
  const realism = humanRealismViolation(exercise);
  if (realism) return realism;

  const doctrine = programDoctrine(programCategory);
  let firstViolation: string | null = null;
  for (const category of doctrine.companionCategories) {
    const violation =
      categoryExerciseViolation(exercise, category) ||
      dynamicExerciseViolation(exercise, category, format) ||
      workSlotPrepViolation(exercise, category);
    if (!violation) return null;
    firstViolation ??= violation;
  }
  return firstViolation;
}

export function programFinisherSizeViolation(text: string): string | null {
  return finisherSizeViolation(text);
}

export function parseProgramEquipmentIds(equipment: string | null | undefined): string[] {
  const value = (equipment || "").toLowerCase();
  if (!value || value === "equipment" || value.includes("full gym")) return ["fullgym"];
  if (value.includes("bodyweight") && !/dumbbell|kettlebell|barbell|band|trx|machine|bike|row|treadmill|elliptical/.test(value)) {
    return [];
  }
  const ids: string[] = [];
  if (/dumbbell|light dumbbell/.test(value)) ids.push("dumbbells");
  if (/kettlebell/.test(value)) ids.push("kettlebells");
  if (/barbell/.test(value)) ids.push("barbell");
  if (/band/.test(value)) ids.push("bands");
  if (/trx|suspension/.test(value)) ids.push("trx");
  if (/machine|cable/.test(value)) ids.push("machines");
  if (/medicine ball|slam ball/.test(value)) ids.push("medicineball");
  if (/treadmill|elliptical|bike|spin|rower|rowing|outdoor|running shoes/.test(value)) ids.push("cardio");
  if (/stability ball|swiss ball|exercise ball/.test(value)) ids.push("stabilityball");
  if (/foam roller/.test(value)) ids.push("foamroller");
  if (/yoga block/.test(value)) ids.push("yogablocks");
  if (/plyo box|box/.test(value)) ids.push("box");
  if (/pull-?up bar/.test(value)) ids.push("pullupbar");
  return [...new Set(ids)];
}
