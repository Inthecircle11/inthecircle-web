-- Fix admin_get_applications_fast to properly filter by status
-- The issue: DB stores 'waitlist' but UI sends 'waitlisted'
-- Also handles NULL/empty status as 'waitlist' (pending review)

DROP FUNCTION IF EXISTS public.admin_get_applications_fast(text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_get_applications_fast(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  review_notes text,
  why_join text,
  what_to_offer text,
  collaboration_goals text,
  phone text,
  assigned_to uuid,
  assigned_at timestamptz,
  assignment_expires_at timestamptz,
  name text,
  username text,
  email text,
  profile_image_url text,
  bio text,
  niche text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id,
    a.user_id,
    COALESCE(NULLIF(TRIM(a.status), ''), 'waitlist') as status,
    a.submitted_at,
    a.updated_at,
    a.review_notes,
    a.why_join,
    a.what_to_offer,
    a.collaboration_goals,
    a.phone,
    a.assigned_to,
    a.assigned_at,
    a.assignment_expires_at,
    p.name,
    p.username,
    p.email,
    p.profile_image_url,
    p.bio,
    p.niche
  FROM applications a
  JOIN profiles p ON p.id = a.user_id
  WHERE (
    p_status IS NULL
    OR p_status = ''
    OR p_status = 'all'
    OR (
      -- Normalize status comparison
      LOWER(COALESCE(NULLIF(TRIM(a.status), ''), 'waitlist')) = LOWER(
        CASE 
          WHEN p_status = 'waitlisted' THEN 'waitlist'
          WHEN p_status = 'pending' THEN 'waitlist'
          ELSE p_status
        END
      )
    )
  )
  ORDER BY a.submitted_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant execute to authenticated users (admin check is done in API)
GRANT EXECUTE ON FUNCTION public.admin_get_applications_fast(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_applications_fast(text, integer, integer) TO service_role;
