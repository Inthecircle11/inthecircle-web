# Analytics & User Journey Tracking System

Production-grade analytics for **app users** and **admin users**. Separate from `admin_audit_log` (audit is for accountability; analytics is for product/usage metrics).

## Rules

- **Do not modify** `admin_audit_log`.
- **Do not mix** analytics events with audit log entries.
- Analytics uses **separate tables** (`analytics_*`).
- **No middleware** required; tracking is client + API only.
- **Scale:** Designed for 1M+ events/day (partitioning, indexes, aggregation).

**No further action required for basic analytics.** App and admin tracking start automatically. Daily aggregation runs on a schedule if `pg_cron` is enabled (see §1.1).

## 1. Database Design

### 1.1 Daily aggregation (hands-off)

- Migration `20260302000004_analytics_cron.sql` schedules a **pg_cron** job to run `analytics_aggregate_daily` and `analytics_aggregate_feature_usage` for the previous day at 00:05 UTC.
- If **pg_cron** is not enabled in your project, enable it in Supabase Dashboard → Database → Extensions, then run or re-run migrations. Once enabled, aggregation runs daily with no further action.

### Tables

| Table | Purpose |
|-------|--------|
| `analytics_events` | Raw events (partitioned by month). Columns: id, user_id, admin_user_id, session_id, event_name, feature_name, page_name, user_type, metadata, device_type, country, app_version, created_at. |
| `analytics_sessions` | Session boundaries: started_at, ended_at, last_activity_at, duration_seconds, event_count, page_views. |
| `analytics_daily_aggregates` | Pre-aggregated daily metrics (DAU, sessions, etc.). Filled by job. |
| `analytics_feature_usage` | Daily feature/event counts and unique users. Filled by job. |
| `analytics_funnels` | Funnel definitions (name, user_type, steps[]). |
| `analytics_funnel_events` | Per-session funnel step completion. |
| `analytics_retention_cohorts` | Cohort date + retention flags (d1, d7, d30, w1, w2, w4). |

### Partitioning

- `analytics_events` is **partitioned by RANGE (created_at)** by month.
- Migrations create partitions for a few months; **add new partitions** (e.g. monthly via cron or migration):

