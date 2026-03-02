-- =============================================================================
-- Cron: retention (daily) + orphan session cleanup (every 6 hours).
-- Requires pg_cron enabled. Run after 20260302100003.
-- =============================================================================

-- Retention: run for previous day (e.g. after daily aggregate).
SELECT cron.schedule(
  'analytics-compute-retention',
  '15 0 * * *',
  'SELECT analytics_compute_retention(current_date - 1);'
);

-- Orphan sessions: close stale sessions every 6 hours.
SELECT cron.schedule(
  'analytics-close-orphan-sessions',
  '0 */6 * * *',
  'SELECT analytics_close_orphan_sessions();'
);
