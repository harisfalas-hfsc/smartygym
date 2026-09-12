DROP POLICY IF EXISTS "Users manage their own custom workouts" ON public.user_custom_workouts;

CREATE POLICY "Users can view their own custom workouts"
ON public.user_custom_workouts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom workouts"
ON public.user_custom_workouts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom workouts"
ON public.user_custom_workouts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE DELETE ON public.user_custom_workouts FROM authenticated;