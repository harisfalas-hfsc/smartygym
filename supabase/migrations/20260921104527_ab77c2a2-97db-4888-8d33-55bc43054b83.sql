CREATE TABLE public.exercise_media_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  old_gif_url text,
  old_frame_start_url text,
  old_frame_end_url text,
  new_gif_url text NOT NULL,
  batch text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exercise_media_backups TO service_role;
ALTER TABLE public.exercise_media_backups ENABLE ROW LEVEL SECURITY;
CREATE INDEX exercise_media_backups_exercise_id_idx ON public.exercise_media_backups(exercise_id);
CREATE INDEX exercise_media_backups_batch_idx ON public.exercise_media_backups(batch);