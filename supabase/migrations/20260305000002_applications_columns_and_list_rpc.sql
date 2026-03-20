-- Add missing applications columns (assigned_to, etc.) then create admin_get_applications_page.
-- Run this if you see "column a.assigned_to does not exist" when loading the Applications tab.

-- 1) Ensure set_updated_at() exists (used by applications trigger)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Add assignment + updated_at columns to applications if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'applications') THEN
    ALTER TABLE applications
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
      ADD COLUMN IF NOT EXISTS assignment_expires_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_applications_assigned_expires
      ON applications (assigned_to, assignment_expires_at);
    CREATE INDEX IF NOT EXISTS idx_applications_updated_at
      ON applications (updated_at);
    CREATE INDEX IF NOT EXISTS idx_applications_created_submitted
      ON applications (submitted_at DESC NULLS LAST);
    DROP TRIGGER IF EXISTS applications_updated_at ON applications;
    CREATE TRIGGER applications_updated_at
      BEFORE UPDATE ON applications
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- 3) Admin list RPC (same security context as counts)
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
  ORDER BY a.submitted_at ASC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  OFFSET greatest(0, coalesce(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.admin_get_applications_page(text, text, uuid, int, int) IS
  'Admin: paginated applications list (SECURITY DEFINER). Use for list so it matches admin_get_application_counts visibility.';
