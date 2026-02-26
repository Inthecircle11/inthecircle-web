# Enterprise Governance Stress Test — Admin Panel

**Lens:** Fortune 500 security auditor, SOC2 assessor, enterprise CTO, regulator, COO  
**Purpose:** Hostile audit for enterprise sales, SOC2/ISO/GDPR readiness, and scale to 20+ operators  
**Date:** February 2026.

---

## 1) Catastrophic failure simulation

| Scenario | Prevent | Detect | Escalate | Prove | Current capability | Failure gap | Severity | Required structural upgrade |
|----------|---------|--------|----------|-------|--------------------|-------------|----------|----------------------------|
| **Rogue admin bulk-deletes 500 users** | No hard limit per request; no approval workflow. ConfirmModal (sprint) adds one confirmation; no second approver or rate limit. | Anomaly metric: >= 5 destructive actions in 1h per admin triggers escalation. Bulk delete may generate many audit rows in one hour. | Escalation protocol fires on anomaly; L2/L3. | Audit log has admin_user_id, action, target_type, target_id, created_at. No bulk “delete 500” single row; would be many rows or one row with details.count. Query by admin + action + date. | Partial: anomaly detection and audit exist. No prevention (no rate limit, no second approval). | No rate limit on destructive bulk; no approval workflow; no “reason” required. | **Critical** | Rate limit per admin per hour for delete/anonymize; optional second-approval for bulk > N; mandatory reason field logged. |
| **Rogue admin anonymizes high-profile account** | No restriction by “sensitivity”; any admin can anonymize any user after confirm (then ConfirmModal). | Audit log entry with target_id; anomaly count may not fire for single action. | Single anonymize does not breach anomaly threshold (5 in 1h). No escalation for “sensitive” target. | Audit: who, what (anonymize), target user id, when. Proven. | Detect and prove: yes. Prevent and escalate single high-impact action: no. | No sensitivity tagging; no escalation for single destructive action on high-value account; no reason captured. | **High** | Optional sensitivity flag or VIP list; escalation or alert on anonymize/delete of flagged account; mandatory reason for destructive action. |
| **Rogue admin rejects 100 applications** | Bulk reject has confirmation (then ConfirmModal + audit). No cap on selection size. | Audit: bulk reject with count in details. Anomaly metric is delete/anonymize only, not bulk reject. | Protocol does not define escalation for “bulk reject 100” unless tied to a separate metric. | Audit proves who rejected what (target_type application, target_ids or count in details). | Confirm + audit; no prevention cap; no anomaly escalation for bulk reject. | No max selection size; no anomaly trigger for bulk reject; no reason. | **High** | Cap bulk reject at N (e.g. 50) or require reason; add anomaly rule for bulk reject above threshold. |
| **Admin ignores data requests for 45 days** | No automatic escalation in UI; overdue triggers L2 in protocol but requires metrics job to run and notify. | Data Requests Overdue metric (pending + due_at or created_at > 30d). | Protocol: Red when overdue > 0; L2; L3 if > 48h. | data_requests table: status, created_at, due_at (if present). No audit of “viewed but not acted.” | Detect: yes if metrics run. Escalate: yes per protocol. Prevent: no (no lock or reassignment). | No in-UI visibility of overdue until operational strip exists; no mandatory assignment; metrics/elevation must be running. | **Critical** | Operational strip in UI showing overdue count; mandatory owner per request when overdue; evidence that escalation ran (logged). |

**Summary:** System can **detect** and **prove** (audit) in most cases. **Prevent** is weak: no rate limits, no approval workflow, no mandatory reason. **Escalate** exists on paper (protocol) but depends on metrics and notification being implemented and running; single high-impact destructive action does not auto-escalate.

---

## 2) Regulatory & legal readiness

