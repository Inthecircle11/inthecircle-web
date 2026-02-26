-- Phase 8: Continuous Control Monitoring (CCM).
-- admin_control_health: status, score, last_checked per control.

CREATE TABLE IF NOT EXISTS admin_control_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'warning', 'failed')),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  score integer NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_control_health_control_code
  ON admin_control_health (control_code);

COMMENT ON TABLE admin_control_health IS 'CCM: per-control health status and score (0-100). Updated by daily job.';

ALTER TABLE admin_control_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_control_health"
  ON admin_control_health FOR ALL TO service_role USING (true) WITH CHECK (true);
