# Security & Governance Architecture

**Institutional Overview | Enterprise Control System**

*This document describes the governance architecture implemented to support accountability, auditability, and compliance with common control frameworks. Tone is factual and implementation-oriented.*

---

## 1. Governance Architecture Overview

The platform operates an administrative control system that separates duties, records actions in a tamper-evident log, enforces approval workflows for high-impact changes, and monitors control health continuously. Access to administrative functions is restricted by role; destructive or sensitive actions require a second authority (4-eyes). All such actions are written to an append-only audit log with a cryptographic chain. Session lifecycle, anomaly detection, and escalation rules complete the control set.

The system is designed to support attestation for SOC 2, ISO 27001, and GDPR-relevant controls, and to produce evidence on demand for auditors or due diligence.

---

## 2. Control Layers

### 2.1 Role-Based Access Control (RBAC)

Administrative access is gated by allowlists (e.g. environment-based) and role assignments stored in the database. Roles include viewer, moderator, supervisor, compliance, and super_admin. Permissions are mapped to roles (e.g. read_audit, export_audit, manage_roles, delete_users). No administrative user can perform an action without the corresponding permission. Role assignments are audited on change. At least one super_admin is enforced; conflicting role combinations (e.g. moderator and super_admin for the same user) are detected by control health checks.

**Evidence:** Role list and user–role assignments are available via API. Control mapping: SOC2 CC6.1, ISO 27001 A.9.4.1.

### 2.2 Four-Eyes Approval

Destructive or sensitive operations (e.g. user deletion, anonymization, bulk actions) can be configured to require an approval request. A first authority requests the action; a second authority (e.g. supervisor or super_admin) approves or rejects. The approval request, outcome, and timestamps are stored and audited. This implements segregation of duties and reduces single-person risk.

**Evidence:** Approval request log and status via API. Control mapping: ISO 27001 A.6.1.2 (segregation of duties).

### 2.3 Tamper-Evident Audit Chain

Every audit log row includes a hash of its content and the previous row's hash, forming a chain. Altering or deleting any row breaks the chain. Verification endpoints recompute hashes and report validity and the first corrupted row if invalid. Daily snapshots sign the latest chain hash with a server secret (HMAC-SHA256) so that point-in-time integrity can be verified. No DELETE is allowed on the audit table; retention is managed by policy, not row removal.

**Evidence:** Audit export (CSV/JSON), chain verification API, snapshot verification. Control mapping: SOC2 CC7.2, ISO 27001 A.12.4.1, A.12.4.3.

### 2.4 Escalation Engine

Operational metrics (e.g. pending applications, pending reports, overdue data requests, session anomalies, governance review overdue) are compared to thresholds. When a threshold is exceeded, an escalation record is created with metric name, value, and severity (e.g. yellow/red). Escalations are not deleted; they are resolved with notes and timestamps. Open escalations older than a defined window (e.g. 48 hours) are used in control health scoring to surface delayed incident response.

**Evidence:** Escalation list and resolution history via API. Control mapping: SOC2 CC7.3.

### 2.5 Session Governance

Administrative sessions are recorded (e.g. session identifier, IP, user-agent, created_at, last_seen_at). Sessions can be revoked (soft delete: is_active false, revoked_at set). No hard delete of session rows is allowed. New sessions from a different IP for the same admin can trigger an audit event and optional escalation. Concurrent session count and session-anomaly escalations feed into continuous control monitoring.

**Evidence:** Active sessions API, revoke API, audit events for session_anomaly and session_revoked. Control mapping: SOC2 CC6.2.

### 2.6 Continuous Control Monitoring

A daily control-health job evaluates each mapped control (e.g. CC6.1, CC7.2, CC7.3, CC6.2, Art 30) and writes status (healthy / warning / failed) and a 0–100 score to a dedicated table. Checks include: RBAC consistency (no moderator+super_admin, at least one super_admin), audit chain validity, escalation age, session anomalies, and overdue data requests. If no governance review has been logged within a defined window (e.g. 90 days), an escalation is created. Results are exposed via API and dashboard for overall governance score and per-control status.

**Evidence:** Control health API, health run API (for cron), Compliance dashboard. Control mapping: referenced per control in the mapping table.

---

## 3. Compliance Mapping (SOC 2 / ISO 27001 / GDPR)

Controls are mapped to framework criteria and to system components and evidence sources in a database table. Examples:

| Framework | Control / Article | Description | System Component | Evidence Source |
|-----------|-------------------|-------------|------------------|-----------------|
| SOC 2     | CC6.1             | Logical and physical access controls | RBAC | admin_roles, admin_user_roles; roles and admin-users APIs |
| SOC 2     | CC7.2             | System monitoring; security event detection | Audit | admin_audit_log + tamper chain; audit and verify APIs |
| SOC 2     | CC7.3             | Response to security incidents | Escalation | admin_escalations; risk API |
| SOC 2     | CC6.2             | Prior to issuing access credentials | Sessions | admin_sessions; sessions API |
| ISO 27001 | A.9.4.1           | Information access restriction | RBAC | admin_user_roles, admin_roles |
| ISO 27001 | A.12.4.1 / A.12.4.3 | Event logging; administrator logs | Audit | admin_audit_log; audit API |
| ISO 27001 | A.6.1.2           | Segregation of duties | Approval | admin_approval_requests; approvals API |
| GDPR      | Art 30            | Records of processing; data request tracking | Audit / Data requests | admin_audit_log; data_requests; data-requests API |

Evidence generation can be triggered by control code to produce exports or summaries and record them in an evidence registry with timestamp and reference (e.g. API route or export name).

---

## 4. Incident Response Model

- **Detection:** Escalations are created automatically when metrics exceed thresholds; session anomalies and control health checks also surface issues.
- **Triage:** Open escalations are visible in the risk/compliance dashboard with metric, value, and age. Control health status (warning/failed) highlights controls that need attention.
- **Response:** Escalations are resolved with notes and resolved_at; role or session revocation is audited; config changes are audited and can trigger drift detection.
- **Evidence:** Audit log, verification APIs, and evidence registry support post-incident review and auditor requests.

---

## 5. Data Request Handling

Data subject requests (e.g. export, deletion) are tracked in a dedicated table with status (e.g. pending, completed, failed). Overdue pending requests (e.g. older than 24 hours) are counted and can drive control health (e.g. Art 30) and escalations. Processing is documented in audit and, where applicable, in the evidence registry. This supports GDPR Article 30 and related accountability.

---

## 6. Control Health Scoring

Each monitored control receives a score from 0 to 100 and a status (healthy, warning, failed). Scores are based on rule outcomes (e.g. chain valid = 100; no super_admin = 0; overdue data requests or stale escalations reduce the score). The overall governance score is the average of per-control scores. Scores and last-check time are stored and exposed via API and Compliance dashboard for trend and attestation use.

---

*End of whitepaper. For implementation details, refer to API documentation and migration/control-mapping tables.*
