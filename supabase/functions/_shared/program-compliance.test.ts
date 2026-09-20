import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditProgramCompliance } from "./program-compliance.ts";
import { programDoctrine, programWorkExerciseViolation } from "./program-doctrine.ts";
import type { PoolExercise } from "./workout-engine/pool.server.ts";

const exercise = (id: string, name: string, equipment: string, bodyPart: string, target: string): PoolExercise => ({
  id,
  name,
  equipment,
  body_part: bodyPart,
  target_muscle: target,
  secondary_muscles: [],
  category: "",
  difficulty: "intermediate",
  movement_pattern: null,
  body_region: null,
  gif_path: null,
  cue: null,
  description: "",
  instructions: [],
});

const library: PoolExercise[] = [
  exercise("push", "push-up", "body weight", "chest", "pectorals"),
  exercise("squat", "bodyweight squat", "body weight", "upper legs", "quadriceps"),
  exercise("climber", "mountain climber", "body weight", "cardio", "cardiovascular system"),
  exercise("jack", "jumping jack", "body weight", "cardio", "cardiovascular system"),
  exercise("pullover", "dumbbell pullover", "dumbbell", "back", "lats"),
];

const token = (id: string, name: string) => `{{exercise:${id}:${name}}}`;

Deno.test("program doctrine maps all six program categories", () => {
  assertEquals(programDoctrine("CARDIO ENDURANCE").workoutCategory, "CARDIO");
  assertEquals(programDoctrine("FUNCTIONAL STRENGTH").workoutCategory, "STRENGTH");
  assertEquals(programDoctrine("MUSCLE HYPERTROPHY").workoutCategory, "MUSCLE BUILDING");
  assertEquals(programDoctrine("WEIGHT LOSS").workoutCategory, "CALORIE BURNING");
  assertEquals(programDoctrine("MOBILITY & STABILITY").workoutCategory, "MOBILITY & STABILITY");
  assertEquals(programDoctrine("LOW BACK PAIN").workoutCategory, "MOBILITY & STABILITY");
});

Deno.test("conditioning program doctrine rejects fixed-position lifting", () => {
  const issue = programWorkExerciseViolation(library[4], "WEIGHT LOSS", "CIRCUIT");
  assert(issue?.includes("fixed bench, lying or seated position"));
});

Deno.test("program compliance passes a linked, prescribed conditioning day", () => {
  const main = [
    `40 sec ${token("push", "push-up")}`,
    `40 sec ${token("squat", "bodyweight squat")}`,
    `40 sec ${token("climber", "mountain climber")}`,
    `40 sec ${token("jack", "jumping jack")}`,
  ].map((line) => `<p class="tiptap-paragraph">• ${line}</p>`).join("");
  const finisher = [
    `20 sec ${token("climber", "mountain climber")}`,
    `20 sec ${token("jack", "jumping jack")}`,
  ].map((line) => `<p class="tiptap-paragraph">• ${line}</p>`).join("");
  const weekly_schedule = `<p class="tiptap-paragraph"><strong>📅 WEEK A TEMPLATE</strong></p><p class="tiptap-paragraph"><strong>① DAY 1 – Metabolic Conditioning</strong></p><p class="tiptap-paragraph"><strong>🏋 Main Workout (CIRCUIT) — 20 minutes</strong></p>${main}<p class="tiptap-paragraph"><strong>💥 Finisher (TABATA) — 4 minutes</strong></p>${finisher}<p class="tiptap-paragraph"><strong>🧘 Cool Down — 5 minutes</strong></p>`;
  const result = auditProgramCompliance({ category: "WEIGHT LOSS", equipment: "Bodyweight", weekly_schedule }, library);
  assertEquals(result.passed, true, JSON.stringify(result.issues));
});

Deno.test("program compliance fails illegal exercises and missing prescriptions", () => {
  const weekly_schedule = `<p class="tiptap-paragraph"><strong>📅 WEEK A TEMPLATE</strong></p><p class="tiptap-paragraph"><strong>① DAY 1 – Metabolic Conditioning</strong></p><p class="tiptap-paragraph"><strong>🏋 Main Workout (CIRCUIT) — 20 minutes</strong></p><p class="tiptap-paragraph">• ${token("pullover", "dumbbell pullover")}</p><p class="tiptap-paragraph">• 40 sec ${token("push", "push-up")}</p><p class="tiptap-paragraph">• 40 sec ${token("squat", "bodyweight squat")}</p><p class="tiptap-paragraph">• 40 sec ${token("jack", "jumping jack")}</p><p class="tiptap-paragraph"><strong>💥 Finisher (TABATA) — 4 minutes</strong></p><p class="tiptap-paragraph">• 20 sec ${token("climber", "mountain climber")}</p><p class="tiptap-paragraph"><strong>🧘 Cool Down — 5 minutes</strong></p>`;
  const result = auditProgramCompliance({ category: "WEIGHT LOSS", equipment: "Dumbbells", weekly_schedule }, library);
  assertEquals(result.passed, false);
  assert(result.issues.some((issue) => issue.code === "EXERCISE_ILLEGAL"));
  assert(result.issues.some((issue) => issue.code === "MISSING_DOSE"));
});