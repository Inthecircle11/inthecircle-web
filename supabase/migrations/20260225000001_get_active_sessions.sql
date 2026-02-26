-- Concurrent active users: list users with a session updated in the last N minutes.
-- Uses updated_at or refreshed_at or created_at (Supabase schema varies). SECURITY DEFINER so it can read auth schema.
CREATE OR REPLACE FUNCTION public.get_active_sessions(active_minutes integer DEFAULT 15)
RETURNS TABLE (
  user_id uuid,
  email text,
  last_active_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    s.user_id,
    u.email::text,
    GREATEST(COALESCE(s.updated_at, s.refreshed_at, s.created_at), s.created_at) AS last_active_at
  FROM auth.sessions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE GREATEST(COALESCE(s.updated_at, s.refreshed_at, s.created_at), s.created_at) > now() - (active_minutes || ' minutes')::interval
  ORDER BY last_active_at DESC;
$$;

COMMENT ON FUNCTION public.get_active_sessions(integer) IS 'Admin: list users with active session in last N minutes (for concurrent active analytics).';
