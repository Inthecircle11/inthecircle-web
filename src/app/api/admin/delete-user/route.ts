import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import {
  checkDestructiveRateLimit,
  writeAuditLog,
} from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import {
  requiresApproval,
  createApprovalRequest,
} from '@/lib/admin-approval'
import { deleteUserById } from '@/lib/admin-delete-user'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'

export const dynamic = 'force-dynamic'

const REASON_MIN_LENGTH = 5

/** POST - Delete user. Requires delete_users. If approval required, returns 202 and request_id. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.delete_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { user, supabase } = result

  return withAdminRateLimit(req, 'delete-user', 20, 60000, async () => {
    const body = await req.json().catch(() => ({}))
    const userId = body.user_id
    const rawReason = body.reason != null ? String(body.reason).trim() : ''
    if (!userId) {
      return adminError('user_id required', 400, requestId)
    }
    if (rawReason.length < REASON_MIN_LENGTH) {
      return adminError(`reason required (min ${REASON_MIN_LENGTH} characters)`, 400, requestId)
    }

    const serviceSupabase = getServiceRoleClient()
    if (!serviceSupabase) {
      return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
    }

    if (requiresApproval('user_delete', { user_id: userId })) {
      const permForbidden = requirePermission(result, ADMIN_PERMISSIONS.request_approval)
      if (permForbidden) return adminErrorFromResponse(permForbidden, requestId)
      const created = await createApprovalRequest(
        serviceSupabase,
        req,
        user,
        'user_delete',
        'user',
        userId,
        { user_id: userId, reason: rawReason },
        rawReason
      )
      if ('error' in created) {
        return adminError(created.error, 500, requestId)
      }
      return adminSuccess({ approval_required: true, request_id: created.id }, requestId, 202)
    }

    const rateErr = await checkDestructiveRateLimit(supabase, user.id, 'user_delete', 1)
    if (rateErr) {
      const res = adminError(rateErr, 429, requestId)
      res.headers.set('Retry-After', '3600')
      return res
    }

    const outcome = await deleteUserById(serviceSupabase, userId)
    if (outcome.error) {
      console.error('[admin 500]', outcome.error)
      return adminError('Operation failed. Please try again.', 500, requestId)
    }

    await writeAuditLog(supabase, req, user, {
      action: 'user_delete',
      target_type: 'user',
      target_id: userId,
      details: {},
      reason: rawReason.slice(0, 500),
    })

    return adminSuccess({ ok: true }, requestId)
  })
}
