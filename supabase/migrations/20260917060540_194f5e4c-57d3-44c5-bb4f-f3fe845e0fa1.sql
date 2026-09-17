CREATE TABLE public.workout_compliance_audit (
  workout_id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  category text,
  format text,
  status text NOT NULL DEFAULT 'pass',
  repair_tier integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_minutes integer NOT NULL DEFAULT 0,
  session_minutes integer NOT NULL DEFAULT 0,
  target_minutes integer,
  audited_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workout_compliance_audit TO authenticated;
GRANT ALL ON public.workout_compliance_audit TO service_role;

ALTER TABLE public.workout_compliance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read workout compliance audit"
ON public.workout_compliance_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_workout_compliance_status ON public.workout_compliance_audit (status, repair_tier);

CREATE TABLE public.workout_content_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id text NOT NULL,
  main_workout text,
  reason text,
  job_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workout_content_backup TO authenticated;
GRANT ALL ON public.workout_content_backup TO service_role;

ALTER TABLE public.workout_content_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read workout content backups"
ON public.workout_content_backup
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_workout_content_backup_workout ON public.workout_content_backup (workout_id, created_at DESC);