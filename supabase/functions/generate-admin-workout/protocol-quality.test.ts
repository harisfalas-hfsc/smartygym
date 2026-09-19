import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeProtocolBlocks } from "../_shared/protocol-sanitizer.ts";
import { applyWodQualityGate } from "../_shared/wod-quality-gate.ts";
import { guaranteeAllExercisesLinked, rejectNonLibraryExercises } from "../_shared/exercise-matching.ts";
import { categoryExerciseViolation, dynamicExerciseViolation, finisherSizeViolation, humanRealismViolation, workSlotPrepViolation } from "../_shared/workout-engine/doctrine.ts";
import { equipmentLegalForSession } from "../_shared/workout-engine/pool.server.ts";
import { isSelectable } from "../_shared/exercise-selection.ts";

Deno.test("sanitizer removes duplicated exercise names after library tokens", () => {
  const input = `<p class="tiptap-paragraph">12 reps {{exercise:0001:Scapula Push-up}}:Scapula Push-up</p>`;
  const result = sanitizeProtocolBlocks(input);

  assertEquals(result.flaggedForReview.length, 0);
  assertEquals(result.cleaned.includes("}}:Scapula Push-up"), false);
  assertEquals(result.cleaned, `<p class="tiptap-paragraph">12 reps {{exercise:0001:Scapula Push-up}}</p>`);
});

Deno.test("sanitizer removes repeated versioned suffixes after linked exercise tokens", () => {
  const input = `<p class="tiptap-paragraph">50 reps {{exercise:0735:sit-up v. 2}}-up v. 2-up v. 2-up v. 2</p>`;
  const result = sanitizeProtocolBlocks(input);

  assertEquals(result.flaggedForReview.length, 0);
  assertEquals(result.cleaned, `<p class="tiptap-paragraph">50 reps {{exercise:0735:sit-up v. 2}}</p>`);
});

Deno.test("sanitizer accepts side and per-limb qualifiers after library tokens", () => {
  const input = `<p class="tiptap-paragraph">10 reps {{exercise:0002:Bird Dog}} (alternating sides)</p><p class="tiptap-paragraph">50 reps {{exercise:0003:Leg Slide}} (50 each leg)</p><p class="tiptap-paragraph">30 sec {{exercise:0004:Side Plank}} (right side)</p>`;
  const result = sanitizeProtocolBlocks(input);

  assertEquals(result.flaggedForReview.length, 0);
  assertEquals(result.cleaned, input);
});

Deno.test("quality gate accepts EMOM minute labels with repeat rounds", () => {
  const html = `
    <p class="tiptap-paragraph">💪 <strong><u>Main Workout (EMOM)</u></strong></p>
    <p class="tiptap-paragraph">Repeat 5 rounds.</p>
    <ul class="tiptap-bullet-list">
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 1:</strong> 10 reps {{exercise:0001:Power Clean}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 2:</strong> 12 reps {{exercise:0002:Burpee}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 3:</strong> 10 reps {{exercise:0003:Trap Bar Deadlift}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 4:</strong> 12 reps {{exercise:0004:Scapula Push-up}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 5:</strong> 200m {{exercise:0005:Run}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph"><strong>Minute 6:</strong> 12 reps {{exercise:0006:Box Jump}}</p></li>
    </ul>
    <p class="tiptap-paragraph">⚡ <strong><u>Finisher (AMRAP)</u></strong></p>
    <p class="tiptap-paragraph">12-minute AMRAP.</p>
    <ul class="tiptap-bullet-list">
      <li class="tiptap-list-item"><p class="tiptap-paragraph">12 reps {{exercise:0007:Mountain Climber}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps {{exercise:0008:Push-up}}</p></li>
      <li class="tiptap-list-item"><p class="tiptap-paragraph">8 reps {{exercise:0009:Jump Squat}}</p></li>
    </ul>
    <p class="tiptap-paragraph">🧘 <strong><u>Cool Down 5'</u></strong></p>
  `;

  const result = applyWodQualityGate({
    mainWorkoutHtml: html,
    category: "CHALLENGE",
    difficultyStars: 6,
    format: "EMOM",
    isRecoveryDay: false,
  });

  assertEquals(result.ok, true);
});

