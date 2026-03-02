#!/usr/bin/env node
/**
 * Apply the admin_get_overview_counts fix directly to the production database.
 * This updates the function to use profiles.is_verified instead of verification_requests.
 * 
 * Usage: node scripts/apply-metrics-fix.mjs
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Set these environment variables and try again.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const MIGRATION_SQL = `
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
    (SELECT count(*)::bigint FROM public.profiles),
    (SELECT count(*)::bigint FROM public.profiles WHERE is_verified = true),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '24 hours'),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '7 days'),
    (SELECT count(*)::bigint FROM auth.users u WHERE u.id IN (SELECT id FROM public.profiles) AND u.created_at > now() - interval '30 days'),
    (SELECT count(*)::bigint FROM public.message_threads),
    (SELECT count(*)::bigint FROM public.messages),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days'),
    (SELECT count(*)::bigint FROM public.applications WHERE submitted_at IS NOT NULL AND submitted_at > now() - interval '7 days' AND upper(trim(coalesce(status::text, ''))) IN ('ACTIVE', 'APPROVED'));
$$;
`

async function main() {
  console.log('Applying admin_get_overview_counts fix to production database...')
  console.log('Database URL:', SUPABASE_URL)
  
  // Execute the migration
  const { error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL }).maybeSingle()
  
  if (error) {
    // Try direct SQL if exec_sql doesn't exist
    console.log('exec_sql not available, trying direct approach...')
    
    // We can't run raw SQL directly via supabase-js, so let's test the function
    const { data, error: testError } = await supabase.rpc('admin_get_overview_counts').maybeSingle()
    
    if (testError) {
      console.error('Error testing admin_get_overview_counts:', testError.message)
      console.log('')
      console.log('=== MANUAL MIGRATION REQUIRED ===')
      console.log('Please run this SQL in your Supabase SQL Editor:')
      console.log('')
      console.log(MIGRATION_SQL)
      console.log('')
      process.exit(1)
    }
    
    console.log('Current admin_get_overview_counts result:', data)
    console.log('')
    console.log('The function exists but may need updating.')
    console.log('Please run this SQL in your Supabase SQL Editor to fix metrics:')
    console.log('')
    console.log(MIGRATION_SQL)
    process.exit(0)
  }
  
  console.log('Migration applied successfully!')
  
  // Verify the fix
  const { data: result, error: verifyError } = await supabase.rpc('admin_get_overview_counts').maybeSingle()
  if (verifyError) {
    console.error('Error verifying:', verifyError.message)
  } else {
    console.log('Verification result:', result)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
