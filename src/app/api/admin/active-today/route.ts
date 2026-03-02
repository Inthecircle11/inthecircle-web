import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - Count of users active in the last 24h (for "Active today" / "Logged in last 24h" card). Uses admin_get_active_today_count() when available; falls back to get_active_sessions(1440) if RPC is missing. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  let count = 0

  const { data, error } = await supabase.rpc('admin_get_active_today_count').maybeSingle()

  if (!error && data != null) {
    const raw = (data as { active_count?: number | string }).active_count
    count =
      typeof raw === 'number'
        ? Math.max(0, Math.floor(raw))
        : typeof raw === 'string'
          ? Math.max(0, parseInt(raw, 10) || 0)
          : 0
  } else {
    if (error) console.error('[admin active-today]', error.message, '(using get_active_sessions fallback)')
    // Fallback when admin_get_active_today_count is missing or errors (e.g. migration not run in production)
    const MINUTES_24H = 24 * 60
    const { data: rows } = await supabase.rpc('get_active_sessions', { active_minutes: MINUTES_24H })
    const list = (rows ?? []) as Array<{ user_id: string }>
    count = new Set(list.map((r) => r.user_id)).size
  }

  return NextResponse.json({ count })
}