Deno.test("sanitizer rebuilds loose EMOM minute paragraphs in order", () => {
  const input = `<p class="tiptap-paragraph">💪 <strong><u>Main Workout (EMOM)</u></strong></p><p class="tiptap-paragraph">Repeat 5 rounds.</p><ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">Minute 4: 45 sec {{exercise:0630:mountain climber}}</p></li></ul><p class="tiptap-paragraph">Minute 1: 12 reps {{exercise:1160:burpee}}</p><p class="tiptap-paragraph">Minute 2: 20 reps {{exercise:0283:diamond push-up}}</p><p class="tiptap-paragraph">Minute 3: 15 reps {{exercise:0514:jump squat}}</p><p class="tiptap-paragraph">Minute 5: 10 reps {{exercise:3662:pike-to-cobra push-up}}</p><p class="tiptap-paragraph">🧘 <strong><u>Cool Down 5'</u></strong></p>`;

  const result = sanitizeProtocolBlocks(input);
  const minutePositions = [1, 2, 3, 4, 5].map((n) => result.cleaned.indexOf(`Minute ${n}:`));

  assertEquals(minutePositions.every((pos) => pos >= 0), true);
  assertEquals(minutePositions, [...minutePositions].sort((a, b) => a - b));
  assertEquals(result.cleaned.includes(`<p class="tiptap-paragraph">Minute 1:`), false);
});

Deno.test("final exercise linking preserves leading rep prescriptions", () => {
  const library = [
    { id: "1759", name: "single leg squat (pistol) male", body_part: "legs", equipment: "body weight", target: "quads" },
    { id: "3663", name: "reverse plank with leg lift", body_part: "core", equipment: "body weight", target: "abs" },
  ];
  const input = `<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps single leg squat (pistol) male (5 per side)</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps reverse plank with leg lift (5 per side)</p></li></ul>`;

  const result = guaranteeAllExercisesLinked(input, library, "[TEST]");

  assertEquals(result.processedContent.includes("10 reps {{exercise:1759:single leg squat (pistol) male}} (5 per side)"), true);
  assertEquals(result.processedContent.includes("10 reps {{exercise:3663:reverse plank with leg lift}} (5 per side)"), true);
  assertEquals(result.processedContent.includes("10 {{exercise:"), false);
});

Deno.test("non-library rejection substitution preserves leading rep prescriptions", () => {
  const library = [
    { id: "1759", name: "single leg squat (pistol) male", body_part: "legs", equipment: "body weight", target: "quads" },
  ];
  const input = `<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps single leg squat (pistol) male (5 per side)</p></li></ul>`;

  const result = rejectNonLibraryExercises(input, library, "[TEST]");

  assertEquals(result.processedContent.includes("10 reps {{exercise:1759:single leg squat (pistol) male}} (5 per side)"), true);
  assertEquals(result.processedContent.includes("10 {{exercise:"), false);
});

Deno.test("final exercise linking handles prescribed lines with coaching tail text", () => {
  const library = [
    { id: "bird-dog", name: "Bird Dog", body_part: "Back", equipment: "Body Weight", target: "Spine" },
    { id: "glute-bridge", name: "Glute Bridge", body_part: "Upper Legs", equipment: "Body Weight", target: "Glutes" },
    { id: "0514", name: "jump squat", body_part: "upper legs", equipment: "body weight", target: "glutes" },
    { id: "1306", name: "plyo push up", body_part: "chest", equipment: "body weight", target: "pectorals" },
    { id: "3582", name: "lunge with jump", body_part: "upper legs", equipment: "body weight", target: "glutes" },
    { id: "v-up", name: "V-Up", body_part: "Waist", equipment: "Body Weight", target: "Abs" },
    { id: "0501", name: "jack burpee", body_part: "cardio", equipment: "body weight", target: "cardiovascular system" },
  ];
  const input = `<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">15 reps Bird Dog — tempo 2-sec hold at extension; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">15 reps Glute Bridge — tempo 1-sec squeeze at top; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">20 reps jump squat — tempo 2-sec lower, explosive lift; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps plyo push up — hands must leave the floor; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">20 reps lunge with jump — alternating legs in mid-air; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">15 reps V-Up — tempo 1-sec lift, 2-sec lower; rest 0 sec</p></li><li class="tiptap-list-item"><p class="tiptap-paragraph">10 reps jack burpee — combine jumping jack with burpee; rest 0 sec</p></li></ul>`;

  const result = guaranteeAllExercisesLinked(input, library, "[TEST]");

  assertEquals(result.forcedMatches.length, 7);
  assertEquals(result.processedContent.includes("15 reps {{exercise:bird-dog:Bird Dog}} — tempo 2-sec hold at extension; rest 0 sec"), true);
  assertEquals(result.processedContent.includes("20 reps {{exercise:0514:jump squat}} — tempo 2-sec lower, explosive lift; rest 0 sec"), true);
  assertEquals(result.processedContent.includes("10 reps {{exercise:0501:jack burpee}} — combine jumping jack with burpee; rest 0 sec"), true);
});

