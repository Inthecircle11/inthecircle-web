-- RBAC: admin roles and assignments. Production-safe, IF NOT EXISTS, no data loss.
-- Backfill: allowlisted admins get super_admin on first request (app-level).

-- -----------------------------------------------------------------------------
-- 1) admin_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_roles IS 'RBAC role definitions for admin panel';

-- -----------------------------------------------------------------------------
-- 2) admin_user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_admin_user_id ON admin_user_roles(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role_id ON admin_user_roles(role_id);

COMMENT ON TABLE admin_user_roles IS 'Assigns roles to admin users (RBAC)';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_roles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read roles (needed for admin UI)
CREATE POLICY "Allow read admin_roles for authenticated"
  ON admin_roles FOR SELECT TO authenticated USING (true);

-- Only service role can insert/update/delete roles (seeded once; managed via API with checks)
CREATE POLICY "Allow all admin_roles for service_role"
  ON admin_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin users can read their own role assignments only
CREATE POLICY "Allow read own admin_user_roles"
  ON admin_user_roles FOR SELECT TO authenticated
  USING (auth.uid() = admin_user_id);

-- Service role can manage assignments (API uses service role for assign/remove and for listing)
CREATE POLICY "Allow all admin_user_roles for service_role"
  ON admin_user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Seed default roles (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO admin_roles (name, description) VALUES
  ('viewer', 'Read-only access to admin pages; cannot mutate data'),
  ('moderator', 'Approve/reject applications; resolve reports; cannot delete or anonymize users'),
  ('supervisor', 'Moderator + bulk reject, suspend users; cannot delete users'),
  ('compliance', 'Access audit log, export audit, view data requests; cannot modify users'),
  ('super_admin', 'Full access including delete/anonymize and role management')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- DOWN (manual rollback)
-- -----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS admin_user_roles;
-- DROP TABLE IF EXISTS admin_roles;
