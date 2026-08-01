DROP POLICY IF EXISTS "Users can update their own workout interactions" ON public.workout_interactions;
DROP POLICY IF EXISTS "Users can insert workout interactions based on tier" ON public.workout_interactions;

CREATE POLICY "Users can insert workout interactions based on tier"
ON public.workout_interactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    public.user_has_active_premium_access(auth.uid())
    OR public.user_has_purchased_content(auth.uid(), 'workout', workout_id)
    OR (is_favorite IS NOT TRUE AND is_completed IS NOT TRUE AND rating IS NULL)
  )
);

CREATE POLICY "Users can update their own workout interactions"
ON public.workout_interactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND (
    public.user_has_active_premium_access(auth.uid())
    OR public.user_has_purchased_content(auth.uid(), 'workout', workout_id)
    OR (is_favorite IS NOT TRUE AND is_completed IS NOT TRUE AND rating IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can update their own program interactions" ON public.program_interactions;
DROP POLICY IF EXISTS "Users can insert program interactions based on tier" ON public.program_interactions;

CREATE POLICY "Users can insert program interactions based on tier"
ON public.program_interactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    public.user_has_active_premium_access(auth.uid())
    OR public.user_has_purchased_content(auth.uid(), 'program', program_id)
    OR (is_favorite IS NOT TRUE AND is_completed IS NOT TRUE AND rating IS NULL AND is_ongoing IS NOT TRUE)
  )
);

CREATE POLICY "Users can update their own program interactions"
ON public.program_interactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND (
    public.user_has_active_premium_access(auth.uid())
    OR public.user_has_purchased_content(auth.uid(), 'program', program_id)
    OR (is_favorite IS NOT TRUE AND is_completed IS NOT TRUE AND rating IS NULL AND is_ongoing IS NOT TRUE)
  )
);