Deno.test("calorie burning rejects bench pullovers and isolated strength work", () => {
  const pullover = {
    name: "dumbbell around pullover",
    equipment: "dumbbell",
    body_part: "chest",
    target_muscle: "pectorals",
    description: "A chest exercise performed lying on a bench.",
    instructions: ["Lie flat on a bench and lower the dumbbell behind your head."],
  };

  assertEquals(Boolean(categoryExerciseViolation(pullover, "CALORIE BURNING")), true);
  assertEquals(Boolean(dynamicExerciseViolation(pullover, "CALORIE BURNING", "FOR TIME")), true);
});

Deno.test("calorie burning accepts simple continuous loaded movement", () => {
  const lunge = {
    name: "dumbbell lunge",
    equipment: "dumbbell",
    body_part: "upper legs",
    target_muscle: "glutes",
    description: "Alternate forward lunges while holding dumbbells.",
    instructions: ["Stand tall, step forward, return to standing, and alternate legs continuously."],
  };

  assertEquals(categoryExerciseViolation(lunge, "CALORIE BURNING"), null);
  assertEquals(dynamicExerciseViolation(lunge, "CALORIE BURNING", "FOR TIME"), null);
});

Deno.test("every conditioning category rejects bench, lying and seated isolation setups", () => {
  const cases = [
    { name: "dumbbell around pullover", equipment: "dumbbell" },
    { name: "dumbbell bench seated press", equipment: "dumbbell" },
    { name: "barbell pullover to press", equipment: "barbell" },
    { name: "dumbbell incline fly", equipment: "dumbbell" },
    { name: "lying triceps extension", equipment: "barbell" },
    { name: "dumbbell concentration curl", equipment: "dumbbell" },
    { name: "skull crusher", equipment: "barbell" },
  ];
  for (const category of ["CARDIO", "METABOLIC", "CALORIE BURNING", "CHALLENGE"] as const) {
    for (const e of cases) {
      assertEquals(
        Boolean(categoryExerciseViolation({ ...e, body_part: "chest", target_muscle: "pectorals" }, category)),
        true,
        `${e.name} should be illegal in ${category}`,
      );
    }
  }
});

Deno.test("standing and bent-over variants stay legal in conditioning work", () => {
  const legal = [
    { name: "standing dumbbell overhead press", equipment: "dumbbell" },
    { name: "bent-over reverse fly", equipment: "dumbbell" },
    { name: "kettlebell swing", equipment: "kettlebell" },
    { name: "dumbbell thruster", equipment: "dumbbell" },
  ];
  for (const e of legal) {
    assertEquals(
      categoryExerciseViolation({ ...e, body_part: "shoulders", target_muscle: "delts" }, "METABOLIC"),
      null,
      `${e.name} should stay legal`,
    );
    assertEquals(
      dynamicExerciseViolation({ ...e, body_part: "shoulders", target_muscle: "delts" }, "METABOLIC", "CIRCUIT"),
      null,
      `${e.name} should stay legal in a circuit`,
    );
  }
});

Deno.test("conditioning work rejects preparation drills such as wrist circles", () => {
  const wristCircles = {
    name: "wrist circles",
    equipment: "body weight",
    body_part: "lower arms",
    target_muscle: "forearms",
  };
  for (const category of ["CARDIO", "METABOLIC", "CALORIE BURNING", "CHALLENGE"] as const) {
    assertEquals(
      Boolean(categoryExerciseViolation(wristCircles, category)),
      true,
      `wrist circles should not be training work in ${category}`,
    );
  }
});

Deno.test("iron cross stretch is not confused with the banned gymnastic iron cross", () => {
  const mobility = {
    name: "iron cross stretch",
    equipment: "body weight",
    body_part: "upper legs",
    target_muscle: "glutes",
  };
  assertEquals(isSelectable(mobility.name), true);
  assertEquals(humanRealismViolation(mobility), null);
});

Deno.test("strength keeps bench and seated work fully legal", () => {
  const bench = { name: "barbell bench press", equipment: "barbell", body_part: "chest", target_muscle: "pectorals" };
  assertEquals(categoryExerciseViolation(bench, "STRENGTH"), null);
});