| Requirement | Current state | Gap |
|-------------|---------------|-----|
| **Data subject request handling transparency** | data_requests table; status (pending/completed/failed); PATCH to update. No due_at in schema in all environments; spec uses created_at + 30d as fallback. | Due date and “overdue” not consistently in schema or UI; no public-facing status page for requester. |
| **Evidence retention** | admin_audit_log retained; protocol says ≥ 1 year (documented). No automated purge policy stated in code. | Retention is policy-only; no technical retention lock or export-to-cold-storage. |
| **Action reason capture** | Optional notes on report resolve/dismiss. No reason field for delete, anonymize, or bulk reject. | Destructive and bulk actions have no mandatory “reason” — weak for “demonstrate necessity” under GDPR. |
| **Export capability** | Audit GET returns entries (limit/offset). No filter by admin, target, action type, or date range. No CSV/export endpoint. | “Show all actions by admin X over last 90 days” **cannot be done instantly**; would require full fetch and client filter or new API. |
| **Immutable audit trail** | Table has RLS; no UPDATE/DELETE policy on admin_audit_log → append-only. | Immutability by policy only; no hash chain or signing; DB admin could alter. |
| **Time-bound SLA visibility** | Overdue defined in metrics spec; not yet in UI. No “due in X days” on data request rows in UI. | Regulator cannot see SLA state in product; evidence is in separate metrics/dashboards if at all. |
| **Access logging (IP, device, session)** | Audit stores admin_user_id, admin_email, action, target_type, target_id, details, created_at. **No IP, device, or session id.** | Cannot prove “this admin from this IP at this session”; weak for breach investigation and non-repudiation. |

**Regulator request: “Show all actions by admin X over last 90 days.”**  
**Answer:** No. Current API returns last N entries (max 200) with no filter. Required: audit API (or export) with filters: admin_user_id, date_from, date_to, optional action_type; and export (e.g. CSV) for legal hold.

---

## 3) Enterprise RBAC maturity

| Criterion | Current state | Gap |
|-----------|---------------|-----|
| **Roles granular?** | No. Single effective role: admin (allowlist via ADMIN_USER_IDS, ADMIN_EMAILS). All admins can do everything. | No read-only, no “reports only,” no “applications only.” |
| **Permissions visible?** | No. No in-UI list of “who can do what.” Allowlist is in env; removal requires deploy. | Operators and auditors cannot see permission set. |
| **Least-privilege enforced?** | No. Every admin has full access to all queues and destructive actions. | Cannot restrict high-impact actions to a subset of admins. |
| **Destructive permissions isolatable?** | No. Any admin can delete, anonymize, bulk reject. | No way to restrict delete/anonymize to “supervisor” or “compliance” role. |
| **Approval workflow for high-risk actions?** | No. ConfirmModal (sprint) is single-step confirm; no second human approval. | No 4-eyes for delete, anonymize, or bulk reject. |

**Verdict:** RBAC is **not** enterprise-grade. Required for 20+ operators: role model (e.g. viewer, moderator, supervisor, admin), permission matrix, and optional approval workflow for destructive or bulk actions above threshold.

---

## 4) Operational scalability (20+ moderators)

| Criterion | Current state | Gap |
|-----------|---------------|-----|
| **Workload distributable?** | Queues are shared; no assignment of “my reports” vs “your reports.” Anyone can work any item. | No assignment or routing; possible duplicate work or under-coverage. |
| **Conflict awareness (two admins, same record)?** | None. No optimistic locking or “user X is editing” indicator. Two admins can approve/reject same application or update same report. | Risk of double action or overwrite; no merge or conflict resolution. |
| **Actions idempotent?** | Bulk and single actions are not documented as idempotent. Re-submit may change state again. | Retries or double-clicks can cause duplicate state change; no idempotency keys. |
| **Queues sortable by SLA breach?** | Applications and reports are sorted by date (e.g. created_at desc). No “overdue” or “due soon” sort. | Cannot triage by SLA; oldest may be buried. |
| **Prioritization logic?** | No. No priority field, no “oldest first” default, no risk score. | All items equal; no built-in prioritization. |

**Verdict:** System does **not** support 20+ operators with distribution, conflict safety, or SLA-based triage. Required: assignment or routing, conflict detection or locking, SLA sort/filter, and idempotency for critical writes.

---

## 5) Incident response surface

| Criterion | Current state | Gap |
|-----------|---------------|-----|
| **Live risk dashboard?** | No. Metrics and thresholds are in spec; no dedicated “risk” or “incident” view in admin UI. | Operators cannot see “system risk” in one place. |
| **Yellow/Red metrics visible in UI?** | Overview/Dashboard show KPIs (counts). No Yellow/Red state or “breach” indicator in UI. Operational strip (pending, overdue) is recommended but not yet implemented. | Escalation depends on external job or manual check; not visible in product. |
| **Escalation visible?** | Escalation events are logged (protocol); no in-UI list of “active escalations” or “L2/L3 open.” | Incident commander cannot see open incidents in admin. |
| **One-screen system state?** | No. Commander must open multiple tabs and mentally aggregate. | No single “incident” or “ops status” page. |

