CREATE OR REPLACE FUNCTION public.free_access_mode_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (s.setting_value #>> '{}')::boolean
     FROM public.system_settings s
     WHERE s.setting_key = 'free_access_mode'),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.free_access_mode_enabled() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_has_active_premium_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (_user_id IS NOT NULL AND public.free_access_mode_enabled())
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_subscriptions us
      WHERE us.user_id = _user_id
        AND us.status = 'active'::public.subscription_status
        AND us.plan_type IN ('lifetime'::public.plan_type, 'legacy_premium'::public.plan_type, 'premium'::public.plan_type)
    )
    OR EXISTS (
      SELECT 1
      FROM public.corporate_subscriptions cs
      WHERE cs.admin_user_id = _user_id
        AND cs.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.corporate_members cm
      JOIN public.corporate_subscriptions cs
        ON cs.id = cm.corporate_subscription_id
      WHERE cm.user_id = _user_id
        AND cs.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_visible_program_metadata(_program_id text DEFAULT NULL::text)
RETURNS TABLE(id text, name text, category text, duration text, description text, image_url text, is_premium boolean, tier_required text, difficulty text, equipment text, weeks integer, days_per_week integer, difficulty_stars integer, is_standalone_purchase boolean, price numeric, stripe_product_id text, stripe_price_id text, is_free boolean, is_visible boolean, serial_number integer, created_at timestamp with time zone, updated_at timestamp with time zone, overview text, target_audience text, program_structure text, weekly_schedule text, progression_plan text, nutrition_tips text, expected_results text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ap.id, ap.name, ap.category, ap.duration, ap.description, ap.image_url,
    ap.is_premium, ap.tier_required, ap.difficulty, ap.equipment, ap.weeks,
    ap.days_per_week, ap.difficulty_stars, ap.is_standalone_purchase, ap.price,
    ap.stripe_product_id, ap.stripe_price_id, ap.is_free, ap.is_visible,
    ap.serial_number, ap.created_at, ap.updated_at,
    CASE WHEN unlocked THEN ap.overview ELSE NULL END,
    CASE WHEN unlocked THEN ap.target_audience ELSE NULL END,
    CASE WHEN unlocked THEN ap.program_structure ELSE NULL END,
    CASE WHEN unlocked THEN ap.weekly_schedule ELSE NULL END,
    CASE WHEN unlocked THEN ap.progression_plan ELSE NULL END,
    CASE WHEN unlocked THEN ap.nutrition_tips ELSE NULL END,
    CASE WHEN unlocked THEN ap.expected_results ELSE NULL END
  FROM public.admin_training_programs ap
  CROSS JOIN LATERAL (
    SELECT (COALESCE(ap.is_premium, false) = false)
        OR public.user_has_active_premium_access(auth.uid())
        OR public.user_has_purchased_content(auth.uid(), 'program', ap.id) AS unlocked
  ) u
  WHERE COALESCE(ap.is_visible, true) = true
    AND (_program_id IS NULL OR ap.id = _program_id);
$$;

CREATE OR REPLACE FUNCTION public.get_visible_workout_metadata(_workout_id text DEFAULT NULL::text)
RETURNS TABLE(id text, name text, type text, category text, description text, duration text, equipment text, difficulty text, difficulty_stars integer, focus text, format text, image_url text, is_premium boolean, tier_required text, is_standalone_purchase boolean, price numeric, stripe_product_id text, stripe_price_id text, is_workout_of_day boolean, generated_for_date date, is_free boolean, is_visible boolean, serial_number integer, created_at timestamp with time zone, updated_at timestamp with time zone, wod_source text, warm_up text, activation text, main_workout text, finisher text, cool_down text, instructions text, tips text, notes text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    aw.id, aw.name, aw.type, aw.category, aw.description, aw.duration, aw.equipment,
    aw.difficulty, aw.difficulty_stars, aw.focus, aw.format, aw.image_url, aw.is_premium,
    aw.tier_required, aw.is_standalone_purchase, aw.price, aw.stripe_product_id,
    aw.stripe_price_id, aw.is_workout_of_day, aw.generated_for_date, aw.is_free,
    aw.is_visible, aw.serial_number, aw.created_at, aw.updated_at, aw.wod_source,
    CASE WHEN unlocked THEN aw.warm_up ELSE NULL END,
    CASE WHEN unlocked THEN aw.activation ELSE NULL END,
    CASE WHEN unlocked THEN aw.main_workout ELSE NULL END,
    CASE WHEN unlocked THEN aw.finisher ELSE NULL END,
    CASE WHEN unlocked THEN aw.cool_down ELSE NULL END,
    CASE WHEN unlocked THEN aw.instructions ELSE NULL END,
    CASE WHEN unlocked THEN aw.tips ELSE NULL END,
    CASE WHEN unlocked THEN aw.notes ELSE NULL END
  FROM public.admin_workouts aw
  CROSS JOIN LATERAL (
    SELECT (COALESCE(aw.is_premium, false) = false)
        OR public.user_has_active_premium_access(auth.uid())
        OR public.user_has_purchased_content(auth.uid(), 'workout', aw.id) AS unlocked
  ) u
  WHERE COALESCE(aw.is_visible, true) = true
    AND (_workout_id IS NULL OR aw.id = _workout_id);
$$;