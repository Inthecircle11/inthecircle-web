# Admin Risk Escalation Protocol

**Document type:** Governance protocol  
**Scope:** Response to admin performance and risk metric threshold breaches  
**References:** docs/ADMIN_PERFORMANCE_METRICS_SPEC.md (thresholds and definitions)  
**Date:** February 2026.

---

## 1. Purpose

This protocol defines who is responsible, what must be done, and what must be documented when admin KPIs or risk metrics breach the Yellow or Red thresholds in ADMIN_PERFORMANCE_METRICS_SPEC.md. It ensures every breach triggers a defined response, avoids silent risk and alert fatigue, and preserves an audit trail for compliance and post-incident review.

---

## 2. Escalation Levels

### Level 1 — Operational Warning

| Item | Definition |
|------|------------|
| **Trigger conditions** | Any single metric in **Yellow** range: Pending Applications Backlog 20–50; Pending Reports Backlog 5–15; Mean Time to Resolve Report (7d rolling mean) 24–48h; Mean Time to Approve Application (7d rolling mean) 24–72h; Destructive actions in 1h per admin 3–4; Failed Admin Actions Rate 1–5%; Reports per 1,000 Active Users (30d) 2–5. |
| **Responsible role** | Operations lead or designated admin lead. |
| **Required response time** | Acknowledge within 4 business hours; assign owner and next check within 8 business hours. |
| **Required documentation** | One-line log entry: metric name, current value, threshold (Yellow), date/time, owner. Stored in shared runbook, incident log, or admin_audit_log (action = 'escalation_yellow', details = { metric, value, threshold }). |
| **Communication scope** | Internal: Operations lead and assigned owner. No external or customer communication unless metric is customer-facing (e.g. Data Requests Overdue). |

### Level 2 — Risk Escalation

| Item | Definition |
|------|------------|
| **Trigger conditions** | Any single metric in **Red** range: Pending Reports Backlog > 15; Data Requests Overdue > 0; Mean Time to Resolve Report (7d rolling mean) > 48h; Mean Time to Approve Application (7d rolling mean) > 72h; Destructive actions in 1h per admin >= 5; Failed Admin Actions Rate > 5%; Reports per 1,000 Active Users (30d) > 5. Or: same metric in Yellow for 24 consecutive hours with no improvement. |
| **Responsible role** | Operations lead + Legal/Compliance owner for Data Requests Overdue; Operations lead for all others. Escalation to Product/Founder if unresolved within response time. |
| **Required response time** | Acknowledge within 1 hour; containment or mitigation plan within 4 hours; resolution or clear next steps within 24 hours. |
| **Required documentation** | Incident record: metric(s), trigger time, current value, owner, actions taken, status (open/contained/resolved). Stored in incident log or designated doc. If Data Requests Overdue: document each overdue request id, due date, and resolution plan. |
| **Communication scope** | Internal: Operations, Legal (if data requests or safety), Product. External: Only if legal or safety requires (e.g. notifying affected user of data request delay). |

### Level 3 — Critical Incident

| Item | Definition |
|------|------------|
| **Trigger conditions** | Data Requests Overdue > 0 for more than 48 hours; Destructive Action Anomaly (>= 5 delete/anonymize in 1h by one admin) with suspicion of misuse or compromise; Failed Admin Actions Rate > 10% for 2 consecutive hours; or two or more Red metrics simultaneously. |
| **Responsible role** | Operations lead + Legal (for data request or regulatory impact) + Product/Founder. Single incident commander for duration. |
| **Required response time** | Acknowledge within 30 minutes; containment within 2 hours; resolution or formal handoff within 48 hours. |
| **Required documentation** | Full incident record: timeline, metrics, decisions, actions, owners. Post-mortem required (see Section 4). Stored in incident log and retained per Audit & Logging Requirements. |
| **Communication scope** | Internal: All above plus leadership. External: As required by legal or regulatory (e.g. data subject notification, regulator). |

---

## 3. Metric-to-Response Mapping

