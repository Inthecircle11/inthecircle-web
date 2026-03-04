import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Reject a verification request. Requires mutate_users. No client direct update. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const { id: requestIdParam } = await params
  if (!requestIdParam || !/^[0-9a-f-]{36}$/i.test(requestIdParam)) {
    return adminError('Invalid request id', 400, requestId)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data: row, error: updateError } = await supabase
    .from('verification_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestIdParam)
    .eq('status', 'pending')
    .select('user_id')
    .single()

  if (updateError || !row) {
    return adminError('Request not found or already reviewed', 404, requestId)
  }

  const userId = (row as { user_id: string }).user_id
  await writeAuditLog(supabase, req, result.user, {
    action: 'verification_reject',
    target_type: 'user',
    target_id: userId,
    details: { verification_request_id: requestIdParam },
  })

  return adminSuccess({ ok: true }, requestId)
}
