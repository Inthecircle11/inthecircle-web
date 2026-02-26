-- Active today: count of users with a session in the last 24 hours (for "Logged in last 24h" card).
-- SECURITY DEFINER to read auth.sessions. Matches get_active_sessions logic with 24h window.
CREATE OR REPLACE FUNCTION public.admin_get_active_today_count()
RETURNS TABLE (active_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT count(DISTINCT s.user_id)::bigint AS active_count
  FROM auth.sessions s
  WHERE GREATEST(COALESCE(s.updated_at, s.refreshed_at, s.created_at), s.created_at) > now() - interval '24 hours';
$$;

COMMENT ON FUNCTION public.admin_get_active_today_count() IS 'Admin: count of users with active session in last 24h (dashboard Active today card).';
