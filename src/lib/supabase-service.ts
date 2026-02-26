import { createClient, SupabaseClient } from '@supabase/supabase-js'

let serviceClient: SupabaseClient | null = null

/**
 * Create Supabase client with service role (bypasses RLS).
 * Use only in server-side admin API routes after requireAdmin().
 * Returns null if env vars are missing.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return serviceClient
}
