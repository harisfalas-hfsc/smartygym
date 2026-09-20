import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildExerciseReferenceList, repairStaticHoldPrescriptions, removeStaticHoldsFromMomentumSections } from "./exercise-matching.ts";
import { buildDayBullets, buildExerciseBullet, filterLibraryForProgram, pickExercisesForDay, type LibExercise } from "./program-exercise-picker.ts";

const LIBRARY: LibExercise[] = [
  { id: "bw-adv-push", name: "push-up", body_part: "chest", equipment: "body weight", target: "pectorals", difficulty: "Advanced" },
  { id: "bw-adv-front-lever", name: "front lever reps", body_part: "back", equipment: "body weight", target: "lats", difficulty: "Advanced" },
  { id: "eq-adv-chest", name: "barbell bench press", body_part: "chest", equipment: "barbell", target: "pectorals", difficulty: "Advanced" },
  { id: "eq-adv-triceps", name: "barbell jm bench press", body_part: "upper arms", equipment: "barbell", target: "triceps", difficulty: "Advanced" },
  { id: "eq-adv-biceps", name: "biceps narrow pull-up", body_part: "back", equipment: "pull-up bar", target: "biceps", difficulty: "Advanced" },
  { id: "eq-adv-back", name: "lat pulldown", body_part: "back", equipment: "cable", target: "lats", difficulty: "Advanced" },
  { id: "eq-adv-back-lever", name: "back lever", body_part: "back", equipment: "pull-up bar", target: "upper back", difficulty: "Advanced" },
  { id: "eq-adv-side-plank-row", name: "dumbbell side plank with rear fly", body_part: "back", equipment: "dumbbell", target: "upper back", difficulty: "Advanced" },
  { id: "eq-beg-chest", name: "machine chest press", body_part: "chest", equipment: "machine", target: "pectorals", difficulty: "Beginner" },
];

Deno.test("program picker: equipment is a ceiling, bodyweight remains legal, and difficulty is exact", () => {
  const equipmentAdvanced = filterLibraryForProgram(LIBRARY, "Equipment", "Advanced");

  assertEquals(equipmentAdvanced.every((ex) => ex.difficulty === "Advanced"), true);
  assertEquals(equipmentAdvanced.some((ex) => ex.id === "eq-beg-chest"), false);
  assertEquals(equipmentAdvanced.some((ex) => ex.id === "bw-adv-push"), true);
});

Deno.test("program picker: bodyweight mode excludes equipment and apparatus-dependent bodyweight", () => {
  const bodyweightAdvanced = filterLibraryForProgram(LIBRARY, "Bodyweight", "Advanced");

  assertEquals(bodyweightAdvanced.map((ex) => ex.id), ["bw-adv-push"]);
});

Deno.test("program picker: triceps focus does not match biceps substring inside triceps", () => {
  const equipmentAdvanced = filterLibraryForProgram(LIBRARY, "Equipment", "Advanced");
  const picks = pickExercisesForDay(equipmentAdvanced, "Chest & Triceps", 1, 1, 10);
  const pickedIds = picks.map((ex) => ex.id);

  assert(pickedIds.includes("eq-adv-chest"));
  assert(pickedIds.includes("eq-adv-triceps"));
  assertEquals(pickedIds.includes("eq-adv-biceps"), false);
  assertEquals(pickedIds.includes("eq-adv-back"), false);
});

Deno.test("workout reference list: non-bodyweight and strict difficulty filter remove wrong pools", () => {
  const ref = buildExerciseReferenceList(LIBRARY as any, "non-bodyweight", "advanced");

  assert(ref.includes("barbell bench press"));
  assertEquals(ref.includes("push-up"), false);
  assertEquals(ref.includes("machine chest press"), false);
});

Deno.test("program picker: static holds are excluded from primary program exercise pools", () => {
  const equipmentAdvanced = filterLibraryForProgram(LIBRARY, "Equipment", "Advanced");
  const sidePlankFly = LIBRARY.find((ex) => ex.id === "eq-adv-side-plank-row")!;

  assertEquals(equipmentAdvanced.some((ex) => ex.id === "eq-adv-back-lever"), false);
  assertEquals(buildExerciseBullet(sidePlankFly, "MUSCLE HYPERTROPHY", "Back & Biceps"), "• {{exercise:eq-adv-side-plank-row:dumbbell side plank with rear fly}} – 4 × 8–12 reps, tempo 3-1-1, rest 75–90 sec");
});

