CREATE TABLE public.workout_swap_staging (
  workout_id text PRIMARY KEY,
  warm_up text,
  activation text,
  main_workout text,
  finisher text,
  cool_down text
);
GRANT ALL ON public.workout_swap_staging TO service_role;
ALTER TABLE public.workout_swap_staging ENABLE ROW LEVEL SECURITY;