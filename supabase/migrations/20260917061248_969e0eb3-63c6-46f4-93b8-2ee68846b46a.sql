CREATE TABLE public.workout_repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  pause_reason text,
  queue text[] NOT NULL DEFAULT '{}',
  cursor integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  auto_fixed integer NOT NULL DEFAULT 0,
  ai_fixed integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  needs_review integer NOT NULL DEFAULT 0,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_repair_jobs TO authenticated;
GRANT ALL ON public.workout_repair_jobs TO service_role;

ALTER TABLE public.workout_repair_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage workout repair jobs"
ON public.workout_repair_jobs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_workout_repair_jobs_status ON public.workout_repair_jobs (status, created_at DESC);

CREATE TRIGGER workout_repair_jobs_updated_at
BEFORE UPDATE ON public.workout_repair_jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();