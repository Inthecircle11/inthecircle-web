import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - List active admin sessions. Permission: active_sessions. Returns current_session_id so UI can mark current. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.active_sessions)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data: rows, error } = await supabase
    .from('admin_sessions')
    .select('id, admin_user_id, session_id, ip_address, user_agent, country, city, created_at, last_seen_at, is_active')
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const sessions = (rows ?? []).map((r) => ({
    id: r.id,
    admin_user_id: r.admin_user_id,
    session_id: r.session_id,
    ip_address: r.ip_address ?? null,
    user_agent: r.user_agent ?? null,
    country: r.country ?? null,
    city: r.city ?? null,
    created_at: r.created_at,
    last_seen_at: r.last_seen_at,
    is_active: r.is_active,
    is_current: r.session_id === result.sessionId,
  }))

  return adminSuccess({
    sessions,
    current_session_id: result.sessionId ?? null,
  }, requestId)
}
