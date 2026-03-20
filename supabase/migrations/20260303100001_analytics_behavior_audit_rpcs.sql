-- =============================================================================
-- Behavior Intelligence Audit: activation candidates + retention drivers.
-- Used by scripts/behavior-intelligence-audit.mjs to produce the audit report.
-- =============================================================================

-- Activation: for each candidate event, % users reaching it and D1 retention.
CREATE OR REPLACE FUNCTION analytics_behavior_audit_activation(p_days int DEFAULT 30)
RETURNS TABLE (
  event_name text,
  users_reached bigint,
  pct_of_all_users numeric,
  d1_retained_count bigint,
  d1_retention_pct numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH window_start AS (
    SELECT (current_date - (p_days || ' days')::interval) AS w_start
  ),
  all_app_users AS (
    SELECT count(DISTINCT e.user_id)::bigint AS total
    FROM analytics_events e, window_start
    WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
      AND e.created_at >= (SELECT w_start FROM window_start)
  ),
  candidates AS (
    SELECT unnest(ARRAY[
      'signup_completed', 'onboarding_completed', 'first_core_action',
      'feature_clicked', 'feature_viewed', 'form_completed', 'return_visit'
    ]) AS ev
  ),
  first_occurrence AS (
    SELECT
      e.event_name,
      e.user_id,
      min((e.created_at AT TIME ZONE 'UTC')::date) AS cohort_date
    FROM analytics_events e, window_start
    WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
      AND e.created_at >= (SELECT w_start FROM window_start)
      AND e.event_name IN (SELECT ev FROM candidates)
    GROUP BY e.event_name, e.user_id
  ),
  reached AS (
    SELECT event_name, count(DISTINCT user_id)::bigint AS users_reached
    FROM first_occurrence
    GROUP BY event_name
  ),
  d1_active AS (
    SELECT fo.event_name, fo.user_id
    FROM first_occurrence fo
    WHERE EXISTS (
      SELECT 1 FROM analytics_events e2
      WHERE e2.user_id = fo.user_id AND e2.user_type = 'app'
        AND (e2.created_at AT TIME ZONE 'UTC')::date = fo.cohort_date + 1
    )
  ),
  d1_counts AS (
    SELECT event_name, count(*)::bigint AS d1_retained_count
    FROM d1_active
    GROUP BY event_name
  )
  SELECT
    r.event_name,
    r.users_reached,
    round((r.users_reached::numeric / NULLIF((SELECT total FROM all_app_users), 0)) * 100, 2),
    coalesce(d.d1_retained_count, 0),
    round((coalesce(d.d1_retained_count, 0)::numeric / NULLIF(r.users_reached, 0)) * 100, 2)
  FROM reached r
  LEFT JOIN d1_counts d ON d.event_name = r.event_name
  ORDER BY (coalesce(d.d1_retained_count, 0)::numeric / NULLIF(r.users_reached, 0)) DESC NULLS LAST;
$$;

COMMENT ON FUNCTION analytics_behavior_audit_activation(integer) IS 'Behavior audit: activation candidates with % reach and D1 retention.';

-- Retention drivers: events/features more common in D7 retained vs churned users.
CREATE OR REPLACE FUNCTION analytics_behavior_audit_retention_drivers(p_days int DEFAULT 14)
RETURNS TABLE (
  event_name text,
  feature_name text,
  retained_users_with bigint,
  churned_users_with bigint,
  pct_retained numeric,
  pct_churned numeric,
  retention_lift numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH window_end AS (
    SELECT current_date AS today
  ),
  retained_users AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e, window_end
    WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
      AND e.created_at >= (SELECT today FROM window_end) - interval '7 days'
      AND e.created_at < (SELECT today FROM window_end) + interval '1 day'
  ),
  churned_users AS (
    SELECT DISTINCT e.user_id
    FROM analytics_events e, window_end
    WHERE e.user_type = 'app' AND e.user_id IS NOT NULL
      AND e.created_at >= (SELECT today FROM window_end) - interval '14 days'
      AND e.created_at < (SELECT today FROM window_end) - interval '7 days'
      AND e.user_id NOT IN (SELECT user_id FROM retained_users)
  ),
  r_tot AS (SELECT count(*)::bigint AS n FROM retained_users),
  c_tot AS (SELECT count(*)::bigint AS n FROM churned_users),
  event_retained AS (
    SELECT e.event_name, coalesce(e.feature_name, 'unknown') AS feature_name,
           count(DISTINCT e.user_id)::bigint AS cnt
    FROM analytics_events e
    JOIN retained_users r ON r.user_id = e.user_id
    WHERE e.user_type = 'app' AND e.created_at >= (SELECT today FROM window_end) - interval '7 days'
    GROUP BY e.event_name, coalesce(e.feature_name, 'unknown')
  ),
  event_churned AS (
    SELECT e.event_name, coalesce(e.feature_name, 'unknown') AS feature_name,
           count(DISTINCT e.user_id)::bigint AS cnt
    FROM analytics_events e
    JOIN churned_users c ON c.user_id = e.user_id
    WHERE e.user_type = 'app'
      AND e.created_at >= (SELECT today FROM window_end) - interval '14 days'
      AND e.created_at < (SELECT today FROM window_end) - interval '7 days'
    GROUP BY e.event_name, coalesce(e.feature_name, 'unknown')
  )
  SELECT
    er.event_name,
    er.feature_name,
    er.cnt AS retained_users_with,
    coalesce(ec.cnt, 0) AS churned_users_with,
    round((er.cnt::numeric / NULLIF((SELECT n FROM r_tot), 0)) * 100, 2),
    round((coalesce(ec.cnt, 0)::numeric / NULLIF((SELECT n FROM c_tot), 0)) * 100, 2),
    round(
      (er.cnt::numeric / NULLIF((SELECT n FROM r_tot), 0)) -
      (coalesce(ec.cnt, 0)::numeric / NULLIF((SELECT n FROM c_tot), 0)),
      4
    )
  FROM event_retained er
  LEFT JOIN event_churned ec ON ec.event_name = er.event_name AND ec.feature_name = er.feature_name
  ORDER BY (er.cnt::numeric / NULLIF((SELECT n FROM r_tot), 0)) -
            (coalesce(ec.cnt, 0)::numeric / NULLIF((SELECT n FROM c_tot), 0)) DESC NULLS LAST
  LIMIT 50;
$$;

COMMENT ON FUNCTION analytics_behavior_audit_retention_drivers(integer) IS 'Behavior audit: events/features more common in D7 retained vs churned users.';
