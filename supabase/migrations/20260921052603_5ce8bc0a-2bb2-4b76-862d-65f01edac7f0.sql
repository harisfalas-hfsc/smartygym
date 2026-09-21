CREATE TABLE public.exercise_rename_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id text NOT NULL,
  old_name text NOT NULL,
  new_name text NOT NULL,
  batch text NOT NULL DEFAULT 'priority-common-names-2026-09',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_rename_backups TO authenticated;
GRANT ALL ON public.exercise_rename_backups TO service_role;
ALTER TABLE public.exercise_rename_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view exercise rename backups" ON public.exercise_rename_backups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));