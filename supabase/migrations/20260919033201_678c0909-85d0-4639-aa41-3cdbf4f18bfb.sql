CREATE TABLE public.struct_repair_staging (id text PRIMARY KEY, main_workout text, finisher_clear text);
GRANT ALL ON public.struct_repair_staging TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.struct_repair_staging TO sandbox_exec;
ALTER TABLE public.struct_repair_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.struct_repair_staging FOR ALL TO service_role USING (true) WITH CHECK (true);