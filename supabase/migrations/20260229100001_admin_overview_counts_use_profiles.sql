-- Use public.profiles for total users and new-user counts so numbers match "users with a profile"
-- (excludes auth-only accounts that never completed signup). New-user windows use auth.users.created_at
-- for users who have a profile, so "last 30d" is signups in last 30 days among profile users.
CREATE OR REPLACE FUNCTION public.admin_get_overview_counts()
RETURNS TABLE (
  total_users bigint,
  verified_count bigint,
  new_users_24h bigint,
  new_users_7d bigint,
  new_users_30d bigint,
  total_threads bigint,
  total_messages bigint,
  applications_7d bigint,
  applications_approved_7d bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    (SELECT count(*)::bigint FROM public.profiles),
    (SELECT count(DISTINCT user_id)::bigint FROM public.verification_requests WHERE upper(trim(coalesce(status::text, ''))) = 'APPROVED'),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '24 hours'),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '7 days'),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '30 days'),
    (SELECT count(*)::bigint FROM public.message_threads),
    (SELECT count(*)::bigint FROM public.messages),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days'),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days' AND upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'));
$$;

COMMENT ON FUNCTION public.admin_get_overview_counts() IS 'Admin: dashboard counts. Total/new users from profiles (and auth signup date for new 24h/7d/30d).';
