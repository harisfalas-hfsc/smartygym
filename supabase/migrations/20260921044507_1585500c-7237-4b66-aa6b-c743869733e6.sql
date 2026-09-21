CREATE POLICY "Admins can view all custom workouts"
ON public.user_custom_workouts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));