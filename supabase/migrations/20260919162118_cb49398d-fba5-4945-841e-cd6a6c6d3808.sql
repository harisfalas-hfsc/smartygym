ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'custom_workout_ready';

ALTER TABLE public.user_custom_workouts
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS ready_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_emailed_at timestamptz;

ALTER TABLE public.user_custom_workouts
  ADD CONSTRAINT user_custom_workouts_status_check
  CHECK (status IN ('generating', 'created', 'failed'));

GRANT SELECT, INSERT, UPDATE ON public.user_custom_workouts TO authenticated;
GRANT ALL ON public.user_custom_workouts TO service_role;