/** The 7 standard PAR-Q questions, in the exact order they are stored. */
export const PARQ_QUESTIONS = [
  "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?",
  "Do you feel pain in your chest when you do physical activity?",
  "In the past month, have you had chest pain when you were not doing physical activity?",
  "Do you lose your balance because of dizziness or do you ever lose consciousness?",
  "Do you have a bone or joint problem (for example, back, knee or hip) that could be made worse by a change in your physical activity?",
  "Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?",
  "Do you know of any other reason why you should not do physical activity?",
] as const;

/** Short labels shown inside the health-warning waiver. */
export const PARQ_SHORT_LABELS = [
  "A doctor has said you have a heart condition",
  "You get chest pain during physical activity",
  "You had chest pain while at rest in the past month",
  "You lose balance from dizziness or lose consciousness",
  "You have a bone or joint problem that activity could make worse",
  "You take prescribed medication for blood pressure or a heart condition",
  "You know of another reason why you should not exercise",
] as const;
