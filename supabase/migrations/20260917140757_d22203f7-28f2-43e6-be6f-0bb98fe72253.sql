DROP POLICY IF EXISTS "Anyone can view comments" ON public.workout_comments;
REVOKE SELECT ON public.workout_comments FROM anon;