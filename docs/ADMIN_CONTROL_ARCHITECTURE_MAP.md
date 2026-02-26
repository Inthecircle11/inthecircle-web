# Admin Control System — Architecture Map

**Document type:** Systems-level architecture map  
**Scope:** Admin control system — layers, data flow, risk surfaces, ownership, failure modes  
**References:** docs/ADMIN_SPRINT_01_EXECUTION_PLAN.md, docs/ADMIN_PERFORMANCE_METRICS_SPEC.md, docs/ADMIN_RISK_ESCALATION_PROTOCOL.md  
**Date:** February 2026.

---

## 1. System overview

The admin control system consists of: (1) **Admin UI** (Next.js client, gate, login, tabs, ConfirmModal, toasts, Refresh, last-updated), which sends requests to (2) **API Layer** (`/api/admin/*`), which enforces auth via `requireAdmin`, reads and writes (3) **Data Layer** (Supabase: `applications`, `user_reports`, `data_requests`, `admin_audit_log`, `profiles`, auth and other tables). Every state-changing admin action that reaches the API results in a **database write** and, where specified (e.g. destructive actions, confirmations), an **audit log entry** in `admin_audit_log`. **Metrics aggregation** (scheduled or on-demand) reads from the Data Layer and optionally from server access logs to compute the KPIs and thresholds defined in ADMIN_PERFORMANCE_METRICS_SPEC.md. The **escalation engine** (job or dashboard evaluator) compares those metrics to Yellow/Red thresholds and, on breach, creates escalation events and notifies roles per ADMIN_RISK_ESCALATION_PROTOCOL.md. The Admin UI does not write directly to the database; all writes go through the API. Audit log and metrics feed incident handling and retention per the protocol.

---

## 2. Control flow layers

### Layer 1 — Admin UI

| Component | Responsibility |
|-----------|----------------|
| **Gate** | Optional password check via `/api/admin/gate`; "Back to app" link (per ADMIN_SPRINT_01_EXECUTION_PLAN task 5). |
| **Login** | Inline sign-in; Supabase auth + `/api/admin/check`; no direct DB write. |
| **Actions** | Approve/Reject/Waitlist (applications), Resolve/Dismiss (reports), Update status (data requests), Verify/Ban/Export/Anonymize/Delete (users). All trigger API calls. |
| **Confirmations** | ConfirmModal for bulk reject, delete user, anonymize (tasks 6–9); on confirm, API call then audit POST. |
| **Toasts** | Success/error feedback for every state-changing action (tasks 10–12); no persistence. |
| **Refresh** | Header Refresh and "Refresh all data" (Dashboard) call `loadData()`; on success, `setLastRefreshed(new Date())` and toast "Data refreshed" (tasks 2–3). |
| **Last updated / Stale** | Display "Last updated: X ago"; when age > 5 min, show stale indicator (tasks 3–4). |

### Layer 2 — API layer (`/api/admin/*`)

| Endpoint group | Purpose | Writes |
|----------------|---------|--------|
| **Gate** | GET/POST gate state (cookie). | None (or session/cookie). |
| **Check** | GET admin allowlist check. | None. |
| **Applications** | GET list (paginated). | None. |
| **Bulk-applications** | POST bulk approve/reject/waitlist. | `applications` (status); caller or API posts audit. |
| **Reports** | GET list; PATCH resolve/dismiss. | `user_reports` (status, reviewed_at, reviewed_by, notes). |
| **Data-requests** | GET list; PATCH status. | `data_requests` (status). |
| **Audit** | GET list; POST append. | `admin_audit_log` (admin_user_id, admin_email, action, target_type, target_id, details). |
| **Users / Anonymize / Export / Blocked / etc.** | User actions. | Various (profiles, auth, etc.); destructive actions must post audit. |

All admin routes must use `requireAdmin` (or equivalent); failed auth returns 401/403. 4xx/5xx responses are the source for Failed Admin Actions Rate (ADMIN_PERFORMANCE_METRICS_SPEC).

