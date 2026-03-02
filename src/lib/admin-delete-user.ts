/**
 * Server-side user deletion. Use only in admin API routes after requireAdmin().
 * Uses Supabase Auth Admin API (service role) and cleans related data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type DeleteUserResult = { error: null } | { error: string }

/** Delete user from auth and clean profiles. No RPC dependency. */
export async function deleteUserById(
  supabase: SupabaseClient,
  userId: string
): Promise<DeleteUserResult> {
  if (!userId || typeof userId !== 'string') {
    return { error: 'user_id required' }
  }

  // 1) Delete from auth (cascades to sessions etc.)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('[admin delete-user] auth.admin.deleteUser', authError)
    return { error: authError.message }
  }

  // 2) Remove profile row so no orphan (optional; auth delete may not cascade to public.profiles)
  await supabase.from('profiles').delete().eq('id', userId)

  return { error: null }
}
