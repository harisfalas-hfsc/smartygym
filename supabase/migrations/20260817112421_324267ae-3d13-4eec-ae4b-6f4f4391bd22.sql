DROP POLICY IF EXISTS "Anyone can read payment platform toggles" ON public.system_settings;
CREATE POLICY "Anyone can read payment platform toggles"
ON public.system_settings FOR SELECT TO anon, authenticated
USING (setting_key = ANY (ARRAY['payments_enabled_ios','payments_enabled_android','free_access_mode']));