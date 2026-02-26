-- Single-query overview stats for admin dashboard (fast first paint).
-- Returns application counts in one table scan. Uses column "status".
CREATE OR REPLACE FUNCTION public.admin_get_overview_app_stats()
RETURNS TABLE (
  total bigint,
  approved bigint,
  rejected bigint,
  waitlisted bigint,
  suspended bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'))::bigint AS approved,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) = 'REJECTED')::bigint AS rejected,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) = 'WAITLISTED')::bigint AS waitlisted,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) = 'SUSPENDED')::bigint AS suspended
  FROM applications;
$$;

COMMENT ON FUNCTION public.admin_get_overview_app_stats() IS 'Admin: application counts in one query for fast overview. Uses status column.';
