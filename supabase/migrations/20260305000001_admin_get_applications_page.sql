-- Admin: paginated applications list with same security context as admin_get_application_counts.
-- Use this for the list query so RLS/schema cannot cause "counts show N but list empty".
CREATE OR REPLACE FUNCTION public.admin_get_applications_page(
  p_status text DEFAULT 'all',
  p_filter text DEFAULT 'all',
  p_assigned_to uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS SETOF applications
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.*
  FROM applications a
  WHERE
    -- Status filter (same as API route statusMap)
    CASE p_status
      WHEN 'all' THEN true
      WHEN 'pending' THEN upper(trim(coalesce(a.status::text, ''))) IN ('SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING')
      WHEN 'approved' THEN upper(trim(coalesce(a.status::text, ''))) IN ('ACTIVE', 'APPROVED')
      WHEN 'rejected' THEN upper(trim(coalesce(a.status::text, ''))) = 'REJECTED'
      WHEN 'waitlisted' THEN upper(trim(coalesce(a.status::text, ''))) IN ('WAITLISTED', 'WAITLIST')
      WHEN 'waitlist' THEN upper(trim(coalesce(a.status::text, ''))) IN ('WAITLISTED', 'WAITLIST')
      WHEN 'suspended' THEN upper(trim(coalesce(a.status::text, ''))) = 'SUSPENDED'
      ELSE true
    END
    AND
    -- Assignment filter (same as API route)
    CASE p_filter
      WHEN 'all' THEN true
      WHEN 'unassigned' THEN (a.assigned_to IS NULL OR a.assignment_expires_at < now())
      WHEN 'assigned_to_me' THEN a.assigned_to = p_assigned_to AND a.assignment_expires_at >= now()
      ELSE true
    END
  ORDER BY a.submitted_at ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  OFFSET greatest(0, coalesce(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.admin_get_applications_page(text, text, uuid, int, int) IS
  'Admin: paginated applications list (SECURITY DEFINER). Use for list so it matches admin_get_application_counts visibility.';
