-- Admin: return user_id and email from auth.users for given ids (for applications list when profile email is null).
-- SECURITY DEFINER so only callable by service role / admin API.
CREATE OR REPLACE FUNCTION public.admin_get_emails_for_user_ids(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id AS user_id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids) AND u.email IS NOT NULL AND u.email != '';
$$;

COMMENT ON FUNCTION public.admin_get_emails_for_user_ids(uuid[]) IS 'Admin: get email for user ids from auth.users (for applications list enrichment).';
