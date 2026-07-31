CREATE OR REPLACE FUNCTION public.corporate_subscription_billing_unchanged(
  _id uuid,
  _status text,
  _plan_type public.corporate_plan_type,
  _max_users integer,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _current_period_end timestamp with time zone
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.corporate_subscriptions cs
    WHERE cs.id = _id
      AND cs.status = _status
      AND cs.plan_type = _plan_type
      AND cs.max_users = _max_users
      AND cs.stripe_customer_id IS NOT DISTINCT FROM _stripe_customer_id
      AND cs.stripe_subscription_id IS NOT DISTINCT FROM _stripe_subscription_id
      AND cs.current_period_end IS NOT DISTINCT FROM _current_period_end
  )
$$;

DROP POLICY IF EXISTS "Corporate admins can update own subscription" ON public.corporate_subscriptions;

CREATE POLICY "Corporate admins can update own subscription"
ON public.corporate_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = admin_user_id)
WITH CHECK (
  auth.uid() = admin_user_id
  AND public.corporate_subscription_billing_unchanged(
    id,
    status,
    plan_type,
    max_users,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_end
  )
);