CREATE POLICY "Service role manages exercise media backups"
ON public.exercise_media_backups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);