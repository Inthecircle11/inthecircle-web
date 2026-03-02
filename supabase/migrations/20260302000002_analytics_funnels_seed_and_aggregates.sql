-- Seed default funnels and aggregation helpers.
-- Funnel steps are ordered event names.

INSERT INTO analytics_funnels (funnel_name, user_type, steps, description) VALUES
  (
    'App Activation',
    'app',
    '["signup_completed", "onboarding_completed", "first_core_action", "return_within_7d"]'::jsonb,
    'Signup → Onboarding → First Core Action → Return within 7 days'
  ),
  (
    'Admin Review',
    'admin',
    '["admin_login", "admin_tab_opened", "admin_action_performed", "admin_application_reviewed"]'::jsonb,
    'Login → Open tab → Perform action → Review application'
  )
ON CONFLICT (funnel_name, user_type) DO UPDATE SET
  steps = EXCLUDED.steps,
  description = EXCLUDED.description;

-- RPC: Aggregate daily metrics (run daily via cron)
CREATE OR REPLACE FUNCTION analytics_aggregate_daily(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DAU app
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'dau', count(DISTINCT user_id)::numeric, '{}'::jsonb
  FROM analytics_events
  WHERE user_type = 'app' AND created_at >= p_date AND created_at < p_date + interval '1 day'
    AND user_id IS NOT NULL
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- DAU admin
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'dau', count(DISTINCT admin_user_id)::numeric, '{}'::jsonb
  FROM analytics_events
  WHERE user_type = 'admin' AND created_at >= p_date AND created_at < p_date + interval '1 day'
    AND admin_user_id IS NOT NULL
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- Session count app
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'sessions', count(*)::numeric, '{}'::jsonb
  FROM analytics_sessions
  WHERE user_type = 'app' AND started_at >= p_date AND started_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- Session count admin
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'sessions', count(*)::numeric, '{}'::jsonb
  FROM analytics_sessions
  WHERE user_type = 'admin' AND started_at >= p_date AND started_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- Avg session duration app (from sessions that ended that day)
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'avg_session_duration_seconds', coalesce(avg(duration_seconds), 0)::numeric, '{}'::jsonb
  FROM analytics_sessions
  WHERE user_type = 'app' AND ended_at IS NOT NULL
    AND ended_at >= p_date AND ended_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- Events per day app
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'app', 'events_total', count(*)::numeric, '{}'::jsonb
  FROM analytics_events
  WHERE user_type = 'app' AND created_at >= p_date AND created_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;

  -- Events per day admin
  INSERT INTO analytics_daily_aggregates (date, user_type, metric_name, metric_value, dimensions)
  SELECT p_date, 'admin', 'events_total', count(*)::numeric, '{}'::jsonb
  FROM analytics_events
  WHERE user_type = 'admin' AND created_at >= p_date AND created_at < p_date + interval '1 day'
  ON CONFLICT (date, user_type, metric_name, dimensions) DO UPDATE SET metric_value = EXCLUDED.metric_value;
END;
$$;

COMMENT ON FUNCTION analytics_aggregate_daily(date) IS 'Pre-aggregate daily metrics. Run once per day (e.g. cron).';

-- Feature usage aggregation (daily, per feature/event)
CREATE OR REPLACE FUNCTION analytics_aggregate_feature_usage(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO analytics_feature_usage (date, user_type, feature_name, event_name, unique_users, total_events)
  SELECT
    p_date,
    user_type,
    coalesce(feature_name, 'unknown'),
    event_name,
    count(DISTINCT coalesce(user_id, admin_user_id)),
    count(*)
  FROM analytics_events
  WHERE created_at >= p_date AND created_at < p_date + interval '1 day'
  GROUP BY p_date, user_type, coalesce(feature_name, 'unknown'), event_name
  ON CONFLICT (date, user_type, feature_name, event_name) DO UPDATE SET
    unique_users = EXCLUDED.unique_users,
    total_events = EXCLUDED.total_events;
END;
$$;

COMMENT ON FUNCTION analytics_aggregate_feature_usage(date) IS 'Aggregate feature usage by day. Run after analytics_aggregate_daily.';
