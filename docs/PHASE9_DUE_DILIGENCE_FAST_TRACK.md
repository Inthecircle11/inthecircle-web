# Due Diligence Fast-Track Package

**Checklist for investor or enterprise requests**

When asked for logging controls, role management, incident handling, audit evidence, or data subject handling, use this map to provide the exact API endpoint, evidence export, and compliance control mapping.

---

## 1. Logging controls

| Request | API / export | Evidence / control mapping |
|--------|----------------|----------------------------|
| Where are admin actions logged? | Table: `admin_audit_log`. API: `GET /api/admin/audit` (read_audit). | SOC2 CC7.2; ISO 27001 A.12.4.1, A.12.4.3. |
| Can the log be tampered with? | No. Append-only; each row has `previous_hash` and `row_hash`. Verification: `GET /api/admin/audit/verify`. | Tamper-evident chain; optional daily snapshot signing. |
| Export for auditors | `GET /api/admin/audit?format=csv` (export_audit). | Evidence type: export. Control: CC7.2, A.12.4.x. |

---

## 2. Role management

| Request | API / export | Evidence / control mapping |
|--------|----------------|----------------------------|
| Who can do what? | `GET /api/admin/roles`, `GET /api/admin/admin-users`. Roles and permissions are defined in code (RBAC matrix). | SOC2 CC6.1; ISO 27001 A.9.4.1. |
| Who changed roles? | Audit actions: `role_assign`, `role_remove`. Filter audit log by action. | Same controls; evidence: audit log export. |
| Segregation of duties | Approval workflow for destructive actions: `GET /api/admin/approvals`. | ISO 27001 A.6.1.2. |

---

## 3. Incident handling

| Request | API / export | Evidence / control mapping |
|--------|----------------|----------------------------|
| How are incidents detected? | Escalations created when metrics exceed thresholds. `GET /api/admin/risk` returns open escalations and KPIs. | SOC2 CC7.3. |
| How are they resolved? | Escalations resolved via API with notes; action audited (`escalation_resolve`). No delete of escalation rows. | Same; evidence: audit + escalation list. |
| Session anomalies | New session from different IP can create audit event and escalation (`session_anomaly`). Active sessions: `GET /api/admin/sessions`. | SOC2 CC6.2. |

---

## 4. Audit evidence

| Request | API / export | Evidence / control mapping |
|--------|----------------|----------------------------|
| List of controls and evidence sources | `GET /api/admin/compliance/controls`. | Returns framework, control code, description, component, evidence_source. |
| Generate evidence for a control | `POST /api/admin/compliance/evidence/generate` with `control_code`. Stores record in evidence registry. | Control codes: CC6.1, CC7.2, CC7.3, CC6.2, Art 30, etc. |
| List evidence records | `GET /api/admin/compliance/evidence` (optional `?control_code=CC7.2`). Returns reproduce instructions. | Per control_code. |
| Governance / control health | `GET /api/admin/compliance/health` (overall score, per-control status). Run checks: `POST /api/admin/compliance/health/run`. | CCM; supports attestation. |

---

## 5. Data subject handling (GDPR)

| Request | API / export | Evidence / control mapping |
|--------|----------------|----------------------------|
| How are data requests tracked? | Table: `data_requests`. API: `GET /api/admin/data-requests`. | GDPR Art 30. |
| Overdue requests | Count of pending requests older than threshold; reflected in control health (Art 30) and escalations. | Same; evidence: data-requests API + control health. |
| Records of processing | Audit log captures admin actions; data request handling is auditable. | Art 30; evidence: audit export + data_requests. |

---

## Quick reference: permission required

- **read_audit** — Audit log (JSON), chain verify, controls list, evidence list, governance reviews, control health.
- **export_audit** — Audit CSV, evidence generate, health run.
- **manage_roles** — Assign/remove roles; session revoke.
- **read_risk** — Risk dashboard (escalations).
- **resolve_escalations** — Resolve escalation.
- **active_sessions** — List admin sessions.

All endpoints are under `/api/admin/` and require authenticated admin (allowlist + role).
