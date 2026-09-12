CREATE TABLE public.user_custom_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  format TEXT,
  focus TEXT,
  difficulty_stars INTEGER NOT NULL DEFAULT 3,
  difficulty_label TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  duration_label TEXT,
  equipment TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  mood TEXT,
  description_html TEXT,
  instructions_html TEXT,
  tips_html TEXT,
  main_workout TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_warnings TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'created',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_workouts TO authenticated;
GRANT ALL ON public.user_custom_workouts TO service_role;

ALTER TABLE public.user_custom_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own custom workouts"
  ON public.user_custom_workouts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_custom_workouts_user_created
  ON public.user_custom_workouts (user_id, created_at DESC);

CREATE TRIGGER update_user_custom_workouts_updated_at
  BEFORE UPDATE ON public.user_custom_workouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();