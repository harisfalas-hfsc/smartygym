CREATE TABLE public.training_program_compliance_audit (
  program_id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  category text,
  status text NOT NULL DEFAULT 'fail',
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  training_days integer NOT NULL DEFAULT 0,
  linked_exercises integer NOT NULL DEFAULT 0,
  audited_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_program_compliance_audit TO authenticated;
GRANT ALL ON public.training_program_compliance_audit TO service_role;

ALTER TABLE public.training_program_compliance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read training program compliance audit"
ON public.training_program_compliance_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_training_program_compliance_status
ON public.training_program_compliance_audit (status, audited_at DESC);

CREATE TABLE public.training_program_content_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id text NOT NULL,
  weekly_schedule text,
  program_structure text,
  progression_plan text,
  nutrition_tips text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_program_content_backup TO authenticated;
GRANT ALL ON public.training_program_content_backup TO service_role;

ALTER TABLE public.training_program_content_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read training program content backups"
ON public.training_program_content_backup
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_training_program_content_backup_program
ON public.training_program_content_backup (program_id, created_at DESC);