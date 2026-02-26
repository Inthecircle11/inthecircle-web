-- Phase 4: 4-Eyes Approval Workflow. No DELETE; append/update only.

CREATE TABLE IF NOT EXISTS admin_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  payload jsonb NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  reason text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status_requested
  ON admin_approval_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_requested_by
  ON admin_approval_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_expires_at
  ON admin_approval_requests (expires_at);

ALTER TABLE admin_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_approval_requests"
  ON admin_approval_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE admin_approval_requests IS '4-eyes approval queue; no deletes. Expired marked by app or job.';
