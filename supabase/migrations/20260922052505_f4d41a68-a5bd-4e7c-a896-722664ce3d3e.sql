ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_generation_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_exercises_is_generation_enabled
  ON public.exercises(is_generation_enabled);