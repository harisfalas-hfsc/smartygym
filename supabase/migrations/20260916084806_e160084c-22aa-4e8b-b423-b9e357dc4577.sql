CREATE TABLE public.admin_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('workout', 'program')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  draft_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT ON public.admin_generation_jobs TO authenticated;
GRANT ALL ON public.admin_generation_jobs TO service_role;
ALTER TABLE public.admin_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can create own generation jobs"
ON public.admin_generation_jobs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view own generation jobs"
ON public.admin_generation_jobs FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_admin_generation_jobs_user_created
ON public.admin_generation_jobs (user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.set_admin_generation_job_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER update_admin_generation_jobs_updated_at
BEFORE UPDATE ON public.admin_generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_admin_generation_job_updated_at();