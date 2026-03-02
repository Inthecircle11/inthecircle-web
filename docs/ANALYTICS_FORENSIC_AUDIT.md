# Analytics System — Full Forensic Audit

**Scope:** Structural, logical, performance, and data-integrity audit.  
**Assumptions:** Production, 100K users, 1M events/day, 5-year horizon.  
**No redesign or feature requests — audit only.**

**Fixes applied (post-audit):** End-session-only now closes session; mixed user_type batches rejected (400); rate-limit map pruned when size > 10k to bound memory; metadata values capped at 1000 chars server-side.

---

## SECTION 1 — DATABASE AUDIT

### 1.1 analytics_events

| Check | Finding | Severity |
|-------|--------|----------|
| **Partitioning** | **NOT partitioned.** Migration comment says "single table; add partitioning later." Docs claim partitioning by month — **documentation/schema mismatch**. At 1M events/day, single-table scans will degrade within months. | **Critical** |
| **Index correctness** | Indexes present: (user_id, created_at DESC), (admin_user_id, created_at DESC), (session_id, created_at DESC), (event_name, created_at DESC), (user_type, created_at DESC), (created_at DESC), (feature_name, created_at DESC). All are B-tree; no BRIN for time-series. | Medium (no partition pruning without partitioning) |
| **Full table scan risk** | All dashboard RPCs filter by `created_at >= ...` and/or `user_type`. Without partitioning, 5 years of data = full index scan on (created_at DESC) or (user_type, created_at DESC) — **hundreds of millions of rows**. | **Critical** |
| **Missing composite indexes** | Queries like `analytics_get_dau_wau_mau` use `(user_type, user_id, created_at)`. Existing (user_type, created_at DESC) helps but (user_type, created_at) with covering could reduce I/O. Not critical if partition exists. | Low |
| **Write amplification** | Single table; each insert touches one heap + 7 indexes. No partitioning lock contention. | Acceptable |
| **Insert performance** | `analytics_insert_event` is single-row INSERT; no batching at DB layer. API batches up to 20 RPCs per request — **20 round-trips per batch**. | High (N RPCs per batch) |
| **Deadlocks** | No multi-table locking in insert path; session upsert is separate. Unlikely unless many concurrent upserts on same session_id. | Low |
| **RLS** | FOR ALL TO service_role only; anon/authenticated have no access. Correct. | OK |
| **JSONB** | `metadata` is jsonb, default '{}'. No size limit; keys truncated to 50 chars client/server, **values unlimited** — large payloads possible. | Medium (storage/DoS) |
| **Storage bloat** | No partitioning → no easy partition drop. VACUUM on single huge table will be slow; bloat risk over years. | High |
| **Vacuum/analyze** | No scheduled VACUUM/ANALYZE in migrations. At scale, autovacuum may lag. | Medium |
| **Primary key / uniqueness** | id uuid PRIMARY KEY DEFAULT gen_random_uuid(); no business uniqueness. session_id is NOT UNIQUE (many events per session). Correct. | OK |

**Data integrity risks:** None beyond missing partitioning. **Scale bottleneck:** Single table + 20× RPC per batch.

---

### 1.2 analytics_sessions

| Check | Finding | Severity |
|-------|--------|----------|
| **Index correctness** | session_id UNIQUE + idx; (user_id, started_at), (admin_user_id, started_at), (user_type, started_at), (last_activity_at). Good for lookups and time-bound queries. | OK |
| **Full table scan risk** | Aggregation and dashboard use `started_at >= ...` or `ended_at` range; indexes support. | OK |
| **RLS** | service_role only. Correct. | OK |
| **JSONB** | metadata jsonb; same unbounded value risk as events. | Low |
| **Uniqueness** | session_id UNIQUE; one row per session. Correct. | OK |

**Risks:** Orphan sessions (no end) will accumulate; no cleanup job. Session table grows unbounded (one row per session ever).

---

### 1.3 analytics_daily_aggregates

| Check | Finding | Severity |
|-------|--------|----------|
| **Uniqueness** | UNIQUE (date, user_type, metric_name, dimensions). All current inserts use dimensions = '{}'. Correct. | OK |
| **ON CONFLICT** | All aggregation INSERTs use ON CONFLICT DO UPDATE. Idempotent. | OK |
| **Index** | (date, user_type), (metric_name, date DESC). Adequate for dashboard. | OK |

**Risks:** None material.

---

### 1.4 analytics_feature_usage

