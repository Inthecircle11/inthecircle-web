-- =============================================================================
-- SECTION 2: True ordered funnel (session-level) + drop unused analytics_funnel_events.
-- SECTION 4: Orphan session cleanup RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a) Replace analytics_get_funnel_steps with ordered conversion logic.
--     Return type changes (add conversion_rate_from_previous_step) so DROP first.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS analytics_get_funnel_steps(text, text, date, date);

CREATE OR REPLACE FUNCTION analytics_get_funnel_steps(
  p_funnel_name text,
  p_user_type text,
  p_from date DEFAULT (current_date - 7),
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  step_index int,
  step_event_name text,
  unique_users bigint,
  conversion_rate_from_previous_step numeric
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
    SELECT t.step_event_name::text, (t.step_index)::int AS step_index
    FROM f
    CROSS JOIN LATERAL jsonb_array_elements_text(f.steps) WITH ORDINALITY AS t(step_event_name, step_index)
  ),
  first_seen AS (
    SELECT
      (CASE WHEN p_user_type = 'app' THEN e.user_id ELSE e.admin_user_id END) AS user_uid,
      s.step_index,
      s.step_event_name,
      min(e.created_at) AS first_at
    FROM steps_arr s
    JOIN analytics_events e ON e.event_name = s.step_event_name
      AND e.user_type = p_user_type
      AND e.created_at >= p_from AND e.created_at < p_to + interval '1 day'
      AND (e.user_id IS NOT NULL OR e.admin_user_id IS NOT NULL)
    GROUP BY (CASE WHEN p_user_type = 'app' THEN e.user_id ELSE e.admin_user_id END), s.step_index, s.step_event_name
  ),
  with_prev AS (
    SELECT
      step_index,
      step_event_name,
      user_uid,
      first_at,
      lag(first_at) OVER (PARTITION BY user_uid ORDER BY step_index) AS prev_first_at
    FROM first_seen
  ),
  converted AS (
    SELECT step_index, step_event_name, user_uid
    FROM with_prev
    WHERE prev_first_at IS NULL OR first_at > prev_first_at
  ),
  step_counts AS (
    SELECT step_index, step_event_name, count(DISTINCT user_uid)::bigint AS unique_users
    FROM converted
    GROUP BY step_index, step_event_name
  ),
  with_prev_count AS (
    SELECT
      s.step_index,
      s.step_event_name,
      s.unique_users,
      lag(s.unique_users) OVER (ORDER BY s.step_index) AS prev_step_users
    FROM step_counts s
  )
  SELECT
    step_index,
    step_event_name,
    unique_users,
    CASE
      WHEN prev_step_users IS NULL OR prev_step_users = 0 THEN NULL
      ELSE round((unique_users::numeric / prev_step_users), 4)
    END AS conversion_rate_from_previous_step
  FROM with_prev_count
  ORDER BY step_index;
$$;

COMMENT ON FUNCTION analytics_get_funnel_steps(text, text, date, date) IS 'Ordered funnel: step N counts only users who did step N after step N-1 in the date window.';

-- -----------------------------------------------------------------------------
-- 2b) Drop unused analytics_funnel_events (never populated; funnel uses analytics_events).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role only analytics_funnel_events" ON analytics_funnel_events;
DROP TABLE IF EXISTS analytics_funnel_events;

-- -----------------------------------------------------------------------------
-- SECTION 4: Orphan session cleanup — close sessions with no activity for 30+ min.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_close_orphan_sessions()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
  v_cutoff timestamptz := now() - interval '30 minutes';
BEGIN
  UPDATE analytics_sessions
  SET
    ended_at = last_activity_at,
    duration_seconds = EXTRACT(epoch FROM (last_activity_at - started_at))::int
  WHERE ended_at IS NULL
    AND last_activity_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION analytics_close_orphan_sessions() IS 'Close sessions with last_activity_at older than 30 minutes. Run every 6 hours via cron.';
