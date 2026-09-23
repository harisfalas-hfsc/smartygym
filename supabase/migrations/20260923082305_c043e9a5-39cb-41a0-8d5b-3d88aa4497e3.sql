DROP POLICY IF EXISTS "Anyone can read ritual assignments" ON public.daily_ritual_assignments;
CREATE POLICY "Signed-in members can read past and current ritual assignments"
ON public.daily_ritual_assignments
FOR SELECT
TO authenticated
USING (ritual_date <= (now() AT TIME ZONE 'Europe/Athens')::date);