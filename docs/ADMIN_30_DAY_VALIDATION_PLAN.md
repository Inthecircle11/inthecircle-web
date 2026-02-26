# Admin Control System — 30-Day Validation Plan

**Purpose:** Operational validation that metrics are accurate, escalation fires, audit is complete, no silent failures, and admin team follows protocol  
**Owner:** Operations lead  
**Date:** February 2026.

---

## Week 1: Instrumentation validation

| Item | Detail |
|------|--------|
| **Objective** | Confirm every metric in ADMIN_PERFORMANCE_METRICS_SPEC can be computed from live data and matches the documented formula. |
| **Exact tests** | 1. **Pending Applications Backlog:** Run SQL/count on `applications` where status IN (PENDING, PENDING_REVIEW, SUBMITTED, DRAFT). Record count and timestamp. Compare to value shown in Admin Overview (or dashboard) if present; they must match. 2. **Pending Reports Backlog:** Count `user_reports` where status = 'pending'. Compare to admin UI or metrics output. 3. **Data Requests Overdue:** Count `data_requests` where status = 'pending' AND (due_at &lt; now() OR created_at &lt; now() - 30 days). Record count. 4. **Mean Time to Resolve Report:** For last 30 days, compute (reviewed_at - created_at) in hours for each report with reviewed_at set; take mean. Record value and sample size. 5. **Mean Time to Approve Application:** For applications that moved to approved/active in last 30 days, get approval_time from admin_audit_log (earliest created_at where target_type = 'application', target_id = app id, action ILIKE '%approv%') or applications.updated_at; compute (approval_time - submitted_at) in hours; take mean. Record value. 6. **Destructive Actions in 1h per admin:** Query admin_audit_log for last 7 days; for each admin_user_id, count rows where action ILIKE '%delete%' OR action ILIKE '%anonymize%' in sliding 1h windows. Record max count per admin in any 1h. 7. **Actions per Admin per Day:** Count audit log rows per admin_user_id per calendar day for last 7 days. Record. 8. **Failed Admin Actions Rate (if instrumented):** From server logs or middleware, count 4xx/5xx for /api/admin/* and total admin requests over last 7 days; compute rate. Record. |
| **Success looks like** | Every metric produces a numeric result (or “N/A” if data source missing); manual count matches dashboard/UI where both exist; no formula error or missing table/column. |
| **Failure indicates** | Wrong formula, missing data source, or dashboard/aggregation not wired to same logic. Fix before Week 2. |
| **Required documentation** | Validation log: metric name, source query or method, result, timestamp, “Match UI: yes/no” (if applicable). Store in runbook or shared doc. Sign-off: Operations lead. |

---

## Week 2: Escalation dry runs (simulate Yellow/Red)

| Item | Detail |
|------|--------|
| **Objective** | Verify that when a metric crosses Yellow or Red, the escalation path runs: event created, owner notified, documentation logged. |
| **Exact tests** | 1. **Yellow simulation — Pending Reports:** If current pending reports &lt; 5, temporarily add test reports (or use a staging/test table) so count reaches 5–15. Trigger metrics run (or load dashboard that evaluates thresholds). Confirm: escalation_yellow event is created (in admin_audit_log or incident log) with metric = Pending Reports Backlog, value, threshold; Operations lead (or designated owner) receives notification per protocol. Document in one-line log: metric, value, threshold, time, owner. Then remove or revert test data. 2. **Red simulation — Data Requests Overdue:** If no overdue requests exist, create one test row in data_requests (status = 'pending', created_at = 35 days ago, or due_at = yesterday). Trigger metrics run. Confirm: escalation_red event created; L2 response: incident record opened, owner assigned, “each overdue request gets owner and resolution time within 4 hours” simulated (document plan for test request). Revert test row after test. 3. **Red simulation — Destructive anomaly (staging/sandbox only):** In a non-production environment, generate 5 audit log entries for same admin_user_id with action containing 'delete' or 'anonymize' within 1 hour. Run anomaly check. Confirm: event or alert fires; L2 response (review of that admin’s actions) is documented. Do not run destructive actions in production for this test. 4. **Yellow → Red persistence:** If safe, leave one metric in Yellow for 24 hours and confirm no duplicate alert for same transition per protocol (at most one alert per metric per Yellow/Red transition in 24h). |
| **Success looks like** | Each simulated breach produces an escalation event; notification reaches the right role; one-line log (Yellow) or incident record (Red) is created with required fields; no duplicate alerts for same transition within 24h. |
| **Failure indicates** | Escalation engine not running, thresholds misconfigured, notification channel broken, or documentation step skipped. Fix and re-run affected scenario. |
| **Required documentation** | Dry-run log: scenario name, metric, simulated value, trigger time, event created (yes/no), notification sent (yes/no), doc created (yes/no), sign-off. Store with incident log or runbook. |

---

## Week 3: Audit and logging integrity checks

| Item | Detail |
|------|--------|
| **Objective** | Confirm every destructive and confirmation action writes to admin_audit_log; entries are complete and retention is known. |
| **Exact tests** | 1. **Destructive action coverage:** List all admin UI flows that perform delete user, anonymize user, bulk reject applications. For each, perform the action once in staging (or use recent production audit if no staging): confirm at least one row in admin_audit_log with action containing the operation, admin_user_id, target_type/target_id or equivalent, created_at. 2. **Confirmation logging:** Confirm that after ConfirmModal confirm (bulk reject, delete user, anonymize), the subsequent API success results in an audit entry that includes “confirmed” or equivalent (per ADMIN_SPRINT_01_EXECUTION_PLAN). 3. **Required fields:** Sample 20 audit rows. Check presence of: admin_user_id (or admin_email), action, created_at; for destructive, target_type and target_id (or equivalent). Record any missing required fields. 4. **Retention and export:** Document current retention for admin_audit_log (e.g. 1 year). If export exists (e.g. CSV/API), run export for last 30 days; confirm row count matches query count. 5. **Escalation events:** If escalation events are stored in admin_audit_log (e.g. action = 'escalation_yellow'), query for last 30 days; confirm they exist for any real or test breach in Week 2. |
| **Success looks like** | Every destructive and confirmation flow produces an audit row; sampled rows have required fields; retention is documented; export (if any) matches query; escalation events are present when breaches occurred. |
| **Failure indicates** | Missing audit call in a flow, missing fields, or retention/export not implemented. Fix gaps before Week 4. |
| **Required documentation** | Audit validation log: flow name, audit present (yes/no), required fields check (pass/fail), retention statement, export check (if applicable). Sign-off: Operations lead. |

---

## Week 4: Stress test (report spike / destructive anomaly simulation)

| Item | Detail |
|------|--------|
| **Objective** | Verify system behavior under simulated load: report spike and destructive anomaly. Confirm no silent failures and protocol is followed. |
| **Exact tests** | 1. **Report spike simulation:** In staging (or controlled production if no staging), create enough test reports so Pending Reports Backlog enters Yellow (5–15) or Red (&gt;15). Run metrics; confirm escalation fires and notification is received. Assign owner and document “backlog reduction plan” (for Yellow) or “triage and daily check” (for Red) per protocol. Confirm admin UI still loads Reports tab and filter works. Revert test data after test. 2. **Destructive anomaly simulation (staging only):** Generate 5+ destructive audit entries for one admin in 1 hour (or use script). Run anomaly check. Confirm Red/L2 alert; document “immediate review of that admin’s actions.” Confirm no production destructive actions are run for this test. 3. **Silent failure check:** During Week 1–3, note any admin API call that returned 4xx/5xx. For each, confirm error was surfaced to the user (toast or banner). If any 4xx/5xx had no user-visible feedback, log as silent failure and fix. 4. **Protocol adherence:** For at least one real Yellow or Red event during the 30 days (or from Week 2 dry run), verify: owner acknowledged within required time (4h Yellow, 1h Red); documentation (one-line or incident record) was created; next steps were assigned. If no real event, use Week 2 dry-run documentation and confirm it meets protocol. |
| **Success looks like** | Spike and anomaly trigger correct escalation; admin UI remains usable; no 4xx/5xx without user feedback; at least one full protocol cycle (acknowledge, document, assign) is evidenced. |
| **Failure indicates** | Escalation or UI fails under load; silent API failures; or protocol not followed (no acknowledge, no doc). Fix and re-validate. |
| **Required documentation** | Stress test log: scenario, metric values, escalation fired (yes/no), UI usable (yes/no), silent failures found (list or none), protocol adherence (yes/no with evidence). Sign-off: Operations lead. |

---

## Post–30-day

| Item | Action |
|------|--------|
| **Validation summary** | One-page summary: all Week 1 metrics validated (or list gaps); Week 2 dry runs passed (or list failures); Week 3 audit complete (or list gaps); Week 4 stress test passed (or list failures). |
| **Gaps and remediation** | Any failure or gap gets a remediation line: what to fix, owner, target date. Re-run failed tests after fix. |
| **Ongoing** | Repeat escalation dry run at least quarterly (one Yellow, one Red scenario). Re-check audit coverage when new destructive flows are added. |
