GRANT DELETE ON public.admin_generation_jobs TO authenticated;
CREATE POLICY "Admins can remove own finished generation jobs"
ON public.admin_generation_jobs FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND status IN ('completed', 'failed')
  AND public.has_role(auth.uid(), 'admin')
);