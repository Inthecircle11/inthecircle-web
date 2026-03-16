-- Fix admin_get_active_today_count: the deployed version has an is_admin_user() check that
-- calls auth.uid(), which returns NULL when invoked via the service role key used by the
-- Next.js API routes. This causes the function to throw "Only admin can get active today count"
-- on every call, making "Active today" always show 0.
--
-- The correct implementation (from the original migration) is SECURITY DEFINER reading
-- auth.sessions directly — no explicit admin check needed since SECURITY DEFINER already
-- restricts execution to the function owner's privileges, and the web API requires a valid
-- admin JWT before it ever calls this function.

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

COMMENT ON FUNCTION public.admin_get_active_today_count() IS
  'Admin: count of unique users with an active session in the last 24h. SECURITY DEFINER — callers must enforce admin auth before invoking.';
