-- Fix applications list and search: applications table has no email/name/username columns.
-- The 6-arg admin_get_applications_page and admin_get_applications_search_total referenced
-- a.email, a.name, a.username causing "column a.email does not exist" and breaking the list.
-- Search only profiles.email, auth.users.email, profiles.name, profiles.username, and
-- applications.application_company_email (for brand applications).
-- Also drop the 5-arg overload so the 6-arg is the only one (avoids ambiguous call when client omits p_search).

DROP FUNCTION IF EXISTS public.admin_get_applications_page(text, text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_applications_page(
  p_status text DEFAULT 'all',
  p_filter text DEFAULT 'all',
  p_assigned_to uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS SETOF applications
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  search_term text;
BEGIN
  search_term := trim(coalesce(p_search, ''));
  RETURN QUERY
  SELECT a.*
  FROM applications a
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN auth.users u ON u.id = a.user_id
  WHERE
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
    CASE p_filter
      WHEN 'all' THEN true
      WHEN 'unassigned' THEN (a.assigned_to IS NULL OR a.assignment_expires_at < now())
      WHEN 'assigned_to_me' THEN a.assigned_to = p_assigned_to AND a.assignment_expires_at >= now()
      ELSE true
    END
    AND (
      search_term = '' OR (
        (p.email IS NOT NULL AND p.email ILIKE '%' || search_term || '%')
        OR (u.email IS NOT NULL AND u.email::text ILIKE '%' || search_term || '%')
        OR (p.name IS NOT NULL AND p.name ILIKE '%' || search_term || '%')
        OR (p.username IS NOT NULL AND p.username ILIKE '%' || search_term || '%')
        OR (a.application_company_email IS NOT NULL AND a.application_company_email ILIKE '%' || search_term || '%')
      )
    )
  ORDER BY a.submitted_at ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  OFFSET greatest(0, coalesce(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.admin_get_applications_page(text, text, uuid, int, int, text) IS
  'Admin: paginated applications list with optional search by profile/auth email, name, username, company email (SECURITY DEFINER).';

CREATE OR REPLACE FUNCTION public.admin_get_applications_search_total(
  p_status text DEFAULT 'all',
  p_filter text DEFAULT 'all',
  p_assigned_to uuid DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  search_term text;
  res bigint;
BEGIN
  search_term := trim(coalesce(p_search, ''));
  SELECT count(*)::bigint INTO res
  FROM applications a
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN auth.users u ON u.id = a.user_id
  WHERE
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
    CASE p_filter
      WHEN 'all' THEN true
      WHEN 'unassigned' THEN (a.assigned_to IS NULL OR a.assignment_expires_at < now())
      WHEN 'assigned_to_me' THEN a.assigned_to = p_assigned_to AND a.assignment_expires_at >= now()
      ELSE true
    END
    AND (
      search_term = '' OR (
        (p.email IS NOT NULL AND p.email ILIKE '%' || search_term || '%')
        OR (u.email IS NOT NULL AND u.email::text ILIKE '%' || search_term || '%')
        OR (p.name IS NOT NULL AND p.name ILIKE '%' || search_term || '%')
        OR (p.username IS NOT NULL AND p.username ILIKE '%' || search_term || '%')
        OR (a.application_company_email IS NOT NULL AND a.application_company_email ILIKE '%' || search_term || '%')
      )
    );
  RETURN coalesce(res, 0);
END;
$$;

COMMENT ON FUNCTION public.admin_get_applications_search_total(text, text, uuid, text) IS
  'Admin: total count for applications list with same filters + search (for pagination).';
