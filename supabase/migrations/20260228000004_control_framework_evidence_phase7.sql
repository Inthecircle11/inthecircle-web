-- Phase 7: Control Framework & Evidence Layer.
-- Maps admin controls to SOC2, ISO 27001, GDPR; evidence registry; quarterly governance reviews.

-- -----------------------------------------------------------------------------
-- 1) admin_control_framework_mapping
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_control_framework_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework text NOT NULL,
  control_code text NOT NULL,
  control_description text,
  system_component text NOT NULL,
  evidence_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_control_mapping_framework
  ON admin_control_framework_mapping (framework);
CREATE INDEX IF NOT EXISTS idx_admin_control_mapping_control_code
  ON admin_control_framework_mapping (control_code);
CREATE INDEX IF NOT EXISTS idx_admin_control_mapping_component
  ON admin_control_framework_mapping (system_component);

COMMENT ON TABLE admin_control_framework_mapping IS 'Maps compliance frameworks (SOC2, ISO27001, GDPR) to system components and evidence sources.';

-- -----------------------------------------------------------------------------
-- 2) admin_control_evidence
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_control_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_code text NOT NULL,
  evidence_type text NOT NULL,
  reference text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_control_evidence_control_code
  ON admin_control_evidence (control_code);
CREATE INDEX IF NOT EXISTS idx_admin_control_evidence_generated_at
  ON admin_control_evidence (generated_at DESC);

COMMENT ON TABLE admin_control_evidence IS 'Registry of generated evidence (exports, reports) for control attestation.';

-- -----------------------------------------------------------------------------
-- 3) admin_governance_reviews
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_governance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_period text NOT NULL,
  reviewer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_governance_reviews_period
  ON admin_governance_reviews (review_period);
CREATE INDEX IF NOT EXISTS idx_admin_governance_reviews_created
  ON admin_governance_reviews (created_at DESC);

COMMENT ON TABLE admin_governance_reviews IS 'Quarterly governance review log for compliance officers.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE admin_control_framework_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_control_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_governance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only admin_control_framework_mapping"
  ON admin_control_framework_mapping FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only admin_control_evidence"
  ON admin_control_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only admin_governance_reviews"
  ON admin_governance_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Seed: Control mapping examples
-- -----------------------------------------------------------------------------
INSERT INTO admin_control_framework_mapping (framework, control_code, control_description, system_component, evidence_source) VALUES
  ('SOC2', 'CC6.1', 'Logical and physical access controls', 'rbac', 'admin_roles, admin_user_roles; GET /api/admin/roles, /api/admin/admin-users'),
  ('SOC2', 'CC7.2', 'System monitoring; detection of security events', 'audit', 'admin_audit_log + tamper chain; GET /api/admin/audit, /api/admin/audit/verify'),
  ('SOC2', 'CC7.3', 'Response to identified security incidents', 'escalation', 'admin_escalations; GET /api/admin/risk'),
  ('ISO27001', 'A.9.4.1', 'Information access restriction', 'rbac', 'admin_user_roles, admin_roles'),
  ('ISO27001', 'A.12.4.1', 'Event logging', 'audit', 'admin_audit_log; GET /api/admin/audit'),
  ('ISO27001', 'A.12.4.3', 'Administrator and operator logs', 'audit', 'admin_audit_log; GET /api/admin/audit'),
  ('ISO27001', 'A.6.1.2', 'Segregation of duties', 'approval', 'admin_approval_requests; GET /api/admin/approvals'),
  ('GDPR', 'Art 30', 'Records of processing activities', 'audit', 'admin_audit_log; data_requests'),
  ('GDPR', 'Art 30', 'Data request tracking', 'data_requests', 'data_requests; GET /api/admin/data-requests'),
  ('SOC2', 'CC6.2', 'Prior to issuing access credentials', 'sessions', 'admin_sessions; GET /api/admin/sessions')
ON CONFLICT DO NOTHING;
