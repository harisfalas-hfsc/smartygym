ALTER TABLE public.user_custom_workouts
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS shared_by_name text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS share_report_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_custom_workouts_shared
  ON public.user_custom_workouts (is_shared, shared_at DESC);

DROP POLICY IF EXISTS "Premium members can view shared workouts" ON public.user_custom_workouts;
CREATE POLICY "Premium members can view shared workouts"
ON public.user_custom_workouts
FOR SELECT
TO authenticated
USING (
  is_shared = true
  AND (
    public.free_access_mode_enabled()
    OR public.user_has_active_premium_access(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can manage shared workouts" ON public.user_custom_workouts;
CREATE POLICY "Admins can manage shared workouts"
ON public.user_custom_workouts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));