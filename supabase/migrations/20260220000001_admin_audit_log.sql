-- Admin audit log: who did what and when (for accountability and debugging)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);

-- RLS: only service role or admin RPC can write; reading can be restricted to admins via RPC
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON admin_audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON TABLE admin_audit_log IS 'Log of admin actions (approve/reject/ban/delete etc.) for audit trail';
