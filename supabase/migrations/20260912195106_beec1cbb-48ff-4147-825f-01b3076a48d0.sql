GRANT SELECT ON public.workout_comments TO anon;
CREATE POLICY "Anyone can view comments" ON public.workout_comments FOR SELECT TO anon USING (true);
GRANT EXECUTE ON FUNCTION public.get_profile_display_names(uuid[]) TO anon;