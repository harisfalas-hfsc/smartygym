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
  { id: "other", label: "Other" },
] as const;

/**
 * SIX-STAR DIFFICULTY PICKER.
 * 1-2 Beginner, 3-4 Intermediate, 5-6 Advanced. The second star of each band
 * is only slightly harder: more volume / less rest, never harder exercises.
 */
export const LEVELS_6 = [
  { id: "auto", label: "Let Smarty decide", stars: 0, hint: "Uses your profile + today's mood" },
  { id: "1", label: "Beginner - easier", stars: 1, hint: "Simple patterns, generous rest" },
  { id: "2", label: "Beginner - solid", stars: 2, hint: "Same movements, a little more work" },
  { id: "3", label: "Intermediate - easier", stars: 3, hint: "Standard variations, moderate rest" },
  { id: "4", label: "Intermediate - solid", stars: 4, hint: "More volume, tighter rest" },
  { id: "5", label: "Advanced - easier", stars: 5, hint: "High demand, familiar movements" },
  { id: "6", label: "Advanced - solid", stars: 6, hint: "Highest volume and density" },
] as const;

/** Moods where an "Advanced" pick should be double-checked with the athlete. */
export const LOW_ENERGY_MOODS: string[] = ["tired", "stressed", "low", "sore"];

export function goalLabel(id: string) {
  return GOALS.find((g) => g.id === id)?.label ?? id;
}
