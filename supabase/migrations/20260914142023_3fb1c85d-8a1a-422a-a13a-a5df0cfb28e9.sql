CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE(jobname text, schedule text, active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT j.jobname::text, j.schedule::text, j.active::boolean
  FROM cron.job j;
$function$;

REVOKE ALL ON FUNCTION public.get_cron_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO service_role;