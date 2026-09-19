CREATE OR REPLACE FUNCTION public.enforce_micro_workout_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  mins int;
  content_blob text;
  exercise_ref record;
  forbidden_pattern constant text := '\m(air\s*bike|assault\s*bike|bike|bicycle|cycle|rower|treadmill|ski\s*erg|erg|balance\s*board|barbell|dumbbell|kettlebell|cable|machine|leverage|smith|sled|rope|battle\s*rope|medicine\s*ball|stability\s*ball|swiss\s*ball|bosu|band|bench|pull[- ]?up\s*bar|dip[- ]?pull[- ]?up\s*cage|straight\s*bar|captain''?s\s*chair|captains\s*chair|stick|pole|weighted|plate|trap\s*bar|ez\s*bar)\M';
BEGIN
  IF NEW.category = 'MICRO-WORKOUTS' THEN
    mins := COALESCE((regexp_match(COALESCE(NEW.duration, ''), '([0-9]+)'))[1]::int, 0);
    IF mins <> 5 THEN
      RAISE EXCEPTION 'Micro-workouts must be exactly 5 minutes total (got %).', COALESCE(NEW.duration, 'blank');
    END IF;

    IF COALESCE(upper(NEW.equipment), '') <> 'BODYWEIGHT' THEN
      RAISE EXCEPTION 'Micro-workouts must use BODYWEIGHT equipment only.';
    END IF;

    IF COALESCE(NEW.finisher, '') <> ''
       OR COALESCE(NEW.warm_up, '') <> ''
       OR COALESCE(NEW.activation, '') <> ''
       OR COALESCE(NEW.cool_down, '') <> '' THEN
      RAISE EXCEPTION 'Micro-workouts must be one 5-minute Main Workout only: no warm-up, activation, finisher, or cool-down.';
    END IF;

    content_blob := lower(
      COALESCE(NEW.name, '') || ' ' ||
      COALESCE(NEW.description, '') || ' ' ||
      COALESCE(NEW.main_workout, '') || ' ' ||
      COALESCE(NEW.instructions, '') || ' ' ||
      COALESCE(NEW.tips, '') || ' ' ||
      COALESCE(NEW.notes, '')
    );

    IF content_blob ~ forbidden_pattern THEN
      RAISE EXCEPTION 'Micro-workouts may only use bodyweight plus office/home surfaces: floor, wall, stairs, chair, desk, or sofa.';
    END IF;

    IF NEW.main_workout IS NULL OR NEW.main_workout !~ '\{\{exercise:[^:}]+:[^}]+\}\}' THEN
      RAISE EXCEPTION 'Micro-workouts must use linked exercise-library exercises.';
    END IF;

    FOR exercise_ref IN
      SELECT ref.match[1] AS exercise_id,
             ref.match[2] AS exercise_name,
             e.name AS library_name,
             e.equipment
      FROM regexp_matches(NEW.main_workout, '\{\{exercise:([^:}]+):([^}]+)\}\}', 'g') AS ref(match)
      LEFT JOIN public.exercises e ON e.id = ref.match[1]
    LOOP
      IF exercise_ref.library_name IS NULL THEN
        RAISE EXCEPTION 'Micro-workout exercise % is not in the exercise library.', exercise_ref.exercise_name;
      END IF;

      IF lower(COALESCE(exercise_ref.equipment, '')) NOT IN ('body weight', 'bodyweight') THEN
        RAISE EXCEPTION 'Micro-workout exercise % is not bodyweight-only.', exercise_ref.library_name;
      END IF;

      IF lower(exercise_ref.library_name || ' ' || exercise_ref.exercise_name) ~ forbidden_pattern THEN
        RAISE EXCEPTION 'Micro-workout exercise % is not allowed for office/home micro-workouts.', exercise_ref.library_name;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;