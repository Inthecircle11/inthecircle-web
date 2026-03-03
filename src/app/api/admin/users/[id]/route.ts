import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { deleteUserById } from '@/lib/admin-delete-user'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** DELETE - Permanently delete a user. Requires delete_users. Uses Auth Admin API; no RPC. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.delete_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const { id: userId } = await params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return adminError('Invalid user id', 400, requestId)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const outcome = await deleteUserById(supabase, userId)
  if (outcome.error) {
    return adminError(outcome.error, 500, requestId)
  }

  await writeAuditLog(supabase, req, result.user, {
    action: 'user_delete',
    target_type: 'user',
    target_id: userId,
    details: {},
  })

  return adminSuccess({ ok: true }, requestId)
}
