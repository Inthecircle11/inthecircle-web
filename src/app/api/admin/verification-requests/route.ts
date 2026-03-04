import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - Pending verification requests. Replaces client direct select on verification_requests. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const status = req.nextUrl.searchParams.get('status') || 'pending'

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data: rows, error } = await supabase
    .from('verification_requests')
    .select('id, user_id, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin verification-requests]', error)
    return adminError(error.message, 500, requestId)
  }

  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))]
  const profiles: Record<string, { username: string | null; profile_image_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, profile_image_url')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null; profile_image_url: string | null }) => {
      profiles[p.id] = { username: p.username, profile_image_url: p.profile_image_url }
    })
  }

  const list = (rows ?? []).map((r: { id: string; user_id: string; created_at: string }) => ({
    id: r.id,
    user_id: r.user_id,
    username: profiles[r.user_id]?.username ?? '',
    profile_image_url: profiles[r.user_id]?.profile_image_url ?? null,
    requested_at: r.created_at,
  }))

  return adminSuccess({ requests: list }, requestId)
}
