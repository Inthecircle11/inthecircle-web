import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

async function countSuperAdmins(supabase: ReturnType<typeof getServiceRoleClient>): Promise<number> {
  if (!supabase) return 0
  const { data: superAdminRole } = await supabase.from('admin_roles').select('id').eq('name', 'super_admin').single()
  if (!superAdminRole?.id) return 0
  const { count } = await supabase
    .from('admin_user_roles')
    .select('admin_user_id', { count: 'exact', head: true })
    .eq('role_id', superAdminRole.id)
  return count ?? 0
}

/** DELETE - Remove role from an admin user. Requires manage_roles. Cannot remove last super_admin; cannot remove own super_admin if last. Audited. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return forbidden
  const { id: targetUserId } = await params
  const url = req.nextUrl
  const roleId = url.searchParams.get('role_id')
  const roleName = url.searchParams.get('role_name')
  if ((!roleId && !roleName) || (roleId && roleName)) {
    return NextResponse.json({ error: 'Provide exactly one of role_id or role_name' }, { status: 400 })
  }
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  let resolvedRoleId: string
  let roleNameResolved: string
  if (roleName) {
    const { data: role, error } = await supabase
      .from('admin_roles')
      .select('id, name')
      .eq('name', String(roleName).trim())
      .single()
    if (error || !role?.id) return NextResponse.json({ error: 'Invalid role name' }, { status: 400 })
    resolvedRoleId = role.id
    roleNameResolved = role.name ?? roleName
  } else {
    resolvedRoleId = String(roleId)
    const { data: r } = await supabase.from('admin_roles').select('name').eq('id', resolvedRoleId).single()
    roleNameResolved = r?.name ?? resolvedRoleId
  }
  if (roleNameResolved === 'super_admin') {
    const totalSuperAdmins = await countSuperAdmins(supabase)
    if (totalSuperAdmins < 2) {
      return NextResponse.json(
        { error: 'Cannot remove super_admin: at least one super_admin must remain' },
        { status: 400 }
      )
    }
  }
  const { error } = await supabase
    .from('admin_user_roles')
    .delete()
    .eq('admin_user_id', targetUserId)
    .eq('role_id', resolvedRoleId)
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  await writeAuditLog(supabase, req, result.user, {
    action: 'role_remove',
    target_type: 'admin_user',
    target_id: targetUserId,
    details: { role_name: roleNameResolved },
    reason: null,
  })
  await writeAuditLog(supabase, req, result.user, {
    action: 'control_drift_detected',
    target_type: 'rbac',
    target_id: targetUserId,
    details: { drift: 'role_removed', role_name: roleNameResolved },
    reason: null,
  })
  return NextResponse.json({ ok: true })
}
