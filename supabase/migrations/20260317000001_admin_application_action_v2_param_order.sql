-- PostgREST/Supabase schema cache looks up functions by parameter order (alphabetical).
-- The client sends (p_action, p_application_id, p_updated_at); the old function had
-- (p_application_id, p_updated_at, p_action). Recreate with alphabetical param order
-- so RPC calls from the API route succeed.

DROP FUNCTION IF EXISTS public.admin_application_action_v2(uuid, timestamptz, text);

CREATE OR REPLACE FUNCTION public.admin_application_action_v2(
  p_action text,
  p_application_id uuid,
  p_updated_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_new_status text;
BEGIN
  v_new_status := CASE p_action
    WHEN 'approve' THEN 'ACTIVE'
    WHEN 'reject' THEN 'REJECTED'
    WHEN 'waitlist' THEN 'WAITLISTED'
    WHEN 'suspend' THEN 'SUSPENDED'
    ELSE NULL
  END;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Invalid action %', p_action;
  END IF;
  UPDATE applications
  SET status = v_new_status, updated_at = now()
  WHERE id = p_application_id AND updated_at = p_updated_at
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.admin_application_action_v2(text, uuid, timestamptz) IS 'Versioned application status update; returns id if row updated, NULL if conflict. Params in alphabetical order for PostgREST schema cache.';
