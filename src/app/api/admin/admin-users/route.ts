import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/** GET - List admin users with their roles. Requires manage_roles. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return forbidden
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  const { data: assignments, error } = await supabase
    .from('admin_user_roles')
    .select('admin_user_id, admin_roles(id, name)')
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  const byUser = new Map<string, string[]>()
  for (const row of assignments ?? []) {
    const r = row as Record<string, unknown>
    const adminUserId = String(r.admin_user_id ?? '')
    const role = r.admin_roles as Record<string, unknown> | null | undefined
    const name = role && typeof role.name === 'string' ? role.name : null
    if (!name) continue
    const list = byUser.get(adminUserId) ?? []
    if (!list.includes(name)) list.push(name)
    byUser.set(adminUserId, list)
  }
  const userIds = [...byUser.keys()]
  const profiles: Record<string, { email: string | null; name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase.from('profiles').select('id, email, name').in('id', userIds)
    for (const p of profData ?? []) {
      const q = p as { id: string; email: string | null; name: string | null }
      profiles[q.id] = { email: q.email ?? null, name: q.name ?? null }
    }
  }
  const admin_users = userIds.map((id) => ({
    admin_user_id: id,
    email: profiles[id]?.email ?? null,
    name: profiles[id]?.name ?? null,
    roles: byUser.get(id) ?? [],
  }))
  return NextResponse.json({ admin_users })
}
