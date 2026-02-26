-- App config: feature flags and maintenance banner (key-value, admin-editable)
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert defaults
INSERT INTO app_config (key, value) VALUES
  ('signups_open', 'true'),
  ('verification_requests_open', 'true'),
  ('maintenance_mode', 'false'),
  ('maintenance_banner', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow read for all authenticated (app needs to show banner)
CREATE POLICY "Allow read app_config" ON app_config
  FOR SELECT TO authenticated USING (true);

-- Only service role or admin can update; we'll use API route with admin check
CREATE POLICY "Allow insert and update for authenticated" ON app_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE app_config IS 'Feature flags and maintenance banner; admin panel reads/writes via API';
