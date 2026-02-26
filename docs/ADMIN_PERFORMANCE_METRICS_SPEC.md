# Admin Performance Metrics — Instrumentation Spec

**Document type:** Instrumentation specification  
**Scope:** Admin control system — performance, throughput, risk, trust  
**Date:** February 2026.

---

## 1. Objective

Admin performance must be measured so the business can detect operational bottlenecks, legal exposure (e.g. data request latency), safety risk (report volume, repeat offenders), and control-surface trust (stale data, failed actions). Without defined KPIs and thresholds, backlog growth, abuse patterns, and tool reliability go unobserved until they impact revenue or compliance.

---

## 2. Core Admin KPIs (max 5)

| Name | Definition | Why it matters | Data source | Owner |
|------|------------|----------------|-------------|--------|
| **Pending Applications Backlog** | Count of rows in `applications` where `status` IN ('PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'DRAFT'). | Revenue / throughput: delayed approval delays onboarding. | Table: `applications`. Column: `status`. Filter: status normalized to PENDING/PENDING_REVIEW/SUBMITTED/DRAFT. | Operations |
| **Pending Reports Backlog** | Count of rows in `user_reports` where `status = 'pending'`. | Risk: unresolved reports imply unaddressed safety or abuse. | Table: `user_reports`. Column: `status`. | Operations |
| **Data Requests Overdue** | Count of rows in `data_requests` where `status = 'pending'` AND (`due_at` &lt; now() OR, if no `due_at`, `created_at` &lt; now() - 30 days). If `due_at` does not exist, use: pending and `created_at` &lt; now() - 30 days. | Legal: GDPR/CCPA deadlines; missed deadlines create regulatory risk. | Table: `data_requests`. Columns: `status`, `due_at` (if present), `created_at`. | Legal / Operations |
| **Mean Time to Resolve Report (hours)** | For each report in `user_reports` where `reviewed_at` IS NOT NULL: (reviewed_at - created_at) in hours. KPI = arithmetic mean of those values over the last 30 days. | Risk / trust: slow resolution increases user and legal risk. | Table: `user_reports`. Columns: `created_at`, `reviewed_at`. Filter: reviewed_at IS NOT NULL, created_at &gt;= now() - 30 days. | Operations |
| **Mean Time to Approve Application (hours)** | For each application that moved to approved/active: (approval_time - submitted_at) in hours. Approval_time = earliest `created_at` from `admin_audit_log` where `target_type` = 'application' AND `target_id` = application.id AND `action` ILIKE '%approv%'. KPI = arithmetic mean over the last 30 days. If audit does not record approval, use applications.updated_at where status = ACTIVE/APPROVED if available. | Revenue / throughput: time-to-approve correlates with conversion and capacity. | Tables: `applications` (id, submitted_at, status, updated_at), `admin_audit_log` (target_type, target_id, action, created_at). | Operations |

---

## 3. Throughput Metrics

| Metric | Definition | Data source |
|--------|------------|-------------|
| **Mean Time to Resolve (Reports)** | Same as Core KPI "Mean Time to Resolve Report (hours)". For each report with reviewed_at set, resolve_duration_hours = (reviewed_at - created_at) / 3600 (in seconds). Mean over last 30 days. | `user_reports`: created_at, reviewed_at. |
| **Mean Time to Approve (Applications)** | Same as Core KPI "Mean Time to Approve Application (hours)". approval_time from audit or applications.updated_at; duration_hours = (approval_time - submitted_at) / 3600. Mean over last 30 days. | `applications`, `admin_audit_log`. |
| **Backlog Size — Pending Reports** | Count of `user_reports` where status = 'pending'. | `user_reports`. |
| **Backlog Size — Pending Applications** | Count of `applications` where status IN (PENDING, PENDING_REVIEW, SUBMITTED, DRAFT). | `applications`. |
| **Actions per Admin per Day** | Count of rows in `admin_audit_log` per distinct admin_user_id per calendar day. Sum over last 7 days, then divide by 7 for daily average; or report daily counts. | `admin_audit_log`: admin_user_id, created_at (date truncate). |
| **Bulk Action Frequency** | Count of audit log entries where action ILIKE '%bulk%' or details contains bulk count, per day or per week. | `admin_audit_log`: action, details, created_at. |

---

## 4. Risk Metrics

| Metric | Definition | Data source |
|--------|------------|-------------|
| **Destructive Actions Count** | Count of rows in `admin_audit_log` where action ILIKE '%delete%' OR action ILIKE '%anonymize%' (or normalized action values for user delete / user anonymize). Report per day or per week. | `admin_audit_log`: action, created_at. |
| **Reversal or Dispute Events** | Count of events where a user is restored, or a dispute is logged. If no table exists: 0; document requirement for dispute/reversal table or audit action type. | Optional table or `admin_audit_log` action type (e.g. 'user_restored', 'dispute_logged'). |
| **Reports per 1,000 Active Users** | (Count of `user_reports` created in last 30 days) / (count of distinct users active in last 30 days, e.g. from auth.sessions or profiles with last_seen) * 1000. Active = defined by existing product metric (e.g. session in last 30d). | `user_reports`: created_at. Active user count: auth.sessions or app-defined active metric. |
| **Repeat Offender Rate** | Count of distinct reported_user_id in `user_reports` where that user appears in &gt;= 2 reports (any status), divided by count of distinct reported_user_id. Report as fraction or %. | `user_reports`: reported_user_id. |
| **Audit Log Anomaly — Excessive Destructive Actions** | Count of destructive actions (delete/anonymize) in a sliding 1-hour window per admin_user_id. Flag when count &gt;= 5 in 1 hour for same admin. | `admin_audit_log`: admin_user_id, action, created_at. |

---

## 5. Trust Metrics

| Metric | Definition | Data source |
|--------|------------|-------------|
| **Refresh Frequency** | Count of times "Refresh all data" or header Refresh is triggered per admin session or per day. Requires client-side event: emit event when loadData() or refresh is called; store in analytics or audit (e.g. action = 'admin_refresh'). | Client: call audit POST or analytics event on Refresh/loadData() trigger. |
| **Stale-Data Exposure Duration** | For each admin session, sum of time (in minutes) during which lastRefreshed was older than 5 minutes while the admin had the panel open. Requires client to record lastRefreshed and session view time; or approximate: (time since last refresh when next refresh happens) when that time &gt; 5 min. | Client: log when user refreshes and previous lastRefreshed age; or session heartbeat with lastRefreshed. |
| **Failed Admin Actions Rate** | Count of admin API responses with HTTP status &gt;= 400 (or 5xx) for admin routes, divided by total admin API requests to those routes, over last 7 days. Per route or aggregate. | Server: access logs or middleware counting 4xx/5xx for /api/admin/*. |
| **Error Toast Rate** | Count of toasts shown with type = 'error' in admin UI per session or per day. Requires client to emit when showToast(_, 'error') is called. | Client: analytics or audit action (e.g. 'admin_toast_error') with optional message hash. |

---

## 6. Thresholds & Alerts

| Metric | Green | Yellow | Red | Suggested alert trigger |
|--------|--------|--------|-----|-------------------------|
| **Pending Applications Backlog** | &lt; 20 | 20–50 | &gt; 50 | Alert when backlog &gt; 50 (or &gt; 50 for 24h). |
| **Pending Reports Backlog** | &lt; 5 | 5–15 | &gt; 15 | Alert when pending reports &gt; 15. |
| **Data Requests Overdue** | 0 | 0 | &gt; 0 | Alert on any overdue data request. |
| **Mean Time to Resolve Report (hours)** | &lt; 24 | 24–48 | &gt; 48 | Alert when 7d rolling mean &gt; 48h. |
| **Mean Time to Approve Application (hours)** | &lt; 24 | 24–72 | &gt; 72 | Alert when 7d rolling mean &gt; 72h. |
| **Destructive Actions (delete/anonymize) in 1h per admin** | 0–2 | 3–4 | &gt;= 5 | Alert when any admin has &gt;= 5 in 1 hour. |
| **Failed Admin Actions Rate** | &lt; 1% | 1–5% | &gt; 5% | Alert when 24h rate &gt; 5%. |
| **Reports per 1,000 Active Users** | &lt; 2 | 2–5 | &gt; 5 | Alert when 30d ratio &gt; 5 (or product-defined). |

---

## 7. Dashboard Recommendation

**Admin Overview (informational)**  
- Keep: Platform KPIs (total users, active today, conversations, verified, new 24h/7d, applications 7d, pending review). Data as of timestamp. Concurrent active users.  
- Add: **Operational strip** — Pending applications (count), Pending reports (count), Data requests overdue (count). Each with link to the relevant tab.  
- Add: Last updated timestamp and stale indicator when data &gt; 5 min old.

**Operational (action-driving)**  
- **Overview operational strip:** Pending applications, pending reports, overdue data requests — must be visible without switching tabs and must link to queues.  
- **Dashboard:** Quick Actions keep "Refresh all data" and "Last updated"; remove any fake action. Optional: same backlog counts and oldest-item age (e.g. "Oldest pending application: 2d") on Dashboard.  
- **Per-tab:** Applications, Reports, Data Requests remain the primary surfaces for actions. Backlog and throughput metrics can be computed from the same data sources above and surfaced in Overview or a single "Operations" block rather than duplicating full dashboards.

**Informational only (no direct action)**  
- 12-week signup chart, top niches/countries/cities, engagement stats, recent activity. These support context but do not replace queue-based work.

**Summary:** Overview = high-level KPIs + operational strip (backlog + overdue). Dashboard = same operational strip optional + Refresh + last updated. All queue actions stay in Applications, Reports, Data Requests, Users, Verifications, Inbox.
