-- Overview card counts in one round-trip for fast admin dashboard.
-- SECURITY DEFINER so we can read auth.users. Run with overview-stats API.
CREATE OR REPLACE FUNCTION public.admin_get_overview_counts()
RETURNS TABLE (
  total_users bigint,
  verified_count bigint,
  new_users_24h bigint,
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
    (SELECT count(*)::bigint FROM auth.users),
    (SELECT count(DISTINCT user_id)::bigint FROM public.verification_requests WHERE upper(trim(coalesce(status::text, ''))) = 'APPROVED'),
    (SELECT count(*)::bigint FROM auth.users WHERE created_at > now() - interval '24 hours'),
    (SELECT count(*)::bigint FROM auth.users WHERE created_at > now() - interval '30 days'),
    (SELECT count(*)::bigint FROM public.message_threads),
    (SELECT count(*)::bigint FROM public.messages),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days'),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days' AND upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'));
$$;

COMMENT ON FUNCTION public.admin_get_overview_counts() IS 'Admin: dashboard card counts in one query (users, verified, new 24h/30d, threads, messages, apps 7d).';