| Check | Finding | Severity |
|-------|--------|----------|
| **Uniqueness** | UNIQUE (date, user_type, feature_name, event_name). ON CONFLICT in aggregation. Correct. | OK |
| **Schema vs INSERT** | Table has `total_duration_seconds bigint NOT NULL DEFAULT 0` but `analytics_aggregate_feature_usage` does **not** set it (only unique_users, total_events). Column remains 0. Misleading if any consumer expects duration. | Low |

---

### 1.5 analytics_funnels

| Check | Finding | Severity |
|-------|--------|----------|
| **Structure** | UNIQUE (funnel_name, user_type); steps as jsonb array. Correct. | OK |

---

### 1.6 analytics_funnel_events

| Check | Finding | Severity |
|-------|--------|----------|
| **Usage** | **Table is never written to.** No application or RPC inserts into it. Funnel step counts are computed from `analytics_events` in `analytics_get_funnel_steps`. This table is **dead/orphan**. | **Critical** (dead schema) |

---

### 1.7 analytics_retention_cohorts

| Check | Finding | Severity |
|-------|--------|----------|
| **Population** | **No RPC or cron job ever inserts or updates this table.** Retention cohort fields (retained_d1, retained_d7, etc.) are never set. Table will remain empty. Docs say "Populate via scheduled job" — **no such job exists**. | **Critical** |
| **Uniqueness** | Partial unique indexes on (user_id, cohort_date, cohort_type) and (admin_user_id, cohort_date, cohort_type). Correct for when populated. | OK |

---

### Section 1 summary

- **Critical:** analytics_events not partitioned (docs say otherwise); analytics_funnel_events unused; analytics_retention_cohorts never populated.
- **High:** Insert path does N single-row RPCs per batch (no bulk insert); storage bloat and vacuum at scale.
- **Medium:** Metadata values unbounded; no composite (user_type, created_at) + partition strategy; no explicit vacuum/analyze strategy.

---

## SECTION 2 — EVENT INGESTION AUDIT

### 2.1 Race conditions

- **Session upsert:** Multiple requests with same session_id can run analytics_upsert_session concurrently. PostgreSQL ON CONFLICT DO UPDATE is row-level; last writer wins for event_count/page_views/duration. RPC uses `event_count = analytics_sessions.event_count + delta` — additive. No race on count; only last_activity_at/ended_at could be reordered. Acceptable.
- **User context:** user_id/admin_user_id from auth.getUser() in same request; no cross-request race.

### 2.2 Session mismatch

- **Batch uses first event's session_id and user_type** for the session upsert. If client erroneously sends mixed session_ids in one batch, only first is updated. Client currently sends single session_id per request; risk is low unless client is buggy.
- **Admin vs app:** If batch has mixed user_type, server uses `events[0].user_type` for context and session. Events with user_type 'app' in same batch as 'admin' get **wrong user_id/admin_user_id**. **Logical bug for mixed batches.**

### 2.3 Event duplication

- No idempotency key. Same event sent twice = two rows. Client retry on fetch failure re-queues batch → **retry can duplicate events.**

### 2.4 Abuse / spam

- **Rate limit:** 60 requests/min per IP, in-memory Map. **Resets on server restart.** In serverless/multi-instance, each instance has its own map → **60 × number of instances** per IP per minute. **Bypass risk: High.**
- No auth required for POST /api/analytics/track; unauthenticated requests get user_id null but events still stored. **Spam/poisoning:** Attacker can fill events with arbitrary event_name/feature_name/page_name (length-limited).

### 2.5 Injection

- All string fields truncated and passed as RPC parameters; no raw SQL concatenation. **SQL injection risk: Low.**
- metadata: stored as jsonb; keys truncated, **values not size-limited** — could store large strings. **Storage/DoS: Medium.**

### 2.6 Payload overflow

- session_id 128, event_name 100, feature_name 100, page_name 200, device_type 50, app_version 50. **metadata values unbounded** in server sanitizeMetadata (only key length capped). **Risk: Medium.**

### 2.7 Rate limit bypass

- In-memory per-instance; no distributed rate limit. **High** in multi-instance deployment.

### 2.8 Memory leaks

- `ipCounts` Map grows by IP; entries reset after window. Old entries removed only when that IP is seen again and window expired. **Unbounded growth** over time if many distinct IPs. **Medium** (restart clears).

### 2.9 Batch failure edge cases

