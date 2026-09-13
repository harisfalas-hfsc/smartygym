CREATE OR REPLACE FUNCTION public.has_premium_subscription(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (check_user_id IS NOT NULL AND public.free_access_mode_enabled())
    OR public.user_has_active_premium_access(check_user_id);
$$;