Deno.test("program picker: category-first rules block cardio exercises from hypertrophy", () => {
  const library: LibExercise[] = [
    { id: "cardio-1", name: "burpee", body_part: "cardio", equipment: "body weight", target: "cardiovascular system", difficulty: "Intermediate" },
    { id: "chest-1", name: "push up", body_part: "chest", equipment: "body weight", target: "pectorals", difficulty: "Intermediate" },
    { id: "legs-1", name: "bulgarian split squat", body_part: "upper legs", equipment: "body weight", target: "quads", difficulty: "Intermediate" },
  ];
  const pool = filterLibraryForProgram(library, "Bodyweight", "Intermediate", "MUSCLE HYPERTROPHY");

  assertEquals(pool.some((ex) => ex.id === "cardio-1"), false);
  assertEquals(pool.map((ex) => ex.id).sort(), ["chest-1", "legs-1"]);
});

Deno.test("program picker: category-first rules keep weight-loss work realistic and skill-free", () => {
  const library: LibExercise[] = [
    { id: "skill-1", name: "one arm push up", body_part: "chest", equipment: "body weight", target: "pectorals", difficulty: "Advanced" },
    { id: "skill-2", name: "full planche", body_part: "chest", equipment: "body weight", target: "pectorals", difficulty: "Advanced" },
    { id: "wl-1", name: "mountain climber", body_part: "cardio", equipment: "body weight", target: "cardiovascular system", difficulty: "Advanced" },
    { id: "wl-2", name: "glute bridge", body_part: "upper legs", equipment: "body weight", target: "glutes", difficulty: "Advanced" },
  ];
  const pool = filterLibraryForProgram(library, "Bodyweight", "Advanced", "WEIGHT LOSS");

  // Skills are rejected; continuous-movement and glute/core staples stay legal.
  assertEquals(pool.map((ex) => ex.id).sort(), ["wl-1", "wl-2"]);

});

Deno.test("exercise matching: post-processing repairs static hold prescriptions only", () => {
  const html = `<p>• {{exercise:3297:back lever}} – 3 × 10</p><p>• {{exercise:3664:dumbbell side plank with rear fly}} – 3 × 10</p>`;
  const repaired = repairStaticHoldPrescriptions(html).processedContent;

  assert(repaired.includes("{{exercise:3297:back lever}} – 3 × 10-sec holds"));
  assert(repaired.includes("{{exercise:3664:dumbbell side plank with rear fly}} – 3 × 10"));
});

Deno.test("exercise matching: static holds are removed from Main Workout momentum sections", () => {
  const html = `<p>🔥 <strong><u>Activation 5'</u></strong></p><ul><li><p>20 sec {{exercise:forearm-plank:Forearm Plank}}</p></li></ul><p>💪 <strong><u>Main Workout (AMRAP)</u></strong></p><ul><li><p>30 sec {{exercise:forearm-plank:Forearm Plank}}</p></li><li><p>12 reps {{exercise:0662:push-up}}</p></li></ul>`;
  const result = removeStaticHoldsFromMomentumSections(html);

  assertEquals(result.removed.length, 1);
  assert(result.processedContent.includes("Activation 5'"));
  assert(result.processedContent.includes("20 sec {{exercise:forearm-plank:Forearm Plank}}"));
  assertEquals(result.processedContent.includes("30 sec {{exercise:forearm-plank:Forearm Plank}}"), false);
  assert(result.processedContent.includes("12 reps {{exercise:0662:push-up}}"));
});
Deno.test("program picker: cardio days carry real locomotion, mobility days carry down-regulation", () => {
  const library: LibExercise[] = [
    { id: "c1", name: "mountain climber", body_part: "cardio", equipment: "body weight", target: "cardiovascular system", difficulty: "Intermediate" },
    { id: "c2", name: "high knee", body_part: "cardio", equipment: "body weight", target: "cardiovascular system", difficulty: "Intermediate" },
    { id: "c3", name: "jumping jack", body_part: "cardio", equipment: "body weight", target: "cardiovascular system", difficulty: "Intermediate" },
    { id: "c4", name: "squat", body_part: "upper legs", equipment: "body weight", target: "quads", difficulty: "Intermediate" },
  ];
  const cardio = buildDayBullets(library, "CARDIO ENDURANCE", "Interval Training", 1, 1, 4, "Intermediate", 6, []);
  assert(cardio.some((line) => line.includes("Locomotion")), "cardio day must contain a locomotion block");
  assert(cardio.some((line) => /400 m/.test(line)), "interval day must prescribe distance intervals");

  const mobility = buildDayBullets(library, "LOW BACK PAIN", "Core Control", 1, 1, 4, "Beginner", 6, []);
  assert(mobility.some((line) => /breathing/i.test(line)), "low back day must include breathing work");
  assert(!mobility.some((line) => line.includes("Locomotion")), "mobility day must not prescribe running");
});
