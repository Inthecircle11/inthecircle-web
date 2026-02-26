-- Phase 3: Incident Control Layer — admin_escalations table.
-- Escalations are never deleted; only status open -> resolved.

CREATE TABLE IF NOT EXISTS admin_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  threshold_level text NOT NULL CHECK (threshold_level IN ('yellow', 'red')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_admin_escalations_status_created
  ON admin_escalations (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_escalations_metric_created
  ON admin_escalations (metric_name, created_at DESC);

ALTER TABLE admin_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_escalations"
  ON admin_escalations FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE admin_escalations IS 'Operational risk escalations; no deletes, only resolve. Dedupe per metric per 24h in app.';
