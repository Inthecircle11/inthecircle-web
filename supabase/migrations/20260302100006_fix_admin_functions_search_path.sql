-- Fix Supabase linter: Function Search Path Mutable (0011)
-- Set immutable search_path on admin RPCs so the linter stops warning.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- admin_get_applications_fast: alter by discovered signature (params may be integer or bigint)
DO $$
DECLARE
  sig text;
BEGIN
  SELECT pg_get_function_identity_arguments(p.oid) INTO sig
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'admin_get_applications_fast'
  LIMIT 1;
  IF sig IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION public.admin_get_applications_fast(%s) SET search_path = public', sig);
  END IF;
END $$;

ALTER FUNCTION public.admin_get_application_counts() SET search_path = public;

ALTER FUNCTION public.admin_get_all_stats() SET search_path = public;

ALTER FUNCTION public.admin_get_overview_counts() SET search_path = public, auth;
