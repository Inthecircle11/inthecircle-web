-- Fix RLS linter: auth_rls_initplan + multiple_permissive_policies
-- See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- 1. user_reports: use (select auth.uid()) so it's not re-evaluated per row
DROP POLICY IF EXISTS "Users can insert own reports" ON public.user_reports;
DROP POLICY IF EXISTS "Users can read own reports" ON public.user_reports;

CREATE POLICY "Users can insert own reports" ON public.user_reports
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = reporter_id);

CREATE POLICY "Users can read own reports" ON public.user_reports
  FOR SELECT TO authenticated USING ((select auth.uid()) = reporter_id);

-- 2. admin_audit_log: single permissive policy per (role, action)
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Only admin can read audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Only admin can insert audit log" ON public.admin_audit_log;

CREATE POLICY "Authenticated can read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit log" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. app_config: single permissive policy (one policy for all actions)
DROP POLICY IF EXISTS "Allow read app_config" ON public.app_config;
DROP POLICY IF EXISTS "Allow insert and update for authenticated" ON public.app_config;
DROP POLICY IF EXISTS "Authenticated can read app_config" ON public.app_config;

CREATE POLICY "Authenticated full access app_config" ON public.app_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