```sql
CREATE TABLE IF NOT EXISTS analytics_events_y2026m07 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

### Indexes

- `(user_id, created_at DESC)` — user timeline.
- `(admin_user_id, created_at DESC)` — admin timeline.
- `(session_id, created_at DESC)` — session replay.
- `(event_name, created_at DESC)` — event-based queries.
- `(user_type, created_at DESC)` — app vs admin.
- `(created_at DESC)` — time-bound scans.
- `(feature_name, created_at DESC)` — feature usage.

### RLS

- All analytics tables: **service_role only** (INSERT/SELECT via API with service role). No direct app user access.

---

## 2. Event Tracking Layer

### Client: `src/lib/analytics.ts`

- **trackEvent(eventName, { userType, featureName?, pageName?, metadata? })** — queues event; batches and sends to `/api/analytics/track`.
- **trackAppEvent(name, options?)** — shorthand for `user_type: 'app'`.
- **trackAdminEvent(name, options?)** — shorthand for `user_type: 'admin'`.
- **startSession(userType)** — call on app/admin load; sends session_start.
- **endSession(userType)** — call on leave (beforeunload); sends session_end and `_end_session`.
- **heartbeat(userType, tabOrPage?)** — extend session; optional tab for admin time-spent.
- Session id in `sessionStorage`; 30 min inactivity = new session.

### Server: `src/lib/analytics-server.ts`

- **logEventServer(supabase, payload, context)** — insert one event + upsert session (service role).
- **logEventBatchServer(supabase, events, context, { end_session? })** — batch insert + one session upsert.
- **endSessionServer(supabase, sessionId, userType, context)** — set session ended.

### API: `POST /api/analytics/track`

- **Body:** `{ events: [...], session_id?, device_type?, app_version?, end_session? }`.
- **Auth:** Optional (cookie); user_id/admin_user_id from session when present.
- **Rate limit:** 60 requests/min per IP (in-memory).
- **Limit:** 20 events per request.
- **Validation:** event_name, user_type required; lengths capped.
- **Non-blocking:** Synchronous insert (fast RPC); no background job required for basic flow.

---

## 3. App Event Taxonomy

Use from `src/lib/analytics-events.ts`:

- **Lifecycle:** app_open, session_start, session_end, login, logout.
- **Signup/onboarding:** signup_started, signup_completed, onboarding_started, onboarding_completed.
- **Engagement:** feature_viewed, feature_clicked, form_started, form_completed.
- **Conversion:** purchase_started, purchase_completed.
- **Activation:** first_core_action.
- **Retention:** return_visit.
- **Errors:** error_occurred.

**Activation events:** onboarding_completed, first_core_action.  
**Core actions:** feature_clicked, form_completed, purchase_completed, first_core_action.  
**Retention triggers:** feature_viewed, feature_clicked, form_completed, return_visit.

---

## 4. Admin Event Taxonomy

- admin_login, admin_logout, admin_tab_opened, admin_tab_time_spent, admin_action_performed.
- admin_application_reviewed, admin_report_resolved, admin_data_request_updated.
- admin_user_deleted, admin_user_anonymized, admin_bulk_action, admin_role_changed.
- admin_session_revoked, admin_export_triggered, admin_approval_requested, admin_approval_approved, admin_approval_rejected.
- admin_session_start, admin_session_end.

Admin panel wires: **admin_tab_opened** on tab change, **admin_session_start** on authorized, **admin_session_end** on beforeunload.

App (product) tracking is automatic: **AppShell** starts an app session when a logged-in user is on a non-admin route, sends **feature_viewed** on route change (page_name = pathname), and ends the session on beforeunload. No per-page code required.

---

## 5. Session System

- **Session id:** Generated client-side (sessionStorage), sent with every batch.
- **Start:** First event or explicit `startSession('app'|'admin')`.
- **End:** Explicit `endSession()` on beforeunload or after 30 min inactivity (client treats as new session on next activity).
- **Server:** `analytics_upsert_session` — INSERT new session or UPDATE last_activity_at, event_count, and optionally set ended_at + duration_seconds when end_session=true.
- **Inactivity:** 30 min (client-side constant); server does not expire sessions (optional cleanup job can close stale sessions).

---

## 6. Funnel System

- **Definitions** in `analytics_funnels`: funnel_name, user_type, steps (JSON array of event_name).
- **Seeded:** "App Activation" (signup_completed → onboarding_completed → first_core_action → return_within_7d), "Admin Review" (admin_login → admin_tab_opened → admin_action_performed → admin_application_reviewed).
- **Step counts:** Use RPC `analytics_get_funnel_steps(p_funnel_name, p_user_type, p_from, p_to)` for drop-off and conversion.

---

## 7. Retention & Cohorts

- **Table:** `analytics_retention_cohorts` — cohort_date, cohort_type (signup, first_action, weekly), retained_d1/d7/d30, retained_w1/w2/w4.
- **Aggregation:** Populate via scheduled job (e.g. daily) that:
  - Assigns users to cohorts by signup/first_action date.
  - Sets retained_* from presence in `analytics_events` in the relevant window.
- **Queries:** Cohort matrix and retention curve from this table + dates.

---

## 8. Admin Product Analytics Tab

- **Tab:** "Product Analytics" (permission `read_analytics`; viewer, compliance, super_admin).
- **API:** `GET /api/admin/analytics/overview?days=30` — returns overview (DAU, WAU, MAU, stickiness, avg session duration, sessions per user, inactive 7d, churn), feature usage, funnel steps, admin tab usage, admin productivity.
- **UI:** `src/app/admin/ProductAnalyticsTab.tsx` — cards + tables; no charts (add Chart.js or similar if needed).

---

## 9. Production SQL Query Examples

**DAU (today, app):**
```sql
SELECT count(DISTINCT user_id) FROM analytics_events
WHERE user_type = 'app' AND user_id IS NOT NULL
  AND created_at >= current_date AND created_at < current_date + interval '1 day';
