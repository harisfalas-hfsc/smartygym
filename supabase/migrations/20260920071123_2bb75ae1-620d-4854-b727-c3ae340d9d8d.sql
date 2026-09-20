CREATE UNIQUE INDEX IF NOT EXISTS admin_workouts_one_active_wod_per_slot_date
ON public.admin_workouts (generated_for_date, equipment)
WHERE is_workout_of_day IS TRUE AND generated_for_date IS NOT NULL;