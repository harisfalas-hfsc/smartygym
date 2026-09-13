// Centralized workout categories - single source of truth for admin and public
export const WORKOUT_CATEGORIES = [
  "STRENGTH",
  "CALORIE BURNING",
  "METABOLIC",
  "CARDIO",
  "MOBILITY & STABILITY",
  "CHALLENGE",
  "PILATES",
  "RECOVERY",
  "MICRO-WORKOUTS"
] as const;

export type WorkoutCategory = typeof WORKOUT_CATEGORIES[number];

export const WORKOUT_CATEGORY_BY_SLUG: Record<string, WorkoutCategory> = {
  "strength": "STRENGTH",
  "calorie-burning": "CALORIE BURNING",
  "metabolic": "METABOLIC",
  "cardio": "CARDIO",
  "mobility": "MOBILITY & STABILITY",
  "challenge": "CHALLENGE",
  "pilates": "PILATES",
  "recovery": "RECOVERY",
  "micro-workouts": "MICRO-WORKOUTS",
};

const normalizeCategoryText = (category: string) =>
  category.trim().toUpperCase().replace(/\s*&\s*/g, " & ").replace(/[\s_-]+/g, " ");

export const workoutCategoryToSlug = (category: string | null | undefined): string => {
  if (!category) return "";
  const normalized = normalizeCategoryText(category);
  const match = Object.entries(WORKOUT_CATEGORY_BY_SLUG).find(
    ([, value]) => normalizeCategoryText(value) === normalized,
  );
  return match?.[0] || normalized.toLowerCase().replace(/\s+/g, "-");
};

export const workoutMatchesCategorySlug = (
  category: string | null | undefined,
  slug: string | null | undefined,
) => !!category && !!slug && workoutCategoryToSlug(category) === slug;

export const PROGRAM_CATEGORY_BY_SLUG = {
  "cardio-endurance": "CARDIO ENDURANCE",
  "functional-strength": "FUNCTIONAL STRENGTH",
  "muscle-hypertrophy": "MUSCLE HYPERTROPHY",
  "weight-loss": "WEIGHT LOSS",
  "low-back-pain": "LOW BACK PAIN",
  "mobility-stability": "MOBILITY & STABILITY",
} as const;

export const programCategoryToSlug = (category: string | null | undefined): string => {
  if (!category) return "";
  const normalized = normalizeCategoryText(category);
  const match = Object.entries(PROGRAM_CATEGORY_BY_SLUG).find(
    ([, value]) => normalizeCategoryText(value) === normalized,
  );
  return match?.[0] || normalized.toLowerCase().replace(/\s+/g, "-");
};

export const programMatchesCategorySlug = (
  category: string | null | undefined,
  slug: string | null | undefined,
) => !!category && !!slug && programCategoryToSlug(category) === slug;

// Strength-only periodization focus values. Do not use these for non-Strength categories.
export const STRENGTH_FOCUS_OPTIONS = [
  "LOWER BODY",
  "UPPER BODY",
  "FULL BODY",
  "LOW PUSH & UPPER PULL",
  "LOW PULL & UPPER PUSH",
  "CORE & GLUTES"
] as const;

export type StrengthFocus = typeof STRENGTH_FOCUS_OPTIONS[number];

export const isStrengthFocus = (value: string | null | undefined): value is StrengthFocus => {
  return STRENGTH_FOCUS_OPTIONS.includes(value as StrengthFocus);
};

// Difficulty levels including "All Levels"
export const DIFFICULTY_OPTIONS = [
  { value: 0, label: "All Levels", stars: 0 },
  { value: 1, label: "Beginner (1★)", stars: 1 },
  { value: 2, label: "Beginner (2★)", stars: 2 },
  { value: 3, label: "Intermediate (3★)", stars: 3 },
  { value: 4, label: "Intermediate (4★)", stars: 4 },
  { value: 5, label: "Advanced (5★)", stars: 5 },
  { value: 6, label: "Advanced (6★)", stars: 6 },
] as const;

// Helper to get difficulty text from stars
export const getDifficultyFromStars = (stars: number | null | undefined): string => {
  if (stars === null || stars === undefined || stars === 0) return "All Levels";
  if (stars <= 2) return "Beginner";
  if (stars <= 4) return "Intermediate";
  return "Advanced";
};

// Category label mapping for display
export const CATEGORY_LABELS: Record<string, string> = {
  'STRENGTH': 'Strength',
  'CALORIE BURNING': 'Calorie Burning',
  'METABOLIC': 'Metabolic',
  'CARDIO': 'Cardio',
  'CARDIO ENDURANCE': 'Cardio Endurance',
  'MOBILITY & STABILITY': 'Mobility & Stability',
  'CHALLENGE': 'Challenge',
  'PILATES': 'Pilates',
  'RECOVERY': 'Recovery',
  'MICRO-WORKOUTS': 'Micro-Workouts',
  // Lowercase versions for focus field
  'strength': 'Strength',
  'calorie-burning': 'Calorie Burning',
  'metabolic': 'Metabolic',
  'cardio': 'Cardio',
  'cardio-endurance': 'Cardio Endurance',
  'mobility-stability': 'Mobility & Stability',
  'challenge': 'Challenge',
  'pilates': 'Pilates',
  'recovery': 'Recovery',
  'micro-workouts': 'Micro-Workouts',
};

export const getCategoryLabel = (category: string | undefined | null): string => {
  if (!category) return '';
  return CATEGORY_LABELS[category] || category;
};
