import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Set user ban status. Requires ban_users. No client RPC. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.ban_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const { id: userId } = await params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return adminError('Invalid user id', 400, requestId)
  }

  const body = await req.json().catch(() => ({}))
  const isBanned = body?.is_banned === true

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: isBanned, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('[admin ban]', error)
    return adminError(error.message, 500, requestId)
  }

  await writeAuditLog(supabase, req, result.user, {
    action: isBanned ? 'user_ban' : 'user_unban',
    target_type: 'user',
    target_id: userId,
    details: { is_banned: isBanned },
  })

  return adminSuccess({ ok: true }, requestId)
}
