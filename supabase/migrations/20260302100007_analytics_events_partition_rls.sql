-- Fix Supabase linter: "RLS Enabled No Policy" on analytics_events partition tables.
-- Partitions inherit RLS from the parent but the linter flags them when they have no
-- policy of their own. Add the same service_role policy to each partition.

DO $$
DECLARE
  part regclass;
BEGIN
  FOR part IN
    SELECT inhrelid
    FROM pg_inherits
    WHERE inhparent = 'public.analytics_events'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Service role only analytics_events" ON %s',
      part
    );
    EXECUTE format(
      'CREATE POLICY "Service role only analytics_events" ON %s FOR ALL TO service_role USING (true) WITH CHECK (true)',
      part
    );
  END LOOP;
END $$;
