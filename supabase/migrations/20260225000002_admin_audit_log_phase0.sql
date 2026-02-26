-- Phase 0 enterprise hardening: admin_audit_log columns and indexes
-- Safe for production: nullable columns (metadata-only in PG11+), IF NOT EXISTS on indexes.
-- Note: CREATE INDEX takes a brief lock; for very large tables consider building indexes
-- with CONCURRENTLY in a separate script run outside a transaction.

-- -----------------------------------------------------------------------------
-- UP: Add columns and indexes
-- -----------------------------------------------------------------------------

-- 1) Nullable columns (no table rewrite, no data loss)
ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS session_id text;

-- 2) Composite index for filtering by admin + time
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_created_at
  ON admin_audit_log (admin_user_id, created_at DESC);

-- 3) Optional index for session lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_session_id
  ON admin_audit_log (session_id);

COMMENT ON COLUMN admin_audit_log.reason IS 'Mandatory for destructive/bulk actions (Phase 0)';
COMMENT ON COLUMN admin_audit_log.client_ip IS 'Client IP from x-forwarded-for / x-real-ip';
COMMENT ON COLUMN admin_audit_log.session_id IS 'Session identifier for audit correlation';

-- -----------------------------------------------------------------------------
-- DOWN (manual rollback: save as .down.sql or run manually)
-- -----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_admin_audit_session_id;
-- DROP INDEX IF EXISTS idx_admin_audit_admin_created_at;
-- ALTER TABLE admin_audit_log
--   DROP COLUMN IF EXISTS reason,
--   DROP COLUMN IF EXISTS client_ip,
--   DROP COLUMN IF EXISTS session_id;