### Layer 3 — Data layer

| Store | Purpose |
|-------|---------|
| **applications** | Application records; status (PENDING, ACTIVE, REJECTED, etc.), submitted_at. Source for Pending Applications Backlog and Mean Time to Approve. |
| **user_reports** | Reports; status (pending, resolved, dismissed), created_at, reviewed_at, reviewed_by, reporter_id, reported_user_id. Source for Pending Reports Backlog, Mean Time to Resolve, Reports per 1,000 Users, Repeat Offender Rate. |
| **data_requests** | Export/deletion requests; status (pending, completed, failed), created_at, due_at (if present). Source for Data Requests Overdue. |
| **admin_audit_log** | Every logged action: admin_user_id, admin_email, action, target_type, target_id, details, created_at. Source for Destructive Actions Count, Audit Log Anomaly, Actions per Admin per Day, Bulk Action Frequency, and confirmation audit trail (ADMIN_SPRINT_01_EXECUTION_PLAN). |
| **profiles, auth.users, etc.** | User and profile data; written by user-facing and admin APIs. |

### Layer 4 — Metrics aggregation

| Input | Output |
|-------|--------|
| **applications** (status, submitted_at) + **admin_audit_log** (target_type, target_id, action, created_at) | Pending Applications Backlog; Mean Time to Approve Application. |
| **user_reports** (status, created_at, reviewed_at) | Pending Reports Backlog; Mean Time to Resolve Report. |
| **data_requests** (status, due_at, created_at) | Data Requests Overdue. |
| **admin_audit_log** (admin_user_id, action, created_at) | Destructive Actions Count; Audit Log Anomaly (1h window per admin); Actions per Admin per Day; Bulk Action Frequency. |
| **user_reports** + active user count (e.g. auth.sessions or product metric) | Reports per 1,000 Active Users. |
| **Server access logs** (4xx/5xx for /api/admin/*) | Failed Admin Actions Rate. |

Aggregation can be a scheduled job (e.g. hourly), a dashboard query, or a dedicated metrics service. Outputs must be comparable to the thresholds in ADMIN_PERFORMANCE_METRICS_SPEC Section 6.

### Layer 5 — Escalation engine

| Input | Behavior |
|-------|----------|
| **Metric values** from Layer 4 | Compare to Green/Yellow/Red thresholds (ADMIN_PERFORMANCE_METRICS_SPEC). |
| **On Yellow** | Create escalation event (e.g. escalation_yellow); log (runbook or admin_audit_log); notify Operations lead per ADMIN_RISK_ESCALATION_PROTOCOL Level 1. |
| **On Red** | Create escalation event (escalation_red); open incident record; notify per Level 2; assign owner and response times. |
| **On Level 3 conditions** | Escalate to incident commander; Legal/Product as per protocol. |

Engine can be a cron job, a dashboard widget that triggers alerts, or an external monitoring system. Must not alert more than once per metric per Yellow/Red transition in 24h unless Red→Green→Red (protocol guardrails).

---

## 3. Data flow (per action type)

### Approve / Reject / Waitlist application (single or bulk)

1. **Admin action:** User selects application(s) and clicks Approve, Reject, or Waitlist. If destructive (bulk reject), ConfirmModal opens; on confirm, request is sent.
2. **API call:** POST to bulk-applications or equivalent with action and ids. requireAdmin validates session.
3. **Database write:** `applications` rows updated (status).
4. **Audit log entry:** POST /api/admin/audit with action (e.g. "Bulk reject confirmed, N applications" or per-action "application_approved"), target_type application, target_id(s), admin id. Written by client after success or by API.
5. **Metrics update:** Next metrics run reads updated applications and new audit rows; Pending Applications Backlog and Mean Time to Approve (if approval) recomputed.
6. **Escalation evaluation:** If Pending Applications Backlog or Mean Time to Approve crosses Yellow/Red, escalation engine triggers per protocol.

### Resolve / Dismiss report

1. **Admin action:** User clicks Resolve or Dismiss on report card.
2. **API call:** PATCH /api/admin/reports with report_id and status (resolved|dismissed).
3. **Database write:** `user_reports` row updated (status, reviewed_at, reviewed_by, notes).
4. **Audit log entry:** Optional; protocol does not require it for resolve/dismiss. If implemented, POST audit with action "report_resolved" or "report_dismissed", target_id report id.
5. **Metrics update:** Pending Reports Backlog decreases; Mean Time to Resolve updated on next aggregation.
6. **Escalation evaluation:** If Pending Reports Backlog or Mean Time to Resolve crosses threshold, escalation engine triggers.

### Update data request status

1. **Admin action:** User selects status and clicks Update.
2. **API call:** PATCH /api/admin/data-requests with request_id and status.
3. **Database write:** `data_requests` row updated (status).
4. **Audit log entry:** Optional. If implemented, POST audit with action "data_request_updated", target_id request id.
5. **Metrics update:** Data Requests Overdue recomputed (pending and due_at/created_at).
6. **Escalation evaluation:** If Data Requests Overdue > 0, Red; escalation per protocol (Level 2; Level 3 if > 48h).

### Delete user / Anonymize user

1. **Admin action:** User opens ConfirmModal; on confirm, request is sent.
2. **API call:** POST to delete-user or anonymize endpoint. requireAdmin validates.
3. **Database write:** User and related data updated or removed (implementation-specific).
4. **Audit log entry:** Required. POST /api/admin/audit with action "User delete confirmed" or "User anonymize confirmed", target_type user, target_id user id, admin id. Per ADMIN_SPRINT_01_EXECUTION_PLAN tasks 8–9.
5. **Metrics update:** Destructive Actions Count and Audit Log Anomaly (1h window per admin) recomputed from admin_audit_log.
6. **Escalation evaluation:** If destructive actions in 1h for one admin >= 3 (Yellow) or >= 5 (Red), escalation engine triggers; Level 2/3 per protocol.

### Refresh all data

1. **Admin action:** User clicks header Refresh or Dashboard "Refresh all data."
2. **API call:** None for refresh itself; loadData() triggers GETs to applications, active-sessions, reports, data-requests, etc.
3. **Database write:** None.
4. **Audit log entry:** Optional (Refresh Frequency metric): POST audit with action "admin_refresh" if instrumentation is implemented (ADMIN_PERFORMANCE_METRICS_SPEC Trust metrics).
5. **Metrics update:** N/A for backlog; Stale-Data Exposure Duration can use client-reported lastRefreshed age if implemented.
6. **Escalation evaluation:** None for refresh.

---

## 4. Risk surface map

| Risk type | Location | Description |
|-----------|----------|-------------|
| **Destructive actions** | Admin UI: User modal (Delete, Anonymize). API: delete-user, anonymize-user (or equivalent). Data: auth.users, profiles, and related tables. Audit: admin_audit_log. | All delete and anonymize flows must require ConfirmModal and write an audit entry. Anomaly: >= 5 destructive actions in 1h by one admin triggers Level 2/3. |
| **Legal risk** | Data layer: `data_requests` (status, due_at, created_at). API: PATCH data-requests. Admin UI: Data Requests tab. | Overdue data requests (pending and past due_at or created_at > 30d) are Red. Single overdue = Level 2; > 48h overdue = Level 3. Ownership: Legal/Operations per protocol. |
| **Stale data risk** | Admin UI: state populated by loadData(); lastRefreshed and stale indicator (tasks 3–4). API: GET endpoints return current DB state; no caching requirement specified. | Operators see data as of last successful loadData(). If lastRefreshed > 5 min, UI shows stale indicator. No server-side guarantee of "fresh" without refresh. |
| **Abuse signal** | Data layer: `user_reports` (reporter_id, reported_user_id, status, created_at). Metrics: Reports per 1,000 Active Users; Repeat Offender Rate. Escalation: Yellow/Red for report backlog and reports per 1k users. | High report volume or repeat reported_user_id signals safety/product risk. Escalation engine and protocol drive triage and response. |

---

## 5. Ownership boundaries

| Responsibility | Owner | Reference |
|----------------|-------|-----------|
| **Metrics accuracy** | Operations (definition and interpretation); Engineering (implementation of aggregation and data sources). | ADMIN_PERFORMANCE_METRICS_SPEC: data sources and formulas. |
| **Escalation thresholds** | Operations (with Product/Legal for legal and safety metrics). Changes to Green/Yellow/Red require update to ADMIN_PERFORMANCE_METRICS_SPEC and protocol. | ADMIN_PERFORMANCE_METRICS_SPEC Section 6; ADMIN_RISK_ESCALATION_PROTOCOL Section 3. |
| **Incident command** | Level 1: Operations lead. Level 2: Operations lead + Legal for data requests/safety. Level 3: Incident commander (Operations + Legal + Product/Founder); backup designated per protocol. | ADMIN_RISK_ESCALATION_PROTOCOL Section 2. |
| **Audit log retention** | Legal/Compliance and Operations. Minimum 1 year for audit log; 2 years for incident records and post-mortems; 90 days for escalation event log unless stored in audit log. | ADMIN_RISK_ESCALATION_PROTOCOL Section 5. |
| **Admin UI integrity** | Engineering (FE). No fake actions; ConfirmModal for destructive actions; toasts for all state-changing actions; last-updated and stale indicator. Verified by ADMIN_SPRINT_01_EXECUTION_PLAN acceptance criteria. | ADMIN_SPRINT_01_EXECUTION_PLAN Section 4. |

---

## 6. Failure modes and fallbacks

| Failure | Consequence | Required fallback |
|---------|-------------|-------------------|
| **Audit log write fails** | Action may succeed in DB but not be recorded. Destructive actions and confirmations lack audit trail; anomaly detection and escalation may miss events. | API: on audit POST failure, log to server-side log (or dead-letter) and return or surface error so client can retry or show "Audit log failed; action may have completed." Optionally block destructive action until audit succeeds (trade-off: availability vs audit guarantee). |
| **Audit log unavailable (DB down)** | New audit entries cannot be written. Metrics that depend on admin_audit_log (destructive count, anomaly, actions per admin) will be stale. | Run metrics aggregation only on available data; mark metrics as "partial" if audit log is missing. Escalation engine continues to evaluate other metrics (backlogs, data requests, failed action rate from server logs). |
| **Metrics job fails** | KPIs and thresholds are not recomputed; no new Yellow/Red events. Risk of silent breach. | Escalation engine or scheduler must detect job failure (e.g. no successful run in N hours) and trigger Level 1: "Metrics aggregation did not run; manual check required." Fallback: manual daily run or dashboard that computes metrics on load until job is restored. |
| **Escalation job / notification fails** | Metric breaches occur but no one is notified. Silent risk. | Red thresholds must trigger at least one notification path (e.g. Slack, email, runbook). If notification fails, log the failure and retry; after N failures, escalate notification failure itself (e.g. to Engineering). Per protocol: "Every Red threshold must trigger an automated event or check." |
| **Admin UI shows stale data** | Operators act on outdated backlogs or user state. Risk of duplicate actions or wrong decisions. | UI: stale indicator when lastRefreshed > 5 min (task 4). No automatic refresh required; operator must click Refresh. If loadData() fails repeatedly, error toast and banner; lastRefreshed not updated so stale indicator remains. |
| **Single admin active (no backup)** | Protocol guardrail: if only one admin_user_id has actions in 7 days, Level 1 — Operations assign backup and document handover. | Metrics: "Actions per Admin per Day" or distinct admin count; if count < 2 over 7 days, create escalation_yellow and notify Operations. |
