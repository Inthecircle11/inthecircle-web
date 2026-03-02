-- =============================================================================
-- Automated Product Insight Engine. Analyzes existing data via existing RPCs.
-- No schema or ingestion changes. Safe at 20K DAU. Cached 60s in overview API.
--
-- Thresholds (explainable, deterministic):
--   Funnel: conversion_rate_from_previous_step < 40% → flag (high if < 25%, else medium).
--   Feature adoption: unique_users/DAU; < 10% → LOW adoption, > 60% → CORE feature.
--   Retention: D1 < 30% → weak activation; D7 < 15% → weak retention.
--   Churn: current period churn rate > 20% higher than previous period → spike.
--   Admin: actions per admin per day; < 50% of avg → low activity, > 200% → top performer.
--
-- Priority score: funnel severity (1–3), retention gap, adoption gap; top_insights = first 3 by severity then score.
-- =============================================================================

CREATE OR REPLACE FUNCTION analytics_generate_insights(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  p_from date := (current_date - p_days);
  p_to date := current_date;
  v_dau bigint := 0;
  v_insights jsonb := '[]'::jsonb;
  v_funnel_app record;
  v_funnel_admin record;
  v_conv numeric;
  v_feat record;
  v_adoption_pct numeric;
  v_ret_d1_pct numeric;
  v_ret_d7_pct numeric;
  v_churn_cur record;
  v_churn_prev record;
  v_churn_cur_rate numeric;
  v_churn_prev_rate numeric;
  v_admin record;
  v_admin_avg_events_per_day numeric := 0;
  v_admin_total_days bigint := 0;
  v_ratio numeric;
  v_priority numeric;
  v_severity text;
  v_insight jsonb;
BEGIN
  -- ---------------------------------------------------------------------------
  -- DAU (latest day) for adoption denominator. Reuse existing RPC.
  -- ---------------------------------------------------------------------------
  SELECT dau INTO v_dau
  FROM analytics_get_dau_wau_mau(p_days) AS t(d date, dau bigint, wau bigint, mau bigint)
  ORDER BY d DESC NULLS LAST
  LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 1) Funnel drop-off: conversion_rate_from_previous_step < 40% → HIGH
  -- ---------------------------------------------------------------------------
  FOR v_funnel_app IN
    SELECT step_index, step_event_name, unique_users, conversion_rate_from_previous_step
    FROM analytics_get_funnel_steps('App Activation', 'app', p_from, p_to)
  LOOP
    v_conv := v_funnel_app.conversion_rate_from_previous_step;
    IF v_conv IS NOT NULL AND v_conv < 0.40 THEN
      IF v_conv < 0.25 THEN v_severity := 'high'; ELSIF v_conv < 0.40 THEN v_severity := 'medium'; ELSE v_severity := 'low'; END IF;
      v_insight := jsonb_build_object(
        'type', 'funnel',
        'severity', v_severity,
        'title', 'App Activation: high drop-off at step ' || v_funnel_app.step_index,
        'description', 'Step "' || v_funnel_app.step_event_name || '" converts at ' || round((v_conv * 100)::numeric, 1) || '% from previous (threshold 40%).',
        'metric_value', v_conv,
        'comparison_value', 0.40,
        'recommendation', 'Review friction at this step: UX, copy, or required actions.',
        'priority_score', CASE WHEN v_severity = 'high' THEN 3.0 WHEN v_severity = 'medium' THEN 2.0 ELSE 1.0 END
      );
      v_insights := v_insights || v_insight;
    END IF;
  END LOOP;

  FOR v_funnel_admin IN
    SELECT step_index, step_event_name, unique_users, conversion_rate_from_previous_step
    FROM analytics_get_funnel_steps('Admin Review', 'admin', p_from, p_to)
  LOOP
    v_conv := v_funnel_admin.conversion_rate_from_previous_step;
    IF v_conv IS NOT NULL AND v_conv < 0.40 THEN
      IF v_conv < 0.25 THEN v_severity := 'high'; ELSIF v_conv < 0.40 THEN v_severity := 'medium'; ELSE v_severity := 'low'; END IF;
      v_insight := jsonb_build_object(
        'type', 'funnel',
        'severity', v_severity,
        'title', 'Admin Review: high drop-off at step ' || v_funnel_admin.step_index,
        'description', 'Step "' || v_funnel_admin.step_event_name || '" converts at ' || round((v_conv * 100)::numeric, 1) || '% from previous (threshold 40%).',
        'metric_value', v_conv,
        'comparison_value', 0.40,
        'recommendation', 'Simplify admin workflow or add guidance for this step.',
        'priority_score', CASE WHEN v_severity = 'high' THEN 3.0 WHEN v_severity = 'medium' THEN 2.0 ELSE 1.0 END
      );
      v_insights := v_insights || v_insight;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 2) Feature adoption: unique_users/DAU. < 10% LOW, > 60% CORE (informational)
  -- ---------------------------------------------------------------------------
  IF v_dau > 0 THEN
    FOR v_feat IN
      SELECT feature_name, event_name, unique_users
      FROM analytics_get_feature_usage(p_days, 25)
    LOOP
      v_adoption_pct := (v_feat.unique_users::numeric / v_dau);
      IF v_adoption_pct < 0.10 THEN
        v_insight := jsonb_build_object(
          'type', 'feature',
          'severity', 'low',
          'title', 'Low adoption: ' || coalesce(v_feat.feature_name, 'unknown') || ' / ' || v_feat.event_name,
          'description', round((v_adoption_pct * 100)::numeric, 1) || '% of DAU used this (threshold 10%).',
          'metric_value', v_adoption_pct,
          'comparison_value', 0.10,
          'recommendation', 'Consider in-app prompts, onboarding, or placement to increase discovery.',
          'priority_score', (0.10 - v_adoption_pct)
        );
        v_insights := v_insights || v_insight;
      ELSIF v_adoption_pct > 0.60 THEN
        v_insight := jsonb_build_object(
          'type', 'feature',
          'severity', 'low',
          'title', 'Core feature: ' || coalesce(v_feat.feature_name, 'unknown') || ' / ' || v_feat.event_name,
          'description', round((v_adoption_pct * 100)::numeric, 1) || '% of DAU — key driver of engagement.',
          'metric_value', v_adoption_pct,
          'comparison_value', 0.60,
          'recommendation', 'Protect and invest in this experience; avoid breaking changes.',
          'priority_score', 0.0
        );
        v_insights := v_insights || v_insight;
      END IF;
    END LOOP;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3) Retention: D1 < 30% weak activation, D7 < 15% weak retention
  --    From analytics_retention_cohorts (small table, cohort_date in range).
  -- ---------------------------------------------------------------------------
  SELECT
    coalesce(avg(CASE WHEN cohort_size > 0 THEN d1_retained::numeric / cohort_size ELSE 0 END), 0),
    coalesce(avg(CASE WHEN cohort_size > 0 THEN d7_retained::numeric / cohort_size ELSE 0 END), 0)
  INTO v_ret_d1_pct, v_ret_d7_pct
  FROM (
    SELECT
      cohort_date,
      count(*) AS cohort_size,
      sum(CASE WHEN retained_d1 THEN 1 ELSE 0 END)::int AS d1_retained,
      sum(CASE WHEN retained_d7 THEN 1 ELSE 0 END)::int AS d7_retained
    FROM analytics_retention_cohorts
    WHERE user_type = 'app' AND user_id IS NOT NULL
      AND cohort_date >= p_from AND cohort_date <= p_to - 7
    GROUP BY cohort_date
  ) sub;

  IF v_ret_d1_pct < 0.30 AND v_ret_d1_pct > 0 THEN
    v_insight := jsonb_build_object(
      'type', 'retention',
      'severity', CASE WHEN v_ret_d1_pct < 0.15 THEN 'high' WHEN v_ret_d1_pct < 0.30 THEN 'medium' ELSE 'low' END,
      'title', 'Weak D1 activation',
      'description', 'D1 retention is ' || round((v_ret_d1_pct * 100)::numeric, 1) || '% (target 30%).',
      'metric_value', v_ret_d1_pct,
      'comparison_value', 0.30,
      'recommendation', 'Improve first-session value: onboarding, aha moment, or reduced friction.',
      'priority_score', (0.30 - v_ret_d1_pct) * 2.0
    );
    v_insights := v_insights || v_insight;
  END IF;

  IF v_ret_d7_pct < 0.15 AND v_ret_d7_pct > 0 THEN
    v_insight := jsonb_build_object(
      'type', 'retention',
      'severity', CASE WHEN v_ret_d7_pct < 0.08 THEN 'high' WHEN v_ret_d7_pct < 0.15 THEN 'medium' ELSE 'low' END,
      'title', 'Weak D7 retention',
      'description', 'D7 retention is ' || round((v_ret_d7_pct * 100)::numeric, 1) || '% (target 15%).',
      'metric_value', v_ret_d7_pct,
      'comparison_value', 0.15,
      'recommendation', 'Add habit-forming triggers: notifications, email, or recurring value.',
      'priority_score', (0.15 - v_ret_d7_pct) * 2.0
    );
    v_insights := v_insights || v_insight;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4) Churn spike: current period churn rate > 20% vs previous period
  -- ---------------------------------------------------------------------------
  SELECT period1_active, period2_active, churned INTO v_churn_cur
  FROM analytics_get_churn(p_to - 7, p_to)
  LIMIT 1;

  SELECT period1_active, period2_active, churned INTO v_churn_prev
  FROM analytics_get_churn(p_to - 14, p_to - 7)
  LIMIT 1;

  v_churn_cur_rate := CASE WHEN (v_churn_cur.period1_active) > 0 THEN v_churn_cur.churned::numeric / v_churn_cur.period1_active ELSE 0 END;
  v_churn_prev_rate := CASE WHEN (v_churn_prev.period1_active) > 0 THEN v_churn_prev.churned::numeric / v_churn_prev.period1_active ELSE 0 END;

  IF v_churn_prev_rate > 0 AND v_churn_cur_rate > (v_churn_prev_rate * 1.20) THEN
    v_insight := jsonb_build_object(
      'type', 'churn',
      'severity', CASE WHEN v_churn_cur_rate > v_churn_prev_rate * 1.5 THEN 'high' ELSE 'medium' END,
      'title', 'Churn rate spike',
      'description', 'Churn rate increased to ' || round((v_churn_cur_rate * 100)::numeric, 1) || '% (was ' || round((v_churn_prev_rate * 100)::numeric, 1) || '%).',
      'metric_value', v_churn_cur_rate,
      'comparison_value', v_churn_prev_rate,
      'recommendation', 'Investigate recent changes, reach out to at-risk segments, or run win-back campaign.',
      'priority_score', (v_churn_cur_rate - v_churn_prev_rate) * 2.0
    );
    v_insights := v_insights || v_insight;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5) Admin efficiency: avg actions per admin per day; flag < 50% or > 200%
  -- ---------------------------------------------------------------------------
  SELECT sum(event_count)::numeric, sum(unique_days)::bigint
  INTO v_admin_avg_events_per_day, v_admin_total_days
  FROM (SELECT event_count, unique_days FROM analytics_get_admin_productivity(p_days)) t;

  IF v_admin_total_days > 0 THEN
    v_admin_avg_events_per_day := v_admin_avg_events_per_day / v_admin_total_days;
    FOR v_admin IN
      SELECT admin_user_id, event_count, unique_days
      FROM analytics_get_admin_productivity(p_days)
    LOOP
      IF v_admin.unique_days > 0 THEN
        v_ratio := (v_admin.event_count::numeric / v_admin.unique_days) / NULLIF(v_admin_avg_events_per_day, 0);
        IF v_ratio < 0.50 THEN
          v_insight := jsonb_build_object(
            'type', 'admin',
            'severity', 'medium',
            'title', 'Low admin activity',
            'description', 'Admin ' || left(v_admin.admin_user_id::text, 8) || '… at ' || round((v_ratio * 100)::numeric, 0) || '% of avg actions/day.',
            'metric_value', v_ratio,
            'comparison_value', 0.50,
            'recommendation', 'Check capacity, training, or access; consider rebalancing workload.',
            'priority_score', (0.50 - v_ratio)
          );
          v_insights := v_insights || v_insight;
        ELSIF v_ratio > 2.00 THEN
          v_insight := jsonb_build_object(
            'type', 'admin',
            'severity', 'low',
            'title', 'Top performer',
            'description', 'Admin ' || left(v_admin.admin_user_id::text, 8) || '… at ' || round((v_ratio * 100)::numeric, 0) || '% of avg actions/day.',
            'metric_value', v_ratio,
            'comparison_value', 2.00,
            'recommendation', 'Recognize and optionally use as reference for best practices.',
            'priority_score', 0.0
          );
          v_insights := v_insights || v_insight;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Priority: sort by severity (high first) then priority_score desc; top_insights = first 3
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'insights', (
      SELECT coalesce(jsonb_agg(elem ORDER BY array_position(ARRAY['high','medium','low']::text[], elem->>'severity'), (elem->>'priority_score')::numeric DESC NULLS LAST), '[]'::jsonb)
      FROM jsonb_array_elements(v_insights) AS elem
    ),
    'top_insights', (
      SELECT coalesce(jsonb_agg(sub.elem), '[]'::jsonb)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_insights) AS elem
        ORDER BY array_position(ARRAY['high','medium','low']::text[], elem->>'severity'), (elem->>'priority_score')::numeric DESC NULLS LAST
        LIMIT 3
      ) sub(elem)
    )
  );
END;
$$;

COMMENT ON FUNCTION analytics_generate_insights(integer) IS 'Automated product insights from existing RPCs. Thresholds: funnel <40%, adoption <10% low >60% core, D1<30% D7<15%, churn +20%, admin <50% or >200% of avg. Returns { insights, top_insights } with priority_score.';
