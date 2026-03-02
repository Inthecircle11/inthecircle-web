import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - Count of users active in the last 24h (for "Active today" / "Logged in last 24h" card). Uses admin_get_active_today_count() from migrations. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.active_sessions)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data, error } = await supabase.rpc('admin_get_active_today_count').maybeSingle()

  if (error) {
    console.error('[admin active-today]', error)
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 })
  }

  const raw = data != null ? (data as { active_count?: number | string }).active_count : null
  const count =
    typeof raw === 'number'
      ? Math.max(0, Math.floor(raw))
      : typeof raw === 'string'
        ? Math.max(0, parseInt(raw, 10) || 0)
        : 0

  return NextResponse.json({ count })
}