Deno.test("a member who only picked kettlebells never sees a barbell movement", () => {
  const barbell = {
    id: "1", name: "barbell clean", equipment: "barbell", body_part: "full body",
    target_muscle: "glutes", secondary_muscles: null, category: null, difficulty: "intermediate",
    movement_pattern: null, body_region: null, gif_path: null, cue: null,
  };
  const kb = { ...barbell, id: "2", name: "kettlebell swing", equipment: "kettlebell" };
  const opts = { category: "METABOLIC" as const, equipmentMode: "EQUIPMENT" as const, selectedEquipment: ["bodyweight", "kettlebells"] };
  assertEquals(equipmentLegalForSession(barbell, opts), false);
  assertEquals(equipmentLegalForSession(kb, opts), true);
});

Deno.test("stretches and joint circles are never work-slot exercises outside the mobility-native categories", () => {
  const drills = [
    { name: "rear deltoid stretch", equipment: "body weight" },
    { name: "circles knee stretch", equipment: "body weight" },
    { name: "Cat-Cow Stretch", equipment: "body weight" },
    { name: "wrist circles", equipment: "body weight" },
    { name: "seated glute stretch", equipment: "body weight" },
    { name: "Shoulder CARs", equipment: "body weight" },
  ];
  for (const d of drills) {
    for (const category of ["STRENGTH", "CALORIE BURNING", "CARDIO", "METABOLIC", "CHALLENGE", "MICRO-WORKOUTS"] as const) {
      assertEquals(Boolean(workSlotPrepViolation(d, category)), true, `${d.name} / ${category}`);
    }
    for (const category of ["MOBILITY & STABILITY", "RECOVERY", "PILATES"] as const) {
      assertEquals(workSlotPrepViolation(d, category), null, `${d.name} / ${category}`);
    }
  }
  assertEquals(workSlotPrepViolation({ name: "barbell back squat", equipment: "barbell" }, "STRENGTH"), null);
});

Deno.test("bar, dip-station and landing-dependent movements are illegal in conditioning and dynamic formats", () => {
  const banned = [
    { name: "gorilla chin", equipment: "body weight" },
    { name: "chin-ups (narrow parallel grip)", equipment: "body weight" },
    { name: "gironda sternum chin", equipment: "body weight" },
    { name: "chest dip", equipment: "body weight" },
    { name: "biceps narrow pull-ups", equipment: "body weight" },
    { name: "hanging leg raise", equipment: "body weight" },
    { name: "inverted row", equipment: "body weight" },
    { name: "box jump down with one leg stabilization", equipment: "body weight" },
  ];
  for (const e of banned) {
    for (const category of ["CARDIO", "METABOLIC", "CALORIE BURNING", "CHALLENGE"] as const) {
      assertEquals(Boolean(categoryExerciseViolation(e, category)), true, `${e.name} / ${category}`);
      assertEquals(Boolean(dynamicExerciseViolation(e, category, "AMRAP")), true, `${e.name} / AMRAP`);
    }
  }
  // Standing dynamic work stays legal in the same formats.
  for (const ok of [
    { name: "kettlebell swing", equipment: "kettlebell" },
    { name: "jump squat", equipment: "body weight" },
    { name: "burpee", equipment: "body weight" },
  ]) {
    assertEquals(categoryExerciseViolation(ok, "METABOLIC"), null, ok.name);
    assertEquals(dynamicExerciseViolation(ok, "METABOLIC", "AMRAP"), null, ok.name);
  }
});

Deno.test("advertised duration is honoured within ten minutes in both directions", async () => {
  const { durationOverflowViolation, durationShortfallViolation } = await import(
    "../_shared/workout-engine/doctrine.ts"
  );
  assertEquals(durationOverflowViolation(45, 40), null);
  assertEquals(Boolean(durationOverflowViolation(56, 40)), true);
  assertEquals(durationShortfallViolation(32, 40), null);
  assertEquals(Boolean(durationShortfallViolation(25, 40)), true);
});

Deno.test("finisherSizeViolation: flags an oversized minute claim", () => {
  const v = finisherSizeViolation("Set a 17-minute clock and repeat these intervals.");
  if (!v) throw new Error("expected a violation for a 17-minute finisher");
});

Deno.test("finisherSizeViolation: flags too many rounds", () => {
  const v = finisherSizeViolation("Complete 8 rounds of the three movements below.");
  if (!v) throw new Error("expected a violation for 8 rounds");
});

Deno.test("finisherSizeViolation: accepts a short complementary finisher", () => {
  const v = finisherSizeViolation("Set a 5-minute clock and complete 3 clean rounds.");
  if (v) throw new Error("unexpected violation: " + v);
});

Deno.test("finisherSizeViolation: allows standard Tabata interval counts", () => {
  const v = finisherSizeViolation("One 4-minute Tabata block: 8 rounds of 20 sec work / 10 sec rest.");
  if (v) throw new Error("unexpected violation: " + v);
});
