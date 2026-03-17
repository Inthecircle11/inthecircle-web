import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - Count of users active in the last 24h. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)

  let count = 0
  const { data, error } = await supabase.rpc('admin_get_active_today_count').maybeSingle()
  if (!error && data != null) {
    const raw = (data as { active_count?: number | string }).active_count
    count = typeof raw === 'number' ? Math.max(0, Math.floor(raw)) : typeof raw === 'string' ? Math.max(0, parseInt(raw, 10) || 0) : 0
  } else {
    if (error) console.warn(`[${requestId}] admin_get_active_today_count:`, error.message, '(using fallback)')
    const { data: rows } = await supabase.rpc('get_active_sessions', { active_minutes: 24 * 60 })
    const list = (rows ?? []) as Array<{ user_id: string }>
    count = new Set(list.map((r) => r.user_id)).size
  }
  return adminSuccess({ count }, requestId)
}
