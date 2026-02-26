-- Phase 5: Tamper-evident audit chain. Hash chain + daily snapshots.
-- Requires: pgcrypto for digest().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) admin_audit_log: add hash columns
-- -----------------------------------------------------------------------------
ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS row_hash text;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_asc
  ON admin_audit_log (created_at ASC);

COMMENT ON COLUMN admin_audit_log.previous_hash IS 'row_hash of previous row by created_at ASC';
COMMENT ON COLUMN admin_audit_log.row_hash IS 'SHA256(id|admin_user_id|action|target_type|target_id|details|created_at|previous_hash)';

-- -----------------------------------------------------------------------------
-- 2) Trigger: set previous_hash on INSERT (BEFORE), then row_hash (AFTER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_audit_log_set_previous_hash()
RETURNS TRIGGER AS $$
BEGIN
  SELECT row_hash INTO NEW.previous_hash
  FROM admin_audit_log
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_before_insert_hash ON admin_audit_log;
CREATE TRIGGER admin_audit_log_before_insert_hash
  BEFORE INSERT ON admin_audit_log
  FOR EACH ROW EXECUTE PROCEDURE admin_audit_log_set_previous_hash();

CREATE OR REPLACE FUNCTION admin_audit_log_set_row_hash()
RETURNS TRIGGER AS $$
DECLARE
  payload text;
  new_hash text;
BEGIN
  payload := concat_ws('|',
    NEW.id::text,
    coalesce(NEW.admin_user_id::text, ''),
    coalesce(NEW.action, ''),
    coalesce(NEW.target_type, ''),
    coalesce(NEW.target_id, ''),
    coalesce(NEW.details::text, '{}'),
    coalesce(NEW.created_at::text, ''),
    coalesce(NEW.previous_hash, '')
  );
  new_hash := encode(extensions.digest(payload::bytea, 'sha256'), 'hex');
  UPDATE admin_audit_log SET row_hash = new_hash WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_after_insert_hash ON admin_audit_log;
CREATE TRIGGER admin_audit_log_after_insert_hash
  AFTER INSERT ON admin_audit_log
  FOR EACH ROW EXECUTE PROCEDURE admin_audit_log_set_row_hash();

-- -----------------------------------------------------------------------------
-- 3) Backfill existing rows (ordered by created_at)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  prev text := NULL;
  payload text;
  new_hash text;
BEGIN
  FOR r IN SELECT id, admin_user_id, action, target_type, target_id, details, created_at
            FROM admin_audit_log
            ORDER BY created_at ASC
  LOOP
    payload := concat_ws('|',
      r.id::text,
      coalesce(r.admin_user_id::text, ''),
      coalesce(r.action, ''),
      coalesce(r.target_type, ''),
      coalesce(r.target_id, ''),
      coalesce(r.details::text, '{}'),
      coalesce(r.created_at::text, ''),
      coalesce(prev, '')
    );
    new_hash := encode(extensions.digest(payload::bytea, 'sha256'), 'hex');
    UPDATE admin_audit_log
    SET previous_hash = prev, row_hash = new_hash
    WHERE id = r.id;
    prev := new_hash;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4) admin_audit_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  last_row_hash text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_audit_snapshots_date
  ON admin_audit_snapshots (snapshot_date);

ALTER TABLE admin_audit_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_audit_snapshots"
  ON admin_audit_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE admin_audit_snapshots IS 'Daily HMAC-SHA256(last_row_hash) for tamper-evident verification';