**Verdict:** Incident response is **document-driven** (protocol) not **UI-driven**. Required: at least one view with backlog counts, overdue counts, and open escalation list (or link to runbook/incident store).

---

## 6) Human error resistance

| Criterion | Current state | Gap |
|-----------|---------------|-----|
| **Reason input required?** | No. Report resolve/dismiss can have optional notes. Delete, anonymize, bulk reject have no reason field. | Cannot demonstrate “necessity” or “business reason” for destructive action. |
| **Bulk action previewed?** | Bulk bar shows count (“N selected”). No preview of identities (e.g. list of usernames or “first 5”) before confirm. | Operator may confirm without verifying selection. |
| **Irreversible actions clearly separated?** | Reject, Delete, Anonymize use danger styling; ConfirmModal (sprint) adds explicit confirm. | Separation is clear; no additional friction (e.g. type “DELETE”). |
| **Friction proportional to risk?** | Bulk reject: one confirm. Delete/anonymize: one confirm. Bulk approve: no confirm. | Asymmetry (approve vs reject) is reasonable; destructive could require reason or second step. |

**Verdict:** Friction exists but **reason capture** and **bulk preview** are missing. Required: mandatory reason for destructive and bulk-destructive actions; optional bulk preview (e.g. “You are about to reject: [first 5] and 95 others”).

---

## 7) Audit log as evidence (not decoration)

| Criterion | Current state | Gap |
|-----------|---------------|-----|
| **Filter by admin?** | No. GET audit has limit/offset only. No admin_user_id filter. | Cannot produce “all actions by admin X” without full scan client-side or new API. |
| **Filter by target user?** | No. target_type/target_id not in API params. Index exists on (target_type, target_id). | Cannot produce “all actions affecting user Y” via API. |
| **Filter by action type?** | No. action not in API params. Index on action. | Cannot produce “all deletes” via API. |
| **Filter by date range?** | No. Order is created_at desc; no from/to params. | Cannot produce “last 90 days” without paginating and filtering client-side. |
| **Export?** | No. No CSV or bulk export endpoint. | Cannot hand off to legal or regulator in standard format. |
| **Immutable?** | Append-only by RLS (no UPDATE/DELETE policy). | Yes at DB layer for normal users. |
| **Tamper-evident?** | No hash chain, no signing. | DB admin or compromise could alter history; not tamper-evident. |

**Verdict:** Audit is **write-only evidence**; **read** is list-only. For enterprise and regulator: add filter params (admin, target, action, date_from, date_to), add export (CSV/JSON), and consider append-only export or hash chain for tamper-evidence.

---

## 8) Enterprise UX expectations

| Expectation | Current state | Gap |
|-------------|---------------|-----|
| **Advanced filtering** | Applications: search (name, username, email, niche); filter tabs by status. Reports: status filter (sprint). Users: filter pills. Data requests: list only. | No multi-criteria filter (e.g. status + date range + niche). |
| **Multi-column sort** | Tables/lists use single sort (e.g. created_at desc). No user-selectable sort by column. | Cannot sort by “oldest first,” “status,” “assignee,” etc. |
| **Saved filters** | None. | No “My pending reports” or “Overdue data requests” saved view. |
| **Search by ID** | Search is by name, username, email. No documented “search by user id or application id.” | Support and audit often need ID lookup. |
| **Bulk selection clarity** | Checkbox per row; “Select all” / “Deselect.” Bulk bar shows count. No “preview selection” list. | Adequate; preview would reduce misselection. |
| **Session transparency** | No “you are logged in as X” or “session expires at” in prominent place. No list of “active admin sessions.” | Operators cannot verify identity or see concurrent sessions. |
| **Security posture visibility** | No MFA status, last login, or “admins with access” in UI. | Enterprise expects visibility into who has access and how they sign in. |

---

## 9) Enterprise readiness score

