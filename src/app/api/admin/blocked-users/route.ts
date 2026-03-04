import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - List blocked users. Requires read_blocked_users. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_blocked_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data: blocks, error } = await supabase
    .from('blocked_users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const userIds = new Set<string>()
  ;(blocks ?? []).forEach((b: { blocker_id: string; blocked_id: string }) => {
    userIds.add(b.blocker_id)
    userIds.add(b.blocked_id)
  })

  const profiles: Record<string, { username: string | null; name: string | null }> = {}
  if (userIds.size > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', Array.from(userIds))
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name }
    })
  }

  const list = (blocks ?? []).map((b: Record<string, unknown>) => ({
    ...b,
    blocker_username: profiles[b.blocker_id as string]?.username ?? null,
    blocker_name: profiles[b.blocker_id as string]?.name ?? null,
    blocked_username: profiles[b.blocked_id as string]?.username ?? null,
    blocked_name: profiles[b.blocked_id as string]?.name ?? null,
  }))

  return adminSuccess({ blocked: list }, requestId)
}
