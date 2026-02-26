-- Phase 2: Assignment model + conflict safety + SLA + idempotency.
-- Safe: IF NOT EXISTS, no data loss. Backward compatible.

-- -----------------------------------------------------------------------------
-- 1) user_reports: assignment + updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE user_reports
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_expires_at timestamptz;

UPDATE user_reports SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_reports_assigned_expires
  ON user_reports (assigned_to, assignment_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_reports_updated_at
  ON user_reports (updated_at);

-- Trigger: set updated_at on update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_reports_updated_at ON user_reports;
CREATE TRIGGER user_reports_updated_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) applications: assignment + updated_at (table may exist elsewhere)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3) admin_idempotency_keys
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  response_status int NOT NULL,
  response_body text NOT NULL,
  response_hash text
);

CREATE INDEX IF NOT EXISTS idx_admin_idempotency_admin_created
  ON admin_idempotency_keys (admin_user_id, created_at DESC);

ALTER TABLE admin_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only idempotency"
  ON admin_idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE admin_idempotency_keys IS 'Idempotency-Key replay protection for admin bulk/state-changing actions';

-- -----------------------------------------------------------------------------
-- 4) Versioned application action (optional; use from API when RPC exists)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_application_action_v2(
  p_application_id uuid,
  p_updated_at timestamptz,
  p_action text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_new_status text;
BEGIN
  v_new_status := CASE p_action
    WHEN 'approve' THEN 'ACTIVE'
    WHEN 'reject' THEN 'REJECTED'
    WHEN 'waitlist' THEN 'WAITLISTED'
    WHEN 'suspend' THEN 'SUSPENDED'
    ELSE NULL
  END;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Invalid action %', p_action;
  END IF;
  UPDATE applications
  SET status = v_new_status, updated_at = now()
  WHERE id = p_application_id AND updated_at = p_updated_at
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION admin_application_action_v2 IS 'Versioned application status update; returns id if row updated, NULL if conflict';

-- DOWN (manual):
-- DROP TRIGGER IF EXISTS applications_updated_at ON applications;
-- DROP TRIGGER IF EXISTS user_reports_updated_at ON user_reports;
-- DROP TABLE IF EXISTS admin_idempotency_keys;
-- ALTER TABLE user_reports DROP COLUMN IF EXISTS assigned_to, DROP COLUMN IF EXISTS assigned_at, DROP COLUMN IF EXISTS assignment_expires_at, DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE applications DROP COLUMN IF EXISTS assigned_to, DROP COLUMN IF EXISTS assigned_at, DROP COLUMN IF EXISTS assignment_expires_at, DROP COLUMN IF EXISTS updated_at;
