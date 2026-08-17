INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('free_access_mode', 'false'::jsonb, 'When true, all content is free for signed-in users and every purchase/premium reference is hidden (App Store submission mode)')
ON CONFLICT (setting_key) DO NOTHING;