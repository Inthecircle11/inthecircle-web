-- Fix application_status_audit_log FK: pass admin_id from API and allow NULL when no auth context.
-- If the INSERT in the trigger function fails (e.g. column name mismatch), run in SQL Editor:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'application_status_audit_log';
-- and add a migration that adjusts the INSERT column list to match.
-- 1) Ensure admin_id is nullable (idempotent)
ALTER TABLE application_status_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

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
-- Column names may need to match your table; if this fails see comment at top of file.
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

COMMENT ON COLUMN applications.status_changed_by_admin_id IS 'Set by API when changing status so audit trigger can record admin; cleared after trigger runs if desired.';
