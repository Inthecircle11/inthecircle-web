-- Repair audit chain: re-compute previous_hash and row_hash for all rows (created_at order).
-- Call via supabase.rpc('admin_repair_audit_chain') or POST /api/admin/audit/repair-chain.
CREATE OR REPLACE FUNCTION public.admin_repair_audit_chain()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  prev text := NULL;
  payload text;
  new_hash text;
  updated_count int := 0;
BEGIN
  FOR r IN SELECT id, admin_user_id, action, target_type, target_id, details, created_at
            FROM admin_audit_log
            ORDER BY created_at ASC
  LOOP
    payload := concat_ws('|',
      r.id::text,
      coalesce(r.admin_user_id::text, ''),
      coalesce(r.action, ''),
      coalesce(r.target_type, ''),
      coalesce(r.target_id, ''),
      coalesce(r.details::text, '{}'),
      coalesce(r.created_at::text, ''),
      coalesce(prev, '')
    );
    new_hash := encode(extensions.digest(payload::bytea, 'sha256'), 'hex');
    UPDATE admin_audit_log
    SET previous_hash = prev, row_hash = new_hash
    WHERE id = r.id;
    prev := new_hash;
    updated_count := updated_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'rows_updated', updated_count);
END;
$$;

COMMENT ON FUNCTION public.admin_repair_audit_chain() IS 'Recomputes previous_hash and row_hash for admin_audit_log (created_at order). Use when chain is broken.';
