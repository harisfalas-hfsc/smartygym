INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  ('background_frozen', 'false'::jsonb, 'When true, all background automation (scheduled jobs + automated emails/notifications) is paused'),
  ('background_freeze_snapshot', '{"jobs": [], "frozen_at": null}'::jsonb, 'Snapshot of scheduled jobs that were active when the system was frozen')
ON CONFLICT (setting_key) DO NOTHING;