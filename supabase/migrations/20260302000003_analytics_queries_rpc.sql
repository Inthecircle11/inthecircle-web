-- Analytics dashboard RPCs. Run against analytics_events / analytics_sessions / analytics_daily_aggregates.

-- DAU / WAU / MAU (app users, last 30 days)
CREATE OR REPLACE FUNCTION analytics_get_dau_wau_mau(p_days int DEFAULT 30)
RETURNS TABLE (
  date date,
  dau bigint,
  wau bigint,
  mau bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH daily AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS date,
      count(DISTINCT user_id) AS dau
    FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= (current_date - (p_days || ' days')::interval)
    GROUP BY 1
  ),
  wau_calc AS (
    SELECT
      d.date,
      d.dau,
      (SELECT count(DISTINCT e.user_id)
       FROM analytics_events e
       WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
         AND e.created_at >= d.date - interval '7 days'
         AND e.created_at < d.date + interval '1 day') AS wau
    FROM daily d
  ),
  mau_calc AS (
    SELECT
      w.date,
      w.dau,
      w.wau,
      (SELECT count(DISTINCT e.user_id)
       FROM analytics_events e
       WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
         AND e.created_at >= w.date - interval '30 days'
         AND e.created_at < w.date + interval '1 day') AS mau
    FROM wau_calc w
  )
  SELECT date, dau, wau, mau FROM mau_calc ORDER BY date DESC;
$$;

COMMENT ON FUNCTION analytics_get_dau_wau_mau(int) IS 'DAU/WAU/MAU for app users.';

