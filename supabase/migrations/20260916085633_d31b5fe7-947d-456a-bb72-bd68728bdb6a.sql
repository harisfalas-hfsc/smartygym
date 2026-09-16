CREATE OR REPLACE FUNCTION public.start_admin_generation(
  _content_type text,
  _request_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  _job_id uuid;
  _project_url text;
  _anon_key text;
  _auth_header text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _content_type NOT IN ('workout', 'program') THEN
    RAISE EXCEPTION 'Unsupported content type';
  END IF;

  INSERT INTO public.admin_generation_jobs (user_id, content_type, request_payload)
  VALUES (auth.uid(), _content_type, _request_payload)
  RETURNING id INTO _job_id;

  _project_url := 'https://cvccrvyimyzrxcwzmxwk.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y2NydnlpbXl6cnhjd3pteHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTc2NjIsImV4cCI6MjA3NjE5MzY2Mn0.XU_h4CYRiQ7VN079laFHSVMrzB6urOhQZFoTagU_Wno';
  _auth_header := current_setting('request.headers', true)::jsonb ->> 'authorization';

  PERFORM net.http_post(
    url := _project_url || '/functions/v1/' || CASE WHEN _content_type = 'workout' THEN 'generate-admin-workout' ELSE 'generate-admin-program' END,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', _anon_key,
      'Authorization', _auth_header
    ),
    body := _request_payload || jsonb_build_object('job_id', _job_id)
  );

  RETURN _job_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_admin_generation(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_admin_generation(text, jsonb) TO authenticated;