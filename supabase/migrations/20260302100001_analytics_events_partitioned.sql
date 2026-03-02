-- =============================================================================
-- SECTION 1: Partition analytics_events by created_at (monthly).
-- Safe strategy: create new partitioned table, copy data, swap. Minimal downtime.
-- Run during low traffic; backfill is a single INSERT...SELECT.
-- =============================================================================

-- Step 1: Create partitioned parent (same columns as analytics_events).
CREATE TABLE analytics_events_new (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  event_name text NOT NULL,
  feature_name text,
  page_name text,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  metadata jsonb DEFAULT '{}',
  device_type text,
  country text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE analytics_events_new IS 'Product & admin analytics events (partitioned by month).';

-- Step 2: Create monthly partitions (current month + next 3). Dynamic so migration works any time.
DO $$
DECLARE
  start_month date := date_trunc('month', current_date)::date;
  i int;
  part_name text;
  from_bound date;
  to_bound date;
BEGIN
  FOR i IN 0..3 LOOP
    from_bound := start_month + (i || ' months')::interval;
    to_bound := start_month + ((i + 1) || ' months')::interval;
    part_name := 'analytics_events_new_' || to_char(from_bound, 'YYYYMM');
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF analytics_events_new FOR VALUES FROM (%L) TO (%L)',
      part_name, from_bound, to_bound
    );
  END LOOP;
END $$;

-- Step 3: Create indexes on parent (PG11+ propagates to all partitions).
CREATE INDEX idx_analytics_events_new_user_created ON analytics_events_new (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_new_admin_created ON analytics_events_new (admin_user_id, created_at DESC) WHERE admin_user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_new_session_created ON analytics_events_new (session_id, created_at DESC);
CREATE INDEX idx_analytics_events_new_name_created ON analytics_events_new (event_name, created_at DESC);
CREATE INDEX idx_analytics_events_new_type_created ON analytics_events_new (user_type, created_at DESC);
CREATE INDEX idx_analytics_events_new_created ON analytics_events_new (created_at DESC);
CREATE INDEX idx_analytics_events_new_feature_created ON analytics_events_new (feature_name, created_at DESC) WHERE feature_name IS NOT NULL;

-- Step 4: Backfill — copy existing data (no-op if table empty).
INSERT INTO analytics_events_new (
  id, user_id, admin_user_id, session_id, event_name, feature_name, page_name,
  user_type, metadata, device_type, country, app_version, created_at
)
SELECT id, user_id, admin_user_id, session_id, event_name, feature_name, page_name,
  user_type, metadata, device_type, country, app_version, created_at
FROM analytics_events;

-- Step 5: Swap tables (brief exclusive lock).
DROP TABLE analytics_events;
ALTER TABLE analytics_events_new RENAME TO analytics_events;

-- Step 6: RLS (same as before).
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_events"
  ON analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC analytics_insert_event is unchanged; it inserts into analytics_events (now partitioned).
-- All dashboard RPCs filter by created_at so partition pruning applies.