| Metric | Yellow (trigger) | Red (trigger) | At Yellow | At Red |
|--------|------------------|---------------|-----------|--------|
| **Pending Reports Backlog** | Count >= 5 and <= 15 | Count > 15 | Level 1: Owner assigned; backlog reduction plan within 8 business hours. | Level 2: Immediate triage; at least one person assigned to clear reports; daily check until backlog < 5. |
| **Data Requests Overdue** | N/A (only 0 or > 0 in spec) | Count > 0 | N/A. | Level 2: Each overdue request gets an owner and target resolution time within 4 hours. If > 48h overdue: Level 3. |
| **Mean Time to Resolve (Reports)** | 7d rolling mean >= 24h and <= 48h | 7d rolling mean > 48h | Level 1: Review process; assign capacity to reports. | Level 2: Capacity or process change within 24h; track daily until mean < 24h. |
| **Destructive Action Anomaly** | 3–4 delete/anonymize in 1h by same admin | >= 5 in 1h by same admin | Level 1: Verify intent (e.g. bulk cleanup); log and monitor. | Level 2: Immediate review of that admin’s actions; if misuse suspected, Level 3 and access review. |
| **Failed Admin Actions Rate** | 24h rate >= 1% and <= 5% | 24h rate > 5% | Level 1: Engineering notified; check logs and deploy health. | Level 2: Engineering on call; fix or rollback within 24h. If > 10% for 2h: Level 3. |
| **Reports per 1,000 Users** | 30d ratio >= 2 and <= 5 | 30d ratio > 5 | Level 1: Review report reasons; consider product or policy. | Level 2: Safety and product review; external comms if safety risk. |

---

## 4. Incident Handling Workflow

| Phase | Actions |
|-------|--------|
| **Detection** | Metrics evaluated at defined interval (e.g. hourly or on dashboard load). When a metric crosses Yellow or Red, create an event (e.g. escalation_yellow / escalation_red) with metric name, value, threshold, timestamp. Notify responsible role per Section 2 (e.g. Slack channel, email, or runbook alert). |
| **Triage** | Owner confirms the breach (no false positive), assigns severity (L1/L2/L3), and opens an incident record. For Red: confirm owner and incident commander. For Data Requests Overdue: list each overdue request and assign an owner per request. |
| **Containment** | Actions that stop the breach from worsening: e.g. assign capacity to clear reports, complete overdue data requests, suspend or restrict admin account if Destructive Action Anomaly suggests misuse, rollback or fix if Failed Admin Actions Rate is due to a bad deploy. Document containment action and time. |
| **Resolution** | Metric returns to Green (or Yellow with a documented plan and date to reach Green). Update incident record with resolution time and summary. Close incident. |
| **Post-mortem (if required)** | Required for Level 3. Within 5 business days: document timeline, root cause, what went well, what failed, and action items (owner + due date). Store with incident record. Share with Operations and Product. |

---

## 5. Audit & Logging Requirements

| Requirement | Specification |
|-------------|---------------|
| **What must be logged** | (1) Every Yellow and Red threshold breach: metric name, value, threshold, timestamp, and escalation level. (2) Every Level 2 and Level 3 incident: open time, owner, containment and resolution actions, close time. (3) Destructive Action Anomaly: admin_user_id, action counts, 1h window, timestamp. (4) Data Requests Overdue: request id, due date, overdue duration, resolution date. |
| **Where stored** | Escalation events and incident summaries: either in `admin_audit_log` (with action type and details JSON) or in a dedicated incident/runbook store (e.g. doc, ticketing system). Destructive actions and data request state: already in `admin_audit_log` and `data_requests`; ensure overdue status and resolution are queryable. |
| **Retention policy** | Audit log: retain at least 1 year; longer if required by legal or compliance. Incident records and post-mortems: retain at least 2 years. Escalation event log: retain at least 90 days for alert tuning; align with audit log if stored there. |

---

## 6. Escalation Guardrails

| Guardrail | Rule |
|-----------|------|
| **Avoid alert fatigue** | (1) Do not alert more than once per metric per Yellow/Red transition in a 24h window unless the metric moves from Red to Green and back to Red. (2) Consolidate: if multiple metrics breach Yellow at the same time, one Level 1 incident with multiple metrics. (3) Review alert rules quarterly; suppress or adjust thresholds that fire repeatedly without actionable outcome. |
| **Avoid silent risk** | (1) Every Red threshold in ADMIN_PERFORMANCE_METRICS_SPEC.md must trigger an automated event or check that creates an escalation record and notifies the responsible role. (2) If metrics are not instrumented yet, document "Not implemented" and a target date; until then, manual daily check for that metric. (3) Data Requests Overdue: daily report of pending data requests with created_at and due_at until zero overdue. |
| **Avoid single-point dependency on one admin** | (1) At least two distinct admin_user_ids must have performed at least one action in the last 7 days (or define minimum team size). If only one admin is active for 7 days, Level 1: Operations lead assigns backup and documents handover. (2) Destructive Action Anomaly: if the same admin is the only one performing delete/anonymize, require second approval or review for bulk destructive actions (process or tooling). (3) Critical incidents must not depend on a single person; incident commander designates a backup. |