| Dimension | Score (1–10) | Why |
|-----------|--------------|-----|
| **Catastrophic failure resistance** | 3 | Detect and prove exist; prevent and escalate are weak. No rate limits, no approval workflow, no reason. |
| **Regulatory & legal** | 4 | Audit exists and is append-only; no filter/export, no IP/session, no mandatory reason, no instant “admin X last 90 days.” |
| **RBAC maturity** | 2 | Single role; no granularity, no visibility, no least-privilege. |
| **Operational scalability** | 3 | No assignment, no conflict awareness, no SLA sort, no idempotency. |
| **Incident response surface** | 3 | Protocol exists; no live risk dashboard, no Yellow/Red in UI, no escalation visibility in product. |
| **Human error resistance** | 5 | Confirm and danger styling; no reason, no bulk preview. |
| **Audit as evidence** | 4 | Append-only; no filter/export, not tamper-evident. |
| **Enterprise UX** | 4 | Core flows work; no advanced filter/sort, no saved filters, no session/security visibility. |

**Overall (unweighted):** ~3.5 / 10. Not enterprise-ready without structural upgrades.

---

### Immediate blockers (must fix before enterprise)

1. **Audit API:** Add filter by admin_user_id, target_type/target_id, action, date_from/date_to; add CSV (or JSON) export. Without this, “show all actions by admin X over 90 days” cannot be answered.
2. **Data request SLA visibility:** Surface “overdue” and “due soon” in UI (operational strip or Data Requests tab); ensure due_at or equivalent in schema and API.
3. **Destructive action controls:** Mandatory reason field for delete, anonymize, bulk reject (stored in audit details); rate limit or cap on bulk destructive (e.g. max 50 per request or per hour per admin).
4. **Remove placebo:** Ensure no fake actions (e.g. “Clear Cache”); replace with Refresh All Data and last-updated (per sprint).
5. **Access logging:** Log IP (and optionally device/session) on audit insert or in separate access_log; required for non-repudiation and breach investigation.

---

### 60-day upgrade plan

| Week | Focus | Deliverables |
|------|--------|---------------|
| 1–2 | Audit and evidence | Audit API with filters (admin, target, action, date range); audit export (CSV); document retention and export in runbook. |
| 2–3 | Data request and SLA | due_at in data_requests if missing; overdue/due-soon in UI; operational strip with backlog + overdue counts. |
| 3–4 | Destructive hardening | Mandatory reason for delete, anonymize, bulk reject (audit details); rate limit or cap on bulk delete/reject; anomaly alert for bulk reject above N. |
| 4–6 | Access and visibility | IP (and optional session) on audit or access_log; “Last login” or session hint in admin UI; escalation event log or link to incident store. |
| 6–8 | Human error | Bulk action preview (e.g. first 5 + count); ConfirmModal and audit for all destructive (sprint); optional “type DELETE” for delete user. |

---

### 120-day enterprise hardening plan

| Phase | Focus | Deliverables |
|-------|--------|---------------|
| **RBAC** | Roles and permissions | Role model (e.g. viewer, moderator, supervisor, full admin); permission matrix; enforce in API; list “who has what” in Settings. Optional: restrict delete/anonymize to supervisor role. |
| **Approval workflow** | High-risk actions | Optional 4-eyes for bulk delete/reject above N or for anonymize; “pending approval” state and audit. |
| **Scalability** | 20+ operators | Assignment or routing (e.g. “claim” report or application); conflict detection or lock (e.g. “user X is viewing”); idempotency keys for bulk and critical PATCH. |
| **Incident UI** | One-screen state | Risk/ops page: backlog counts, overdue, open escalations (or link), last escalation time. |
| **Audit tamper-evidence** | Integrity | Hash chain or periodic signed export of audit log; or append-only export to cold storage with integrity check. |
| **Enterprise UX** | Filter, sort, session | Multi-column sort; saved filters; search by ID; session list or “active admins”; MFA/last-login visibility. |

---

## Summary

The admin panel has a **documented governance layer** (metrics, escalation protocol, architecture) and **audit logging** that is append-only and queryable at the DB level. It **does not** meet enterprise and SOC2/ISO/GDPR expectations for: **evidence production** (filter/export audit), **prevention and escalation** (rate limits, approval, mandatory reason), **RBAC**, **scalability** (assignment, conflict, SLA sort), **incident visibility** (live risk and escalation in UI), or **access logging** (IP/session). Immediate blockers must be addressed before enterprise sales; 60-day and 120-day plans above are the minimum to reach “enterprise-ready” and “20+ operator scale.”
