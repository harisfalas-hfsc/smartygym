import {
  categoryExerciseViolation,
  dynamicExerciseViolation,
  finisherSizeViolation,
  humanRealismViolation,
  workSlotPrepViolation,
  type ExerciseLike,
} from "./workout-engine/doctrine.ts";
import type { Category, Format } from "./workout-engine/spec.ts";

export type ProgramDoctrine = {
  workoutCategory: Category;
  mainFormats: Format[];
  finisherFormat: Format | null;
};

const PROGRAM_DOCTRINE: Record<string, ProgramDoctrine> = {
  "CARDIO ENDURANCE": {
    workoutCategory: "CARDIO",
    mainFormats: ["AMRAP", "EMOM", "CIRCUIT"],
    finisherFormat: "FOR TIME",
  },
  "FUNCTIONAL STRENGTH": {
    workoutCategory: "STRENGTH",
    mainFormats: ["REPS & SETS"],
    finisherFormat: "REPS & SETS",
  },
  "MUSCLE HYPERTROPHY": {
    workoutCategory: "MUSCLE BUILDING",
    mainFormats: ["REPS & SETS"],
    finisherFormat: "REPS & SETS",
  },
  "WEIGHT LOSS": {
    workoutCategory: "METABOLIC",
    mainFormats: ["CIRCUIT", "TABATA", "EMOM", "AMRAP"],
    finisherFormat: "TABATA",
  },
  "MOBILITY & STABILITY": {
    workoutCategory: "MOBILITY & STABILITY",
    mainFormats: ["REPS & SETS"],
    finisherFormat: null,
  },
  "LOW BACK PAIN": {
    workoutCategory: "MOBILITY & STABILITY",
    mainFormats: ["REPS & SETS"],
    finisherFormat: null,
  },
};

export function programDoctrine(category: string): ProgramDoctrine {
  const normalized = (category || "").toUpperCase();
  const key = Object.keys(PROGRAM_DOCTRINE).find((candidate) => normalized.includes(candidate));
  return key ? PROGRAM_DOCTRINE[key] : PROGRAM_DOCTRINE["FUNCTIONAL STRENGTH"];
}

export function programMainFormat(category: string, templateIndex: number): Format {
  const formats = programDoctrine(category).mainFormats;
  return formats[(Math.max(1, templateIndex) - 1) % formats.length];
}

export function programAllowsFinisher(category: string): boolean {
  return programDoctrine(category).finisherFormat !== null;
}

export function programWorkExerciseViolation(
  exercise: ExerciseLike,
  programCategory: string,
  format: Format,
): string | null {
  const category = programDoctrine(programCategory).workoutCategory;
  return (
    humanRealismViolation(exercise) ||
    categoryExerciseViolation(exercise, category) ||
    dynamicExerciseViolation(exercise, category, format) ||
    workSlotPrepViolation(exercise, category)
  );
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