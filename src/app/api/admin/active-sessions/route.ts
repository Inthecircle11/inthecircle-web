import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List active sessions. Requires active_sessions. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.active_sessions)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const minutes = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get('minutes') || '15', 10) || 15))

  const { data: rows, error } = await supabase.rpc('get_active_sessions', { active_minutes: minutes })

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  const list = (rows ?? []) as Array<{ user_id: string; email: string | null; last_active_at: string }>
  const userIds = [...new Set(list.map((r) => r.user_id))]

  let profiles: Record<string, { username: string | null; name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name }
    })
  }

  const users = list.map((r) => ({
    user_id: r.user_id,
    email: r.email ?? null,
    username: profiles[r.user_id]?.username ?? null,
    name: profiles[r.user_id]?.name ?? null,
    last_active_at: r.last_active_at,
  }))

  return NextResponse.json({ count: users.length, users, minutes })
}
