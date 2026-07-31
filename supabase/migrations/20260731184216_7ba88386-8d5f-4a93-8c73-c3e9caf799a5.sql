GRANT SELECT ON public.system_settings TO anon;

CREATE POLICY "Anyone can read payment platform toggles"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (setting_key IN ('payments_enabled_ios', 'payments_enabled_android'));