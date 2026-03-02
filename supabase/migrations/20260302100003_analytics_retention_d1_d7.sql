-- =============================================================================
-- SECTION 3: Retention (D1 + D7 only). Cohort = first_core_action or signup_completed date.
-- D1 = active 1 day after cohort date; D7 = active 7 days after cohort date.
-- =============================================================================

CREATE OR REPLACE FUNCTION analytics_compute_retention(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date := p_date;
BEGIN
  WITH cohort_users AS (
    SELECT DISTINCT e.user_id AS uid
    FROM analytics_events e
    WHERE e.user_type = 'app'
      AND e.user_id IS NOT NULL
      AND e.event_name IN ('signup_completed', 'first_core_action')
      AND (e.created_at AT TIME ZONE 'UTC')::date = v_date
  ),
  d1_active AS (
    SELECT c.uid FROM cohort_users c
    WHERE EXISTS (
      SELECT 1 FROM analytics_events e
      WHERE e.user_id = c.uid AND e.user_type = 'app'
        AND (e.created_at AT TIME ZONE 'UTC')::date = v_date + 1
    )
  ),
  d7_active AS (
    SELECT c.uid FROM cohort_users c
    WHERE EXISTS (
      SELECT 1 FROM analytics_events e
      WHERE e.user_id = c.uid AND e.user_type = 'app'
        AND (e.created_at AT TIME ZONE 'UTC')::date = v_date + 7
    )
  ),
  upsert_data AS (
    SELECT
      c.uid AS user_id,
      EXISTS (SELECT 1 FROM d1_active d WHERE d.uid = c.uid) AS retained_d1,
      EXISTS (SELECT 1 FROM d7_active d WHERE d.uid = c.uid) AS retained_d7
    FROM cohort_users c
  )
  INSERT INTO analytics_retention_cohorts (
    user_id, admin_user_id, user_type, cohort_date, cohort_type,
    retained_d1, retained_d7, retained_d30, retained_w1, retained_w2, retained_w4,
    created_at, updated_at
  )
  SELECT
    u.user_id,
    NULL,
    'app',
    v_date,
    'first_action',
    u.retained_d1,
    u.retained_d7,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now()
  FROM upsert_data u
  ON CONFLICT (user_id, cohort_date, cohort_type) WHERE user_type = 'app' AND user_id IS NOT NULL
  DO UPDATE SET
    retained_d1 = EXCLUDED.retained_d1,
    retained_d7 = EXCLUDED.retained_d7,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION analytics_compute_retention(date) IS 'Compute D1/D7 retention for cohort_date. Run daily: SELECT analytics_compute_retention(current_date - 1);';
