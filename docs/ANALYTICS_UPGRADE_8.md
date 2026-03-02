# Analytics Upgrade to 8+ Production Readiness

Upgrade from ~6.5/10 to 8+ for &lt;5K daily users. No Redis/Kafka; minimal changes.

---

## 1. Partition analytics_events

**Migration:** `supabase/migrations/20260302100001_analytics_events_partitioned.sql`

- Converts `analytics_events` to a table partitioned by **RANGE (created_at)** (monthly).
- Creates 4 partitions: current month + next 3 (names like `analytics_events_new_202603`).
- **Safe strategy:** New table → backfill `INSERT ... SELECT` → `DROP` old → `RENAME` new. Run during low traffic; backfill is one bulk insert.
- **If table already has data:** The migration copies all rows into the partitioned table, then swaps. No separate backfill script.
- **New partitions:** Add monthly (e.g. via cron or manual migration):
  ```sql
  CREATE TABLE analytics_events_YYYYMM PARTITION OF analytics_events
  FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');
  ```
- All existing RPCs filter by `created_at`; partition pruning applies automatically.

---

## 2. True ordered funnel + drop analytics_funnel_events

**Migration:** `supabase/migrations/20260302100002_analytics_funnel_ordered_and_orphan_sessions.sql`

- **analytics_get_funnel_steps** replaced with ordered logic:
  - First occurrence per user per step in the date window (`MIN(created_at)`).
  - User converts step N only if they have step N after step N-1 (same window).
- Returns: `step_index`, `step_event_name`, `unique_users`, `conversion_rate_from_previous_step` (step N / step N-1, or NULL for step 1).
- **analytics_funnel_events** dropped (was never populated).

---

## 3. Retention (D1 + D7)

**Migration:** `supabase/migrations/20260302100003_analytics_retention_d1_d7.sql`

- **analytics_compute_retention(p_date):**
  - Cohort = users with `signup_completed` or `first_core_action` on `p_date` (app only).
  - D1 = active on `p_date + 1`, D7 = active on `p_date + 7`.
  - Upserts into `analytics_retention_cohorts` (cohort_type = `first_action`).

**Cron (daily, after daily aggregate):**
```sql
SELECT analytics_compute_retention(current_date - 1);
```

---

## 4. Orphan session cleanup

**Migration:** `supabase/migrations/20260302100002_analytics_funnel_ordered_and_orphan_sessions.sql`

- **analytics_close_orphan_sessions():**
  - Sets `ended_at = last_activity_at` and `duration_seconds` for sessions where `ended_at IS NULL` and `last_activity_at < now() - 30 minutes`.
  - Returns number of sessions closed.

**Cron (every 6 hours):**
```sql
SELECT analytics_close_orphan_sessions();
```

**Scheduled via pg_cron:** `supabase/migrations/20260302100004_analytics_cron_retention_orphan.sql` adds:
- `analytics-compute-retention`: 00:15 UTC daily.
- `analytics-close-orphan-sessions`: every 6 hours.

---

## 5. Auth for track endpoint

**Code:** `src/app/api/analytics/track/route.ts`

- **Unauthenticated:** Only `app_open` and `session_start` allowed. Rate limit **10 requests/min per IP**.
- **Authenticated:** All events allowed. Rate limit **60 requests/min per user** (per `user_id`).
- Returns **401** if unauthenticated and batch contains any other event name.

---

## 6. Retry for partial batch failure

**Code:** `src/lib/analytics-server.ts`

- Each `analytics_insert_event` call is retried **once** after 50 ms on failure.
- Session upsert uses the **actual successful insert count** (`inserted`).
- Failed events are skipped (no infinite retry).

---

## 7. Metadata PII protection

**Code:** `src/lib/analytics-server.ts` — `sanitizeMetadata` / `capValue`

- Value length cap remains **1000** characters.
- If a string value contains `@` or matches a phone-like pattern (`+?[\d\s\-()]{10,}`), it is replaced with `[REDACTED]`.
- Lightweight; no heavy regex.

---

## Migration order

1. `20260302100001_analytics_events_partitioned.sql` — partition events (run in low-traffic window if table is large).
2. `20260302100002_analytics_funnel_ordered_and_orphan_sessions.sql` — funnel RPC + drop funnel_events + orphan RPC.
3. `20260302100003_analytics_retention_d1_d7.sql` — retention RPC.
4. `20260302100004_analytics_cron_retention_orphan.sql` — cron for retention + orphan (requires pg_cron).

---

## Cron summary

| Job                         | Schedule     | SQL |
|----------------------------|-------------|-----|
| analytics-daily-aggregate  | 00:05 UTC   | `SELECT analytics_aggregate_daily(current_date - 1); SELECT analytics_aggregate_feature_usage(current_date - 1);` |
| analytics-compute-retention| 00:15 UTC   | `SELECT analytics_compute_retention(current_date - 1);` |
| analytics-close-orphan-sessions | */6 * * * * | `SELECT analytics_close_orphan_sessions();` |

---

## UI

- **Product Analytics tab:** Funnel steps show `conversion_rate_from_previous_step` as “(X% from prev)” when present.
