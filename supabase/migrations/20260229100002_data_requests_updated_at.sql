-- C3 stabilization: add updated_at to data_requests for optimistic locking on PATCH.
-- Enables conflict-safe status updates (409 when row was changed by another admin).
-- Backward compatible: column has default so existing rows and inserts are fine.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_requests') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'data_requests' AND column_name = 'updated_at') THEN
      ALTER TABLE data_requests ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
      CREATE INDEX IF NOT EXISTS idx_data_requests_updated_at ON data_requests (updated_at);
    END IF;
  END IF;
END $$;
