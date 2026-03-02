-- Drop admin RPCs that were replaced by API routes (no client/server usage).
-- Safe: IF EXISTS. Run after deploying API routes that implement the logic.

DROP FUNCTION IF EXISTS public.admin_set_verification(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_set_banned(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
DROP FUNCTION IF EXISTS public.admin_approve_application(uuid);
DROP FUNCTION IF EXISTS public.admin_reject_application(uuid);
DROP FUNCTION IF EXISTS public.admin_waitlist_application(uuid);
DROP FUNCTION IF EXISTS public.admin_suspend_application(uuid);
