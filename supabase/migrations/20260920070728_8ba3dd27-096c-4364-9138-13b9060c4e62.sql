CREATE OR REPLACE FUNCTION public.enforce_library_only_wod_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_workout_of_day IS TRUE
     AND COALESCE(NEW.wod_source, '') <> 'library' THEN
    RAISE EXCEPTION 'Workout of the Day assignments must come from the existing workout library';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_library_only_wod_assignment_trigger ON public.admin_workouts;
CREATE TRIGGER enforce_library_only_wod_assignment_trigger
BEFORE INSERT OR UPDATE OF is_workout_of_day, generated_for_date, wod_source
ON public.admin_workouts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_library_only_wod_assignment();

REVOKE ALL ON FUNCTION public.enforce_library_only_wod_assignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_library_only_wod_assignment() TO service_role;