-- Stickiness (DAU/MAU) for a given date
CREATE OR REPLACE FUNCTION analytics_get_stickiness(p_date date)
RETURNS TABLE (stickiness numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH dau AS (
    SELECT count(DISTINCT user_id)::numeric AS v
    FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= p_date AND created_at < p_date + interval '1 day'
  ),
  mau AS (
    SELECT count(DISTINCT user_id)::numeric AS v
    FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= p_date - interval '30 days' AND created_at < p_date + interval '1 day'
  )
  SELECT CASE WHEN (SELECT v FROM mau) > 0 THEN round(((SELECT v FROM dau) / (SELECT v FROM mau))::numeric, 4) ELSE 0 END AS stickiness;
$$;

-- Avg session duration (app, last N days)
CREATE OR REPLACE FUNCTION analytics_get_avg_session_duration(p_days int DEFAULT 7)
RETURNS TABLE (avg_seconds numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(round(avg(duration_seconds))::numeric, 0) AS avg_seconds
  FROM analytics_sessions
  WHERE user_type = 'app' AND ended_at IS NOT NULL
    AND ended_at >= (current_date - (p_days || ' days')::interval);
$$;

-- Sessions per user (app, last N days)
CREATE OR REPLACE FUNCTION analytics_get_sessions_per_user(p_days int DEFAULT 7)
RETURNS TABLE (sessions_per_user numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT count(*)::numeric AS total FROM analytics_sessions
    WHERE user_type = 'app' AND started_at >= (current_date - (p_days || ' days')::interval)
  ),
  u AS (
    SELECT count(DISTINCT user_id)::numeric AS total FROM analytics_sessions
    WHERE user_type = 'app' AND user_id IS NOT NULL AND started_at >= (current_date - (p_days || ' days')::interval)
  )
  SELECT CASE WHEN (SELECT total FROM u) > 0 THEN round(((SELECT total FROM s) / (SELECT total FROM u))::numeric, 2) ELSE 0 END AS sessions_per_user;
$$;

-- Most / least used features (app, last N days)
CREATE OR REPLACE FUNCTION analytics_get_feature_usage(p_days int DEFAULT 7, p_limit int DEFAULT 20)
RETURNS TABLE (
  feature_name text,
  event_name text,
  unique_users bigint,
  total_events bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    coalesce(feature_name, 'unknown') AS feature_name,
    event_name,
    count(DISTINCT user_id) AS unique_users,
    count(*) AS total_events
  FROM analytics_events
  WHERE user_type = 'app'
    AND created_at >= (current_date - (p_days || ' days')::interval)
  GROUP BY coalesce(feature_name, 'unknown'), event_name
  ORDER BY total_events DESC
  LIMIT p_limit;
$$;

-- Admin productivity: actions per admin (last N days)
CREATE OR REPLACE FUNCTION analytics_get_admin_productivity(p_days int DEFAULT 7)
RETURNS TABLE (
  admin_user_id uuid,
  event_count bigint,
  session_count bigint,
  unique_days bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    e.admin_user_id,
    count(*) AS event_count,
    count(DISTINCT e.session_id) AS session_count,
    count(DISTINCT (e.created_at AT TIME ZONE 'UTC')::date) AS unique_days
  FROM analytics_events e
  WHERE e.user_type = 'admin' AND e.admin_user_id IS NOT NULL
    AND e.created_at >= (current_date - (p_days || ' days')::interval)
  GROUP BY e.admin_user_id
  ORDER BY event_count DESC;
$$;

-- Time per admin tab (last N days)
CREATE OR REPLACE FUNCTION analytics_get_admin_tab_usage(p_days int DEFAULT 7)
RETURNS TABLE (
  feature_name text,
  event_count bigint,
  unique_admins bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    coalesce(feature_name, 'unknown') AS feature_name,
    count(*) AS event_count,
    count(DISTINCT admin_user_id) AS unique_admins
  FROM analytics_events
  WHERE user_type = 'admin'
    AND created_at >= (current_date - (p_days || ' days')::interval)
  GROUP BY coalesce(feature_name, 'unknown')
  ORDER BY event_count DESC;
$$;

-- Funnel drop-off: step counts for a funnel (by date range)
CREATE OR REPLACE FUNCTION analytics_get_funnel_steps(
  p_funnel_name text,
  p_user_type text,
  p_from date DEFAULT (current_date - 7),
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  step_index int,
  step_event_name text,
  unique_users bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH f AS (
    SELECT id, steps FROM analytics_funnels
    WHERE funnel_name = p_funnel_name AND user_type = p_user_type
    LIMIT 1
  ),
  steps_arr AS (
    SELECT t.step_event_name, t.step_index::int AS step_index
    FROM f
    CROSS JOIN LATERAL jsonb_array_elements_text(f.steps) WITH ORDINALITY AS t(step_event_name, step_index)
  ),
  step_counts AS (
    SELECT
      s.step_index::int,
      s.step_event_name,
      count(DISTINCT CASE WHEN e.user_id IS NOT NULL THEN e.user_id WHEN e.admin_user_id IS NOT NULL THEN e.admin_user_id END) AS unique_users
    FROM steps_arr s
    LEFT JOIN analytics_events e ON e.event_name = s.step_event_name
      AND e.user_type = p_user_type
      AND e.created_at >= p_from AND e.created_at < p_to + interval '1 day'
      AND (e.user_id IS NOT NULL OR e.admin_user_id IS NOT NULL)
    GROUP BY s.step_index, s.step_event_name
  )
  SELECT * FROM step_counts ORDER BY step_index;
$$;

-- Users inactive 7+ days (app users who had events before but none in last 7 days)
CREATE OR REPLACE FUNCTION analytics_get_inactive_users(p_days int DEFAULT 7)
RETURNS TABLE (inactive_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH ever AS (
    SELECT count(DISTINCT user_id) AS c FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
  ),
  recent AS (
    SELECT count(DISTINCT user_id) AS c FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= (current_date - (p_days || ' days')::interval)
  )
  SELECT greatest(0, (SELECT c FROM ever) - (SELECT c FROM recent)) AS inactive_count;
$$;

-- Churn: count of users who were active in period 1 but not in period 2
CREATE OR REPLACE FUNCTION analytics_get_churn(
  p_period1_end date DEFAULT (current_date - 7),
  p_period2_end date DEFAULT current_date
)
RETURNS TABLE (
  period1_active bigint,
  period2_active bigint,
  churned bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH p1 AS (
    SELECT count(DISTINCT user_id) AS c FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= p_period1_end - interval '7 days' AND created_at < p_period1_end
  ),
  p2 AS (
    SELECT count(DISTINCT user_id) AS c FROM analytics_events
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND created_at >= p_period2_end - interval '7 days' AND created_at < p_period2_end
  ),
  active_both AS (
    SELECT count(DISTINCT e1.user_id) AS c
    FROM analytics_events e1
    JOIN analytics_events e2 ON e1.user_id = e2.user_id
    WHERE e1.user_type = 'app' AND e1.user_id IS NOT NULL
      AND e1.created_at >= p_period1_end - interval '7 days' AND e1.created_at < p_period1_end
      AND e2.user_type = 'app' AND e2.user_id IS NOT NULL
      AND e2.created_at >= p_period2_end - interval '7 days' AND e2.created_at < p_period2_end
  )
  SELECT
    (SELECT c FROM p1),
    (SELECT c FROM p2),
    (SELECT c FROM p1) - (SELECT c FROM active_both);
$$;
