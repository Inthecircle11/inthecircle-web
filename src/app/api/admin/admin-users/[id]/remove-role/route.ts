import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'

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
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { id: targetUserId } = await params

  return withAdminRateLimit(req, 'remove-role', 20, 60000, async () => {
    const url = req.nextUrl
    const roleId = url.searchParams.get('role_id')
    const roleName = url.searchParams.get('role_name')
    if ((!roleId && !roleName) || (roleId && roleName)) {
      return adminError('Provide exactly one of role_id or role_name', 400, requestId)
    }
    const supabase = getServiceRoleClient()
    if (!supabase) return adminError('Service unavailable', 500, requestId)
    let resolvedRoleId: string
    let roleNameResolved: string
    if (roleName) {
      const { data: role, error } = await supabase
        .from('admin_roles')
        .select('id, name')
        .eq('name', String(roleName).trim())
        .single()
      if (error || !role?.id) return adminError('Invalid role name', 400, requestId)
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
        return adminError('Cannot remove super_admin: at least one super_admin must remain', 400, requestId)
      }
    }
    const { error } = await supabase
      .from('admin_user_roles')
      .delete()
      .eq('admin_user_id', targetUserId)
      .eq('role_id', resolvedRoleId)
    if (error) {
      console.error('[admin 500]', error)
      return adminError('Operation failed. Please try again.', 500, requestId)
    }
    await writeAuditLog(supabase, req, result.user, {
      action: 'role_remove',
      target_type: 'admin_user',
      target_id: targetUserId,
      details: { role_name: roleNameResolved, drift: 'role_removed' },
      reason: null,
    })
    return adminSuccess({ ok: true }, requestId)
  })
}