```

**MAU (last 30 days, app):**
```sql
SELECT count(DISTINCT user_id) FROM analytics_events
WHERE user_type = 'app' AND user_id IS NOT NULL
  AND created_at >= current_date - interval '30 days';
```

**Stickiness (DAU/MAU):** Use RPC `analytics_get_stickiness(p_date)`.

**Most used feature (last 7d):**
```sql
SELECT feature_name, event_name, count(*) AS total
FROM analytics_events
WHERE user_type = 'app' AND created_at >= current_date - interval '7 days'
GROUP BY feature_name, event_name ORDER BY total DESC LIMIT 10;
```

**Drop-off after onboarding (funnel):** Use `analytics_get_funnel_steps('App Activation', 'app', from_date, to_date)` and compare step counts.

**Users inactive 7+ days:** Use RPC `analytics_get_inactive_users(7)`.

**Churn (period over period):** Use RPC `analytics_get_churn(p_period1_end, p_period2_end)`.

**Admin productivity ranking:** Use RPC `analytics_get_admin_productivity(p_days)`.

**Time per admin tab:** Use RPC `analytics_get_admin_tab_usage(p_days)`.

**Feature adoption %:** (unique users who did event / total users). Compute from `analytics_events` + profiles or auth.users count.

---

## 10. Performance & Scale

- **100K users, 1M events/day:** Partitioning by month keeps each partition manageable; use date-bound queries so only recent partitions are scanned.
- **Indexes:** All time-based queries use `created_at DESC`; user/scenario use (user_id|admin_user_id|session_id|event_name) + created_at.
- **Avoid full table scans:** Always filter by `created_at` (and optionally user_type, event_name).
- **Aggregation jobs:** Run `analytics_aggregate_daily(date)` and `analytics_aggregate_feature_usage(date)` daily (e.g. 00:05 UTC) for yesterday. Dashboard can read from `analytics_daily_aggregates` and `analytics_feature_usage` for fast overviews.
- **Archiving:** After N months, detach old partitions or export to cold storage and drop partition. Do not delete from the main table without partitioning.
- **Rate limiting:** API limits 60 requests/min per IP and 20 events per request to prevent abuse.

### Pitfalls to Avoid

- **Do not** query `analytics_events` without a date filter on large ranges.
- **Do not** add analytics writes to hot paths that block response (track endpoint is already async from client; server can optionally queue to a worker if needed).
- **Do not** store PII in `metadata` beyond what’s necessary; keep payloads small.
- **Do not** create new partitions in the same transaction as heavy writes; create partitions in a separate migration or cron.
- **Do not** use `admin_audit_log` for product analytics; use `analytics_events` only.

---

## Files Reference

| Path | Purpose |
|------|--------|
| `supabase/migrations/20260302000001_analytics_schema.sql` | Tables, indexes, RLS, insert/upsert RPCs. |
| `supabase/migrations/20260302000002_analytics_funnels_seed_and_aggregates.sql` | Funnel seed, analytics_aggregate_daily, analytics_aggregate_feature_usage. |
| `supabase/migrations/20260302000003_analytics_queries_rpc.sql` | DAU/WAU/MAU, stickiness, session stats, feature usage, admin productivity, funnel steps, inactive, churn. |
| `src/lib/analytics-events.ts` | Event and feature name constants. |
| `src/lib/analytics.ts` | Client trackEvent, session, batch. |
| `src/lib/analytics-server.ts` | Server logEventServer, logEventBatchServer, endSessionServer. |
| `src/app/api/analytics/track/route.ts` | POST /api/analytics/track. |
| `src/app/api/admin/analytics/overview/route.ts` | GET /api/admin/analytics/overview. |
| `src/app/admin/ProductAnalyticsTab.tsx` | Product Analytics tab UI. |
| `src/app/admin/page.tsx` | Tab + tracking wiring (admin_tab_opened, start/end session). |
| `src/components/AppShell.tsx` | App session start/end + feature_viewed on route change. |
| `src/lib/admin-rbac.ts` | read_analytics permission. |
| `supabase/migrations/20260302000004_analytics_cron.sql` | pg_cron job for daily aggregation. |
