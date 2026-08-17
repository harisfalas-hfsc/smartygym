INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('sister_announcement_enabled', 'true'::jsonb, 'Show the Smarty sister-apps announcement popup on the site')
ON CONFLICT (setting_key) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can read payment platform toggles" ON public.system_settings;
CREATE POLICY "Anyone can read payment platform toggles"
ON public.system_settings FOR SELECT TO anon, authenticated
USING (setting_key = ANY (ARRAY['payments_enabled_ios','payments_enabled_android','free_access_mode','sister_announcement_enabled']));