- **Partial insert:** logEventBatchServer inserts one-by-one; on first failure it continues, counts only successful inserts. Session is updated with `inserted` count. **Events after a failed insert are still attempted**. Partial success possible; **event_count on session can be less than actual inserted** if some RPCs failed. No retry of failed events; **silent data loss.**
- **end_session when batch is only _end_session:** Route filters to `eventsToInsert = events.filter(e => e.event_name !== '_end_session')`. If body is `{ events: [{ event_name: '_end_session', user_type: 'app' }], end_session: true }`, then eventsToInsert is **empty**. logEventBatchServer(service, [], context, { end_session: true }) returns immediately (inserted 0). Condition `if ((body.end_session || hasEndSession) && eventsToInsert.length > 0)` is **false**, so **endSessionServer is never called**. **Session never closed on server.** Orphan session, duration_seconds never set. **Critical bug.**

### 2.10 Lost events on navigation/unload

- endSession() does flush() then send; **send is async**. If user closes tab before fetch completes, **session_end and _end_session may not be delivered**. Events in queue at unload are lost (no sendBeacon in flush). **Known limitation; Medium.**

### Section 2 summary

- **Critical:** End-session-only request never calls endSessionServer → session never closed.
- **High:** Rate limit per-instance (bypass); mixed user_type batch uses first event only (wrong attribution); partial batch failure = silent event loss.
- **Medium:** metadata values unbounded; ipCounts unbounded growth; duplicate on retry; unload can lose last batch.

---

## SECTION 3 — SESSION SYSTEM AUDIT

### 3.1 30 min inactivity

- Client-only; server does not expire sessions. last_activity_at is updated on every track; server never compares to "now" to close. **Orphan sessions** (user closed without end_session) stay open forever.

### 3.2 sessionStorage reliance

- session_id and last_activity in sessionStorage. **New tab = new session.** Same user, two tabs = two sessions. By design. OK.

### 3.3 Heartbeat

- startSession() on expired session pushes a `session_heartbeat` event. No periodic heartbeat; only activity extends. Correct.

### 3.4 Server upsert logic

- **INSERT:** event_count = GREATEST(0, p_event_count_delta). **New session gets event_count = first batch size.** Correct.
- **UPDATE:** event_count = analytics_sessions.event_count + delta. Additive. Correct.
- **end_session:** ended_at = v_now, duration_seconds = EXTRACT(epoch FROM (v_now - started_at)). Correct.

### 3.5 end_session flag behavior

- When end_session=true, last_activity_at is left as-is. Correct.

### 3.6 Double session creation

- Single session_id per client; upsert by session_id. No double creation. OK.

### 3.7 Orphan sessions

- **High:** Sessions without end_session (tab kill, or end-session-only bug above) never get ended_at. **Duration and "sessions that ended" metrics are undercounted.**

### 3.8 event_count desync

- Session event_count is incremented by API batch inserted count. If some inserts fail, **event_count can be less than actual rows in analytics_events for that session.**

### 3.9 Cross-tab

- App tab and admin tab: same origin, same sessionStorage. **Same session_id.** If user opens admin then app (or vice versa), **mixed events in one session**; user_type on session is from first batch. **Collision risk: Medium.**

### Section 3 summary

- **Critical:** End-session-only not calling endSessionServer (see §2).
- **High:** Orphan sessions never closed; event_count can desync on partial insert failure.
- **Medium:** Cross-tab app+admin same session_id; duration understated due to orphans.

---

## SECTION 4 — FUNNEL AUDIT

### 4.1 analytics_get_funnel_steps logic

- For each step (event_name in funnel order), it counts **DISTINCT user_id (or admin_user_id)** where event_name = step and created_at in [p_from, p_to+1 day).
- **It does NOT require step N to occur after step N-1.** So it's "how many unique users did this event in the date range" per step, **not** "how many users did step1 then step2 then step3 in sequence." **Drop-off is misleading** — step 2 count can exceed step 1. **Not a true funnel; High risk for wrong decisions.**

### 4.2 analytics_funnel_events

- Table exists with (funnel_id, session_id, step_index) UNIQUE; **never populated.** Funnel RPC does not use it. Dead table.

### Section 4 summary

- **Critical:** Funnel is step-wise unique users, not ordered conversion.
- **High:** analytics_funnel_events unused.

---

## SECTION 5 — RETENTION AUDIT

- **analytics_retention_cohorts:** **No job or RPC populates this table.** Retention metrics are unavailable. **Critical.**

---

## SECTION 6 — ADMIN ANALYTICS TAB AUDIT

