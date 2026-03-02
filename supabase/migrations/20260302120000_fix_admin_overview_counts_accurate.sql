-- Fix admin_get_overview_counts to return 100% accurate metrics:
-- 1. verified_count: Use profiles.is_verified (admin-set) instead of verification_requests
-- 2. new_users_7d: Ensure this column is returned (was missing in some DB versions)
-- 3. All counts use profiles table for consistency

CREATE OR REPLACE FUNCTION public.admin_get_overview_counts()
RETURNS TABLE (
  total_users bigint,
  verified_count bigint,
  new_users_24h bigint,
  new_users_7d bigint,
  new_users_30d bigint,
  total_threads bigint,
  total_messages bigint,
  applications_7d bigint,
  applications_approved_7d bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    -- Total users: count of profiles (users who completed signup)
    (SELECT count(*)::bigint FROM public.profiles),
    
    -- Verified count: use profiles.is_verified (admin-set verification status)
    -- This is the correct source - admins set is_verified via the admin panel
    (SELECT count(*)::bigint FROM public.profiles WHERE is_verified = true),
    
    -- New users in last 24 hours (profiles with auth.users.created_at in last 24h)
    (SELECT count(*)::bigint 
     FROM auth.users u 
     WHERE u.id IN (SELECT id FROM public.profiles) 
       AND u.created_at > now() - interval '24 hours'),
    
    -- New users in last 7 days
    (SELECT count(*)::bigint 
     FROM auth.users u 
     WHERE u.id IN (SELECT id FROM public.profiles) 
       AND u.created_at > now() - interval '7 days'),
    
    -- New users in last 30 days
    (SELECT count(*)::bigint 
     FROM auth.users u 
     WHERE u.id IN (SELECT id FROM public.profiles) 
       AND u.created_at > now() - interval '30 days'),
    
    -- Total conversation threads
    (SELECT count(*)::bigint FROM public.message_threads),
    
    -- Total messages
    (SELECT count(*)::bigint FROM public.messages),
    
    -- Applications submitted in last 7 days
    (SELECT count(*)::bigint 
     FROM public.applications 
     WHERE submitted_at IS NOT NULL 
       AND submitted_at > now() - interval '7 days'),
    
    -- Applications approved in last 7 days (status ACTIVE or APPROVED)
    (SELECT count(*)::bigint 
     FROM public.applications 
     WHERE submitted_at IS NOT NULL 
       AND submitted_at > now() - interval '7 days' 
       AND upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'));
$$;

COMMENT ON FUNCTION public.admin_get_overview_counts() IS 
'Admin dashboard counts. 
- total_users: profiles count
- verified_count: profiles.is_verified = true (admin-set)
- new_users_*: auth.users.created_at for users with profiles
- threads/messages: direct counts
- applications_*: from applications table';
