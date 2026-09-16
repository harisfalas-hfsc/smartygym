UPDATE public.exercises
SET name = CASE
  WHEN equipment = 'leverage machine' THEN 'machine ' || regexp_replace(name, '^lever\s+', '')
  ELSE regexp_replace(name, '^lever\s+', '')
END
WHERE name ILIKE 'lever %';