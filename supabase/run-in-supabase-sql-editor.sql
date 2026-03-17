-- Run this entire script in Supabase Dashboard → SQL Editor → New query
-- Fixes: application_status_audit_log_admin_id_fkey when using web admin to approve/reject/waitlist

-- 1) Allow NULL admin_id when change is made via API (no auth context)
ALTER TABLE application_status_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

COMMENT ON COLUMN application_status_audit_log.admin_id IS 'Admin who changed the status; NULL when change was made via API/service role (see admin_audit_log for actor).';

-- 2) Allow applications to carry "who changed status" for the trigger to use
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS status_changed_by_admin_id uuid NULL;

-- 3) Drop any existing trigger on applications that inserts into application_status_audit_log
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.applications'::regclass
      AND t.tgname <> 'applications_updated_at'
      AND (pg_get_functiondef(p.oid) ILIKE '%application_status_audit_log%' OR p.prosrc ILIKE '%application_status_audit_log%')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.applications', r.tgname);
    RAISE NOTICE 'Dropped trigger % on applications', r.tgname;
  END LOOP;
END $$;

-- 4) Trigger function: insert audit row using status_changed_by_admin_id (set by API) or auth.uid()
CREATE OR REPLACE FUNCTION public.applications_status_audit_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_status_audit_log (
      application_id,
      new_status,
      admin_id
    ) VALUES (
      NEW.id,
      NEW.status,
      COALESCE(NEW.status_changed_by_admin_id, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Create trigger
DROP TRIGGER IF EXISTS applications_status_audit_trigger ON public.applications;
CREATE TRIGGER applications_status_audit_trigger
  AFTER UPDATE ON public.applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.applications_status_audit_fn();

COMMENT ON COLUMN applications.status_changed_by_admin_id IS 'Set by API when changing status so audit trigger can record admin.';
