import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Set user verification status. Requires mutate_users. No client RPC. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const { id: userId } = await params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return adminError('Invalid user id', 400, requestId)
  }

  const body = await req.json().catch(() => ({}))
  const isVerified = body?.is_verified === true

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (profileError) {
    console.error('[admin verification]', profileError)
    return adminError(profileError.message, 500, requestId)
  }

  if (isVerified) {
    const now = new Date().toISOString()
    await supabase
      .from('verification_requests')
      .update({ status: 'approved', reviewed_at: now })
      .eq('user_id', userId)
      .eq('status', 'pending')
  }

  await writeAuditLog(supabase, req, result.user, {
    action: isVerified ? 'verification_set' : 'verification_remove',
    target_type: 'user',
    target_id: userId,
    details: { is_verified: isVerified },
  })

  return adminSuccess({ ok: true }, requestId)
}
