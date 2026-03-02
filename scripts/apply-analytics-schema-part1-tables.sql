-- =============================================================================
-- PART 1: Analytics tables only. Run this FIRST in Supabase SQL Editor.
-- After this succeeds, run apply-analytics-schema.sql (Part 2 = functions + seed).
-- =============================================================================

-- 1) analytics_events
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

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_admin_created ON analytics_events (admin_user_id, created_at DESC) WHERE admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created ON analytics_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (user_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_feature_created ON analytics_events (feature_name, created_at DESC) WHERE feature_name IS NOT NULL;

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only analytics_events" ON analytics_events;
CREATE POLICY "Service role only analytics_events" ON analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) analytics_sessions
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
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only analytics_sessions" ON analytics_sessions;
CREATE POLICY "Service role only analytics_sessions" ON analytics_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) analytics_daily_aggregates
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
ALTER TABLE analytics_daily_aggregates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only analytics_daily_aggregates" ON analytics_daily_aggregates;
CREATE POLICY "Service role only analytics_daily_aggregates" ON analytics_daily_aggregates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) analytics_feature_usage
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
ALTER TABLE analytics_feature_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only analytics_feature_usage" ON analytics_feature_usage;
CREATE POLICY "Service role only analytics_feature_usage" ON analytics_feature_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) analytics_funnels + analytics_funnel_events
CREATE TABLE IF NOT EXISTS analytics_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_name text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('app', 'admin')),
  steps jsonb NOT NULL DEFAULT '[]',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funnel_name, user_type)
);
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
DROP POLICY IF EXISTS "Service role only analytics_funnels" ON analytics_funnels;
DROP POLICY IF EXISTS "Service role only analytics_funnel_events" ON analytics_funnel_events;
CREATE POLICY "Service role only analytics_funnels" ON analytics_funnels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only analytics_funnel_events" ON analytics_funnel_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6) analytics_retention_cohorts
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
ALTER TABLE analytics_retention_cohorts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only analytics_retention_cohorts" ON analytics_retention_cohorts;
CREATE POLICY "Service role only analytics_retention_cohorts" ON analytics_retention_cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);
