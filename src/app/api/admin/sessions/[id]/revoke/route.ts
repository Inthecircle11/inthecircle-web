import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'

export const dynamic = 'force-dynamic'

/** POST - Revoke an admin session. Permission: active_sessions (session-level action; matches GET /api/admin/sessions). Sets is_active=false, revoked_at=now(). Audit: session_revoked. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.active_sessions)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  return withAdminRateLimit(req, 'revoke-session', 20, 60000, async () => {
    const { id } = await params
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return adminError('Invalid session id', 400, requestId)
    }

    const supabase = getServiceRoleClient()
    if (!supabase) {
      return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
    }

    const now = new Date().toISOString()
    const { data: row, error: updateError } = await supabase
      .from('admin_sessions')
      .update({ is_active: false, revoked_at: now })
      .eq('id', id)
      .eq('is_active', true)
      .select('id, admin_user_id, session_id, ip_address')
      .single()

    if (updateError) {
      console.error('[admin 500]', updateError)
      return adminError('Operation failed. Please try again.', 500, requestId)
    }
    if (!row) {
      return adminError('Session not found or already revoked', 404, requestId)
    }

    await writeAuditLog(supabase, req, result.user, {
      action: 'session_revoked',
      target_type: 'admin_session',
      target_id: id,
      details: {
        revoked_session_id: (row as Record<string, unknown>).session_id,
        admin_user_id: (row as Record<string, unknown>).admin_user_id,
        ip_address: (row as Record<string, unknown>).ip_address,
      },
    })

    return adminSuccess({ ok: true, id }, requestId)
  })
}
