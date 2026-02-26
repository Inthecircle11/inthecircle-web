-- Phase 6: Admin Session Governance Layer.
-- admin_sessions: track admin logins, IP, user-agent, revocation. No DELETE.

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  ip_address text,
  user_agent text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_created
  ON admin_sessions (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active
  ON admin_sessions (is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_session_id
  ON admin_sessions (session_id);

COMMENT ON TABLE admin_sessions IS 'Admin session tracking; revocation only (no deletes). Session governance.';

-- Forbid DELETE (revocation only)
CREATE OR REPLACE FUNCTION admin_sessions_forbid_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_sessions: DELETE not allowed; revoke session instead (set is_active=false, revoked_at=now())';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_sessions_forbid_delete_trigger ON admin_sessions;
CREATE TRIGGER admin_sessions_forbid_delete_trigger
  BEFORE DELETE ON admin_sessions
  FOR EACH ROW EXECUTE PROCEDURE admin_sessions_forbid_delete();

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_sessions"
  ON admin_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
