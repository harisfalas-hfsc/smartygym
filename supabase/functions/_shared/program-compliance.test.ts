import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditProgramCompliance } from "./program-compliance.ts";
import { programDoctrine, programWorkExerciseViolation } from "./program-doctrine.ts";
import type { PoolExercise } from "./workout-engine/pool.server.ts";

const library: PoolExercise[] = [
  { id: "push", name: "push-up", equipment: "body weight", body_part: "chest", target_muscle: "pectorals", difficulty: "intermediate", description: "", instructions: [] },
  { id: "squat", name: "bodyweight squat", equipment: "body weight", body_part: "upper legs", target_muscle: "quadriceps", difficulty: "intermediate", description: "", instructions: [] },
  { id: "climber", name: "mountain climber", equipment: "body weight", body_part: "cardio", target_muscle: "cardiovascular system", difficulty: "intermediate", description: "", instructions: [] },
  { id: "jack", name: "jumping jack", equipment: "body weight", body_part: "cardio", target_muscle: "cardiovascular system", difficulty: "intermediate", description: "", instructions: [] },
  { id: "pullover", name: "dumbbell pullover", equipment: "dumbbell", body_part: "back", target_muscle: "lats", difficulty: "intermediate", description: "", instructions: [] },
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