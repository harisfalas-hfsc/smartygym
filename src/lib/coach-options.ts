/**
 * Shared, client-safe Smarty Coach option sets for "Create Your Own Workout".
 * Ported unchanged from the Smarty Workout transfer pack — the questions, their
 * order and their wording are part of the coaching rule book and must not drift.
 */

export const GOALS = [
  { id: "strength", label: "Strength" },
  { id: "muscle", label: "Muscle Building" },
  { id: "calorie", label: "Calorie Burning" },
  { id: "cardio", label: "Cardio" },
  { id: "metabolic", label: "Metabolic" },
  { id: "challenge", label: "Challenge" },
  { id: "mobility", label: "Mobility & Stability" },
  { id: "pilates", label: "Pilates" },
  { id: "micro", label: "Micro Workout" },
] as const;

/** Goals that ask the athlete which part of the body the session trains. */
export const FOCUS_GOALS: string[] = ["strength", "muscle"];

/** Body / split focus offered right after Strength or Muscle Building. */
export const BODY_FOCUS = [
  { id: "FULL BODY", label: "Full Body", hint: "Everything in one session" },
  { id: "UPPER BODY", label: "Upper Body", hint: "Chest, back, shoulders, arms" },
  { id: "LOWER BODY", label: "Lower Body", hint: "Legs and glutes" },
  { id: "PUSH", label: "Push", hint: "Chest, shoulders, triceps" },
  { id: "PULL", label: "Pull", hint: "Back and biceps" },
  { id: "LEGS", label: "Legs", hint: "Quads, hamstrings, calves" },
  { id: "CHEST", label: "Chest", hint: "Pressing and flys" },
  { id: "BACK", label: "Back", hint: "Rows and pull-ups" },
  { id: "SHOULDERS", label: "Shoulders", hint: "Presses and raises" },
  { id: "ARMS", label: "Arms", hint: "Biceps and triceps" },
  { id: "CORE & GLUTES", label: "Core & Glutes", hint: "Midline and hips" },
] as const;

export const MOODS = [
  { id: "energized", label: "Energized" },
  { id: "good", label: "Good" },
  { id: "normal", label: "Normal" },
  { id: "tired", label: "Tired" },
  { id: "stressed", label: "Stressed" },
  { id: "low", label: "Low motivation" },
  { id: "sore", label: "Sore" },
  { id: "fun", label: "I want something fun" },
  { id: "push", label: "I want to push myself" },
] as const;

export const TIMES = [5, 10, 15, 20, 30, 40, 45, 50, 60];

export const LOCATIONS = [
  { id: "home", label: "Home" },
  { id: "gym", label: "Gym" },
  { id: "outdoors", label: "Outdoors" },
  { id: "hotel", label: "Hotel" },
  { id: "anywhere", label: "Anywhere" },
] as const;

export const EQUIPMENT = [
  { id: "bodyweight", label: "Bodyweight" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "barbell", label: "Barbell" },
  { id: "bands", label: "Resistance Bands" },
  { id: "trx", label: "TRX" },
  { id: "machines", label: "Machines" },
  { id: "fullgym", label: "Full Gym" },
] as const;

/**
 * Apparatus the admin wizard offers once "EQUIPMENT" is chosen. Same ids the
 * engine already understands — bodyweight is the other mode, not a tick here.
 */
export const ADMIN_EQUIPMENT_CHOICES = EQUIPMENT.filter((e) => e.id !== "bodyweight");

/**
 * Conditioning work must keep the athlete moving, so gym machines and "full
 * gym" are not offered there at all — only light, portable kit. Bodyweight is
 * always part of these sessions whatever is ticked.
 */
export const CONDITIONING_GOALS = ["cardio", "metabolic", "calorie", "challenge"];
export const CONDITIONING_CATEGORY_NAMES = [
  "CARDIO",
  "METABOLIC",
  "CALORIE BURNING",
  "CHALLENGE",
];
const HEAVY_STATION_EQUIPMENT = ["machines", "fullgym"];

/** Equipment chips legal for a member goal id (e.g. "cardio"). */
export function equipmentForGoal(goalId: string) {
  return CONDITIONING_GOALS.includes(goalId)
    ? EQUIPMENT.filter((e) => !HEAVY_STATION_EQUIPMENT.includes(e.id))
    : EQUIPMENT;
}

/** Equipment chips legal for an admin category name (e.g. "METABOLIC"). */
export function adminEquipmentForCategory(category: string) {
  return CONDITIONING_CATEGORY_NAMES.includes((category ?? "").toUpperCase())
    ? ADMIN_EQUIPMENT_CHOICES.filter((e) => !HEAVY_STATION_EQUIPMENT.includes(e.id))
    : ADMIN_EQUIPMENT_CHOICES;
}

/**
 * SIX-STAR DIFFICULTY PICKER, grouped into the three familiar bands.
 * 1-2 Beginner, 3-4 Intermediate, 5-6 Advanced. The second star of each band
 * is only slightly harder: more volume / less rest, never harder exercises.
 */
export const LEVEL_GROUPS = [
  {
    label: "Beginner",
    levels: [
      { id: "1", stars: 1, hint: "Easier" },
      { id: "2", stars: 2, hint: "A bit more work" },
    ],
  },
  {
    label: "Intermediate",
    levels: [
      { id: "3", stars: 3, hint: "Moderate" },
      { id: "4", stars: 4, hint: "Harder" },
    ],
  },
  {
    label: "Advanced",
    levels: [
      { id: "5", stars: 5, hint: "Hard" },
      { id: "6", stars: 6, hint: "Hardest" },
    ],
  },
] as const;

/** Moods where an "Advanced" pick should be double-checked with the athlete. */
export const LOW_ENERGY_MOODS: string[] = ["tired", "stressed", "low", "sore"];

export function goalLabel(id: string) {
  return GOALS.find((g) => g.id === id)?.label ?? id;
}
