ALTER FUNCTION public.set_admin_generation_job_updated_at() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.set_admin_generation_job_updated_at() FROM PUBLIC, anon, authenticated;