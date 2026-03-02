-- Fix admin_get_application_counts to handle all status variations
CREATE OR REPLACE FUNCTION public.admin_get_application_counts()
RETURNS TABLE (
  pending bigint,
  approved bigint,
  rejected bigint,
  waitlisted bigint,
  suspended bigint,
  total bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) IN ('SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'))::bigint AS pending,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'))::bigint AS approved,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) = 'REJECTED')::bigint AS rejected,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) IN ('WAITLISTED', 'WAITLIST'))::bigint AS waitlisted,
    count(*) FILTER (WHERE upper(trim(coalesce(status::text, ''))) = 'SUSPENDED')::bigint AS suspended,
    count(*)::bigint AS total
  FROM applications;
$$;

COMMENT ON FUNCTION public.admin_get_application_counts() IS 'Admin: application counts by status for filter tabs';
