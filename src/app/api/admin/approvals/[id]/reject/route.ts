import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Reject a request. Supervisor/super_admin only. Cannot reject already approved/rejected/expired. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.approve_approval)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return adminError('Invalid approval id', 400, requestId)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const now = new Date().toISOString()

  const { data: row, error: updateErr } = await supabase
    .from('admin_approval_requests')
    .update({
      status: 'rejected',
      rejected_by: result.user.id,
      rejected_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, action, target_type, target_id')
    .single()

  if (updateErr || !row) {
    return adminError('Approval request not found or not pending', 404, requestId)
  }

  const r = row as Record<string, unknown>
  await writeAuditLog(supabase, req, result.user, {
    action: 'approval_rejected',
    target_type: 'approval_request',
    target_id: id,
    details: { action: r.action, target_type: r.target_type, target_id: r.target_id },
  })

  return adminSuccess({ ok: true, id }, requestId)
}