- **Auth:** requireAdmin + requirePermission(read_analytics). Correct.
- **Caching:** In-memory, 60s TTL. Shared for all admins. OK.
- **RPC chaining:** 12 parallel RPCs (Promise.all). No N+1. Good.
- **Cache stampede:** No lock; first request after expiry runs 12 RPCs. **Medium.**
- **Stickiness date:** Uses UTC date. If business interprets "today" in local TZ, **misleading.** Medium.

### Section 6 summary

- **Medium:** Cache stampede; stickiness "today" is UTC. Permission and overfetch OK.

---

## SECTION 7 — SCALABILITY SIMULATION

- **analytics_events:** 1M × 365 × 5 ≈ **1.8B rows** in one table. No partitioning → every time-bound query scans a multi-GB index.
- **Partition count:** **0** (no partitions). Doc said "partitioned by month" — **false.**
- **Storage (rough):** ~200 bytes/event → **~365 GB** events in 5 years; with indexes **~1 TB**.
- **Partition strategy:** **Not implemented.**

### Section 7 summary

- **Critical:** No partitioning; 5-year scale will degrade.
- **High:** Index bloat and vacuum strategy missing.

---

## SECTION 8 — DATA ACCURACY STRESS TEST

- **DAU vs session count:** Different definitions; both correct.
- **Stickiness:** DAU/MAU formula correct. **Date is UTC.**
- **Feature usage aggregation:** Correct.
- **Churn / inactive users:** Correct.
- **Funnel semantics:** Wrong (see §4).

### Section 8 summary

- **Correct:** DAU, sessions, feature aggregation, churn, inactive. **Funnel semantics wrong.**

---

## SECTION 9 — SECURITY AUDIT

| Risk | Finding | Severity |
|------|--------|----------|
| **PII leakage** | metadata, page_name can contain PII. No server-side scrub. | **High** |
| **Metadata abuse** | Unbounded values; can store large payloads. | **Medium** |
| **DoS** | Rate limit per-instance bypass; no auth on track. **Attacker can fill events table.** | **High** |
| **Injection** | RPC parameters; no concatenation. Low. | Low |

---

## SECTION 10 — FINAL VERDICT

### 10.1 Production readiness score: **4 / 10**

### 10.2 Critical issues (must fix before business-critical use)

1. **End-session-only request never closes session** — endSessionServer not called when batch contains only _end_session. Fix: call endSessionServer when body.end_session || hasEndSession regardless of eventsToInsert.length.
2. **analytics_events not partitioned** — Docs claim partitioning; schema is single table. At 1M/day, add monthly partitions.
3. **Funnel metric is not a funnel** — Counts unique users per step in window, not ordered conversion. Document or implement true ordered funnel.
4. **analytics_retention_cohorts never populated** — No job. Implement or remove/deprecate.
5. **analytics_funnel_events never written** — Dead table. Remove or implement.

### 10.3 High-risk issues

1. **Rate limit in-memory** — Use distributed rate limit and/or require auth for track.
2. **Orphan sessions** — Consider server-side session timeout job.
3. **Partial batch failure** — Silent event loss; consider retry or transactional batch.
4. **Mixed user_type in batch** — First event drives context; reject mixed or split.
5. **PII in metadata/page_name** — Policy and/or server-side scrub.

### 10.4 Medium-risk issues

1. **Metadata value size** — Cap value length in sanitizeMetadata.
2. **ipCounts unbounded** — TTL cleanup or bounded structure.
3. **Cache stampede on overview** — Lock or stale-while-revalidate.
4. **Stickiness "today"** — Document or parameterize timezone.

### 10.5 Safe areas

- RLS and service_role-only access; admin auth and read_analytics.
- Session upsert math; DAU/WAU/MAU, stickiness formula, churn, inactive, feature aggregation.
- Index set on events (adequate if partitioned); idempotent daily aggregation.

### 10.6 Safe to launch at scale?

- **No.** Not for 100K users and 1M events/day without addressing critical and high-risk items.

### 10.7 Before 100K users

- Fix end-session-only bug.
- Implement or remove retention cohort; remove or use funnel_events.
- Clarify or fix funnel semantics.
- Add distributed rate limit or auth; cap metadata value size.

### 10.8 Before 1M events/day

- Add monthly partitioning to analytics_events.
- Plan vacuum/analyze and partition lifecycle.
- Consider bulk insert RPC (array of events) to reduce round-trips.

---

*End of audit. No redesign or feature requests; structural, logical, performance, and data-integrity only.*
