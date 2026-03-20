-- application_status_audit_log: allow NULL admin_id when status change is made via API (service role).
-- The trigger on applications inserts into this table; when using service role from Next.js there is no
-- auth.uid(), so the insert was failing with application_status_audit_log_admin_id_fkey.
-- Making admin_id nullable allows the trigger to succeed; the main admin_audit_log still records
-- who performed the action when the API passes the admin user id and writes to admin_audit_log.

ALTER TABLE application_status_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

COMMENT ON COLUMN application_status_audit_log.admin_id IS 'Admin who changed the status; NULL when change was made via API/service role (see admin_audit_log for actor).';
