-- =============================================================================
-- Apply analytics schema manually (when db push fails due to migration history mismatch)
-- Run in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Run in TWO steps to avoid "relation analytics_events does not exist":
--   1. Run scripts/apply-analytics-schema-part1-tables.sql  (creates all tables)
--   2. Run THIS file (creates functions + seed)
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

-- RPCs: insert event + upsert session
CREATE OR REPLACE FUNCTION analytics_insert_event(
  p_user_id uuid, p_admin_user_id uuid, p_session_id text, p_event_name text,
  p_feature_name text, p_page_name text, p_user_type text, p_metadata jsonb,
  p_device_type text, p_country text, p_app_version text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO analytics_events (user_id, admin_user_id, session_id, event_name, feature_name, page_name, user_type, metadata, device_type, country, app_version)
  VALUES (p_user_id, p_admin_user_id, p_session_id, p_event_name, p_feature_name, p_page_name, p_user_type, COALESCE(p_metadata, '{}'), p_device_type, p_country, p_app_version)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION analytics_upsert_session(
  p_session_id text, p_user_id uuid, p_admin_user_id uuid, p_user_type text,
  p_end_session boolean DEFAULT false, p_event_count_delta int DEFAULT 0, p_page_views_delta int DEFAULT 0,
  p_device_type text DEFAULT NULL, p_country text DEFAULT NULL, p_app_version text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_now timestamptz := now();
BEGIN
  INSERT INTO analytics_sessions (session_id, user_id, admin_user_id, user_type, started_at, last_activity_at, event_count, page_views, device_type, country, app_version)
  VALUES (p_session_id, p_user_id, p_admin_user_id, p_user_type, v_now, v_now, GREATEST(0, p_event_count_delta), GREATEST(0, p_page_views_delta), p_device_type, p_country, p_app_version)
  ON CONFLICT (session_id) DO UPDATE SET
    last_activity_at = CASE WHEN p_end_session THEN analytics_sessions.last_activity_at ELSE v_now END,
    ended_at = CASE WHEN p_end_session THEN v_now ELSE analytics_sessions.ended_at END,
    duration_seconds = CASE WHEN p_end_session THEN EXTRACT(epoch FROM (v_now - analytics_sessions.started_at))::int ELSE analytics_sessions.duration_seconds END,
    event_count = analytics_sessions.event_count + GREATEST(0, p_event_count_delta),
    page_views = analytics_sessions.page_views + GREATEST(0, p_page_views_delta),
    device_type = COALESCE(p_device_type, analytics_sessions.device_type),
    country = COALESCE(p_country, analytics_sessions.country),
    app_version = COALESCE(p_app_version, analytics_sessions.app_version);
END;
$$;

-- Seed funnels
INSERT INTO analytics_funnels (funnel_name, user_type, steps, description) VALUES
  ('App Activation', 'app', '["signup_completed", "onboarding_completed", "first_core_action", "return_within_7d"]'::jsonb, 'Signup → Onboarding → First Core Action → Return within 7 days'),
  ('Admin Review', 'admin', '["admin_login", "admin_tab_opened", "admin_action_performed", "admin_application_reviewed"]'::jsonb, 'Login → Open tab → Perform action → Review application')
ON CONFLICT (funnel_name, user_type) DO UPDATE SET steps = EXCLUDED.steps, description = EXCLUDED.description;

-- Aggregation RPCs
CREATE OR REPLACE FUNCTION analytics_aggregate_daily(p_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'dau', count(DISTINCT user_id)::numeric, '{}'::jsonb FROM analytics_events WHERE user_type = 'app' AND created_at >= p_date AND created_at < p_date + interval '1 day' AND user_id IS NOT NULL
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'dau', count(DISTINCT admin_user_id)::numeric, '{}'::jsonb FROM analytics_events WHERE user_type = 'admin' AND created_at >= p_date AND created_at < p_date + interval '1 day' AND admin_user_id IS NOT NULL
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'sessions', count(*)::numeric, '{}'::jsonb FROM analytics_sessions WHERE user_type = 'app' AND started_at >= p_date AND started_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'sessions', count(*)::numeric, '{}'::jsonb FROM analytics_sessions WHERE user_type = 'admin' AND started_at >= p_date AND started_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'avg_session_duration_seconds', coalesce(avg(duration_seconds), 0)::numeric, '{}'::jsonb FROM analytics_sessions WHERE user_type = 'app' AND ended_at IS NOT NULL AND ended_at >= p_date AND ended_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'events_total', count(*)::numeric, '{}'::jsonb FROM analytics_events WHERE user_type = 'app' AND created_at >= p_date AND created_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'events_total', count(*)::numeric, '{}'::jsonb FROM analytics_events WHERE user_type = 'admin' AND created_at >= p_date AND created_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
END;
$$;

CREATE OR REPLACE FUNCTION analytics_aggregate_feature_usage(p_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO analytics_feature_usage (date, user_type, feature_name, event_name, unique_users, total_events)
  SELECT p_date, user_type, coalesce(feature_name, 'unknown'), event_name, count(DISTINCT coalesce(user_id, admin_user_id)), count(*)
  FROM analytics_events WHERE created_at >= p_date AND created_at < p_date + interval '1 day'
  GROUP BY p_date, user_type, coalesce(feature_name, 'unknown'), event_name
  ON CONFLICT (date, user_type, feature_name, event_name) DO UPDATE SET unique_users = EXCLUDED.unique_users, total_events = EXCLUDED.total_events;
END;
$$;

-- Dashboard query RPCs (from 20260302000003)
CREATE OR REPLACE FUNCTION analytics_get_dau_wau_mau(p_days int DEFAULT 30)
RETURNS TABLE (date date, dau bigint, wau bigint, mau bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH daily AS (SELECT (created_at AT TIME ZONE 'UTC')::date AS date, count(DISTINCT user_id) AS dau FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= (current_date - (p_days || ' days')::interval) GROUP BY 1),
  wau_calc AS (SELECT d.date, d.dau, (SELECT count(DISTINCT e.user_id) FROM analytics_events e WHERE e.user_type = 'app' AND e.user_id IS NOT NULL AND e.created_at >= d.date - interval '7 days' AND e.created_at < d.date + interval '1 day') AS wau FROM daily d),
  mau_calc AS (SELECT w.date, w.dau, w.wau, (SELECT count(DISTINCT e.user_id) FROM analytics_events e WHERE e.user_type = 'app' AND e.user_id IS NOT NULL AND e.created_at >= w.date - interval '30 days' AND e.created_at < w.date + interval '1 day') AS mau FROM wau_calc w)
  SELECT date, dau, wau, mau FROM mau_calc ORDER BY date DESC;
$$;

CREATE OR REPLACE FUNCTION analytics_get_stickiness(p_date date) RETURNS TABLE (stickiness numeric) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH dau AS (SELECT count(DISTINCT user_id)::numeric AS v FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= p_date AND created_at < p_date + interval '1 day'),
  mau AS (SELECT count(DISTINCT user_id)::numeric AS v FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= p_date - interval '30 days' AND created_at < p_date + interval '1 day')
  SELECT CASE WHEN (SELECT v FROM mau) > 0 THEN round(((SELECT v FROM dau) / (SELECT v FROM mau))::numeric, 4) ELSE 0 END AS stickiness;
$$;

CREATE OR REPLACE FUNCTION analytics_get_avg_session_duration(p_days int DEFAULT 7) RETURNS TABLE (avg_seconds numeric) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT coalesce(round(avg(duration_seconds))::numeric, 0) AS avg_seconds FROM analytics_sessions WHERE user_type = 'app' AND ended_at IS NOT NULL AND ended_at >= (current_date - (p_days || ' days')::interval);
$$;

CREATE OR REPLACE FUNCTION analytics_get_sessions_per_user(p_days int DEFAULT 7) RETURNS TABLE (sessions_per_user numeric) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH s AS (SELECT count(*)::numeric AS total FROM analytics_sessions WHERE user_type = 'app' AND started_at >= (current_date - (p_days || ' days')::interval)),
  u AS (SELECT count(DISTINCT user_id)::numeric AS total FROM analytics_sessions WHERE user_type = 'app' AND user_id IS NOT NULL AND started_at >= (current_date - (p_days || ' days')::interval))
  SELECT CASE WHEN (SELECT total FROM u) > 0 THEN round(((SELECT total FROM s) / (SELECT total FROM u))::numeric, 2) ELSE 0 END AS sessions_per_user;
$$;

CREATE OR REPLACE FUNCTION analytics_get_feature_usage(p_days int DEFAULT 7, p_limit int DEFAULT 20)
RETURNS TABLE (feature_name text, event_name text, unique_users bigint, total_events bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT coalesce(feature_name, 'unknown'), event_name, count(DISTINCT user_id), count(*) FROM analytics_events
  WHERE user_type = 'app' AND created_at >= (current_date - (p_days || ' days')::interval) GROUP BY coalesce(feature_name, 'unknown'), event_name ORDER BY count(*) DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION analytics_get_admin_productivity(p_days int DEFAULT 7)
RETURNS TABLE (admin_user_id uuid, event_count bigint, session_count bigint, unique_days bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT e.admin_user_id, count(*)::bigint, count(DISTINCT e.session_id)::bigint, count(DISTINCT (e.created_at AT TIME ZONE 'UTC')::date)::bigint
  FROM analytics_events e WHERE e.user_type = 'admin' AND e.admin_user_id IS NOT NULL AND e.created_at >= (current_date - (p_days || ' days')::interval) GROUP BY e.admin_user_id ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION analytics_get_admin_tab_usage(p_days int DEFAULT 7)
RETURNS TABLE (feature_name text, event_count bigint, unique_admins bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT coalesce(feature_name, 'unknown'), count(*)::bigint, count(DISTINCT admin_user_id)::bigint FROM analytics_events
  WHERE user_type = 'admin' AND created_at >= (current_date - (p_days || ' days')::interval) GROUP BY coalesce(feature_name, 'unknown') ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION analytics_get_funnel_steps(p_funnel_name text, p_user_type text, p_from date DEFAULT (current_date - 7), p_to date DEFAULT current_date)
RETURNS TABLE (step_index int, step_event_name text, unique_users bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH f AS (SELECT id, steps FROM analytics_funnels WHERE funnel_name = p_funnel_name AND user_type = p_user_type LIMIT 1),
  steps_arr AS (
    SELECT t.step_event_name, t.step_index::int AS step_index
    FROM f
    CROSS JOIN LATERAL jsonb_array_elements_text(f.steps) WITH ORDINALITY AS t(step_event_name, step_index)
  ),
  step_counts AS (SELECT s.step_index, s.step_event_name, count(DISTINCT CASE WHEN e.user_id IS NOT NULL THEN e.user_id WHEN e.admin_user_id IS NOT NULL THEN e.admin_user_id END) AS unique_users
    FROM steps_arr s LEFT JOIN analytics_events e ON e.event_name = s.step_event_name AND e.user_type = p_user_type AND e.created_at >= p_from AND e.created_at < p_to + interval '1 day' AND (e.user_id IS NOT NULL OR e.admin_user_id IS NOT NULL)
    GROUP BY s.step_index, s.step_event_name)
  SELECT * FROM step_counts ORDER BY step_index;
$$;

CREATE OR REPLACE FUNCTION analytics_get_inactive_users(p_days int DEFAULT 7) RETURNS TABLE (inactive_count bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH ever AS (SELECT count(DISTINCT user_id) AS c FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL),
  recent AS (SELECT count(DISTINCT user_id) AS c FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= (current_date - (p_days || ' days')::interval))
  SELECT greatest(0, (SELECT c FROM ever) - (SELECT c FROM recent)) AS inactive_count;
$$;

CREATE OR REPLACE FUNCTION analytics_get_churn(p_period1_end date DEFAULT (current_date - 7), p_period2_end date DEFAULT current_date)
RETURNS TABLE (period1_active bigint, period2_active bigint, churned bigint) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH p1 AS (SELECT count(DISTINCT user_id) AS c FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= p_period1_end - interval '7 days' AND created_at < p_period1_end),
  p2 AS (SELECT count(DISTINCT user_id) AS c FROM analytics_events WHERE user_type = 'app' AND user_id IS NOT NULL AND created_at >= p_period2_end - interval '7 days' AND created_at < p_period2_end),
  active_both AS (SELECT count(DISTINCT e1.user_id) AS c FROM analytics_events e1 JOIN analytics_events e2 ON e1.user_id = e2.user_id
    WHERE e1.user_type = 'app' AND e1.user_id IS NOT NULL AND e1.created_at >= p_period1_end - interval '7 days' AND e1.created_at < p_period1_end
    AND e2.user_type = 'app' AND e2.user_id IS NOT NULL AND e2.created_at >= p_period2_end - interval '7 days' AND e2.created_at < p_period2_end)
  SELECT (SELECT c FROM p1), (SELECT c FROM p2), (SELECT c FROM p1) - (SELECT c FROM active_both);
$$;

-- Optional: schedule daily aggregation (requires pg_cron; enable in Supabase Dashboard → Database → Extensions if needed)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'analytics-daily-aggregate',
    '5 0 * * *',
    'SELECT analytics_aggregate_daily(current_date - 1); SELECT analytics_aggregate_feature_usage(current_date - 1);'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available or already scheduled: %. Run analytics_aggregate_daily/analytics_aggregate_feature_usage manually or enable pg_cron.', SQLERRM;
END;
$$;
