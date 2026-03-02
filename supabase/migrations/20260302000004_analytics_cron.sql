-- Schedule daily analytics aggregation (requires pg_cron extension).
-- Enable pg_cron in Supabase Dashboard → Database → Extensions if not already enabled.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run daily at 00:05 UTC for the previous day
SELECT cron.schedule(
  'analytics-daily-aggregate',
  '5 0 * * *',
  $$
  SELECT analytics_aggregate_daily(current_date - 1);
  SELECT analytics_aggregate_feature_usage(current_date - 1);
  $$
);
