-- Analytics & user journey tracking. Separate from admin_audit_log. Scale 1M+ events/day.
-- DO NOT modify admin_audit_log. This schema is independent.
-- Note: analytics_events is a single table for compatibility. For 1M+ events/day, add monthly partitioning later.

-- =============================================================================
-- 1) analytics_events (single table; add partitioning later if needed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE analytics_events IS 'Product & admin analytics events. Do not mix with admin_audit_log.';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_admin_created ON analytics_events (admin_user_id, created_at DESC) WHERE admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created ON analytics_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (user_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_feature_created ON analytics_events (feature_name, created_at DESC) WHERE feature_name IS NOT NULL;

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_events"
  ON analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 2) analytics_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  event_count integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  device_type text,
  country text,
  app_version text,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_started ON analytics_sessions (user_id, started_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_admin_started ON analytics_sessions (admin_user_id, started_at DESC) WHERE admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id ON analytics_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_type_started ON analytics_sessions (user_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_activity ON analytics_sessions (last_activity_at DESC);

COMMENT ON TABLE analytics_sessions IS 'Session boundaries and aggregates. Updated on heartbeat/end.';

ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_sessions"
  ON analytics_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 3) analytics_daily_aggregates
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_daily_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  dimensions jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, user_type, metric_name, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date_type ON analytics_daily_aggregates (date, user_type);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_metric ON analytics_daily_aggregates (metric_name, date DESC);

COMMENT ON TABLE analytics_daily_aggregates IS 'Pre-aggregated daily metrics for fast dashboard. Filled by aggregation job.';

ALTER TABLE analytics_daily_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_daily_aggregates"
  ON analytics_daily_aggregates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 4) analytics_feature_usage
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  feature_name text NOT NULL,
  event_name text NOT NULL,
  unique_users bigint NOT NULL DEFAULT 0,
  total_events bigint NOT NULL DEFAULT 0,
  total_duration_seconds bigint NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, user_type, feature_name, event_name)
);

CREATE INDEX IF NOT EXISTS idx_analytics_feature_date ON analytics_feature_usage (date DESC, user_type);
CREATE INDEX IF NOT EXISTS idx_analytics_feature_name ON analytics_feature_usage (feature_name, date DESC);

COMMENT ON TABLE analytics_feature_usage IS 'Daily feature-level usage. Aggregated from analytics_events.';

ALTER TABLE analytics_feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_feature_usage"
  ON analytics_feature_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 5) analytics_funnels
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_name text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  steps jsonb NOT NULL DEFAULT '[]',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funnel_name, user_type)
);

COMMENT ON TABLE analytics_funnels IS 'Funnel definitions: ordered list of event_name steps.';

CREATE TABLE IF NOT EXISTS analytics_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES analytics_funnels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  step_index int NOT NULL,
  step_event_name text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funnel_id, session_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_analytics_funnel_events_funnel ON analytics_funnel_events (funnel_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_funnel_events_session ON analytics_funnel_events (funnel_id, session_id);

ALTER TABLE analytics_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_funnels" ON analytics_funnels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only analytics_funnel_events" ON analytics_funnel_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 6) analytics_retention_cohorts
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_retention_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  cohort_date date NOT NULL,
  cohort_type text NOT NULL CHECK (cohort_type IN ('signup', 'first_action', 'weekly')),
  retained_d1 boolean,
  retained_d7 boolean,
  retained_d30 boolean,
  retained_w1 boolean,
  retained_w2 boolean,
  retained_w4 boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_retention_app_unique ON analytics_retention_cohorts (user_id, cohort_date, cohort_type) WHERE user_type = 'app' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_retention_admin_unique ON analytics_retention_cohorts (admin_user_id, cohort_date, cohort_type) WHERE user_type = 'admin' AND admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_retention_cohort_date ON analytics_retention_cohorts (cohort_date, user_type, cohort_type);
CREATE INDEX IF NOT EXISTS idx_analytics_retention_user ON analytics_retention_cohorts (user_id, cohort_date) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_retention_admin ON analytics_retention_cohorts (admin_user_id, cohort_date) WHERE admin_user_id IS NOT NULL;

COMMENT ON TABLE analytics_retention_cohorts IS 'Cohort assignment and retention flags. Updated by aggregation job.';

ALTER TABLE analytics_retention_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only analytics_retention_cohorts"
  ON analytics_retention_cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- RPC: Insert event (single row, used by API)
-- =============================================================================
CREATE OR REPLACE FUNCTION analytics_insert_event(
  p_user_id uuid,
  p_admin_user_id uuid,
  p_session_id text,
  p_event_name text,
  p_feature_name text,
  p_page_name text,
  p_user_type text,
  p_metadata jsonb,
  p_device_type text,
  p_country text,
  p_app_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO analytics_events (
    user_id, admin_user_id, session_id, event_name, feature_name, page_name,
    user_type, metadata, device_type, country, app_version
  ) VALUES (
    p_user_id, p_admin_user_id, p_session_id, p_event_name, p_feature_name, p_page_name,
    p_user_type, COALESCE(p_metadata, '{}'), p_device_type, p_country, p_app_version
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION analytics_insert_event IS 'Insert single analytics event. Used by POST /api/analytics/track.';

-- =============================================================================
-- RPC: Upsert session (start or heartbeat/end)
-- =============================================================================
CREATE OR REPLACE FUNCTION analytics_upsert_session(
  p_session_id text,
  p_user_id uuid,
  p_admin_user_id uuid,
  p_user_type text,
  p_end_session boolean DEFAULT false,
  p_event_count_delta int DEFAULT 0,
  p_page_views_delta int DEFAULT 0,
  p_device_type text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_app_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_started_at timestamptz;
  v_duration_seconds int;
BEGIN
  INSERT INTO analytics_sessions (
    session_id, user_id, admin_user_id, user_type, started_at, last_activity_at,
    event_count, page_views, device_type, country, app_version
  ) VALUES (
    p_session_id, p_user_id, p_admin_user_id, p_user_type, v_now, v_now,
    GREATEST(0, p_event_count_delta), GREATEST(0, p_page_views_delta),
    p_device_type, p_country, p_app_version
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_activity_at = CASE WHEN p_end_session THEN analytics_sessions.last_activity_at ELSE v_now END,
    ended_at = CASE WHEN p_end_session THEN v_now ELSE analytics_sessions.ended_at END,
    duration_seconds = CASE
      WHEN p_end_session THEN EXTRACT(epoch FROM (v_now - analytics_sessions.started_at))::int
      ELSE analytics_sessions.duration_seconds
    END,
    event_count = analytics_sessions.event_count + GREATEST(0, p_event_count_delta),
    page_views = analytics_sessions.page_views + GREATEST(0, p_page_views_delta),
    device_type = COALESCE(p_device_type, analytics_sessions.device_type),
    country = COALESCE(p_country, analytics_sessions.country),
    app_version = COALESCE(p_app_version, analytics_sessions.app_version)
  ;
END;
$$;

COMMENT ON FUNCTION analytics_upsert_session IS 'Start or update session. Call with end_session=true to close.';
