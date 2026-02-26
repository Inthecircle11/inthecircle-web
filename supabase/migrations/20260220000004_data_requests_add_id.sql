-- Ensure data_requests has a primary key id (required for admin Data Requests tab).
-- If the table exists without id, adds the column (existing rows get gen_random_uuid()).
-- If the table does not exist, create it with id.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_requests') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'data_requests' AND column_name = 'id') THEN
      ALTER TABLE data_requests ADD COLUMN id uuid DEFAULT gen_random_uuid() NOT NULL;
    END IF;
  ELSE
    CREATE TABLE data_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      request_type text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can insert own" ON data_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can read own" ON data_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
