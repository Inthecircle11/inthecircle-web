import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'

export const dynamic = 'force-dynamic'

/** POST - Assign role to an admin user. Requires manage_roles. Audited. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { id: adminUserId } = await params

  return withAdminRateLimit(req, 'assign-role', 20, 60000, async () => {
    const body = await req.json().catch(() => ({}))
    const roleId = body.role_id ?? null
    const roleName = body.role_name ?? null
    if ((!roleId && !roleName) || (roleId && roleName)) {
      return adminError('Provide exactly one of role_id or role_name', 400, requestId)
    }
    const supabase = getServiceRoleClient()
    if (!supabase) return adminError('Service unavailable', 500, requestId)
    let resolvedRoleId: string
    if (roleName) {
      const { data: role, error } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('name', String(roleName).trim())
        .single()
      if (error || !role?.id) return adminError('Invalid role name', 400, requestId)
      resolvedRoleId = role.id
    } else {
      resolvedRoleId = String(roleId)
    }
    const { error } = await supabase.from('admin_user_roles').upsert(
      { admin_user_id: adminUserId, role_id: resolvedRoleId },
      { onConflict: 'admin_user_id,role_id' }
    )
    if (error) {
      console.error('[admin 500]', error)
      return adminError('Operation failed. Please try again.', 500, requestId)
    }
    const { data: roleRow } = await supabase.from('admin_roles').select('name').eq('id', resolvedRoleId).single()
    await writeAuditLog(supabase, req, result.user, {
      action: 'role_assign',
      target_type: 'admin_user',
      target_id: adminUserId,
      details: { role_name: roleRow?.name ?? resolvedRoleId },
      reason: null,
    })
    if (roleRow?.name === 'super_admin') {
      await writeAuditLog(supabase, req, result.user, {
        action: 'control_drift_detected',
        target_type: 'rbac',
        target_id: adminUserId,
        details: { drift: 'new_super_admin_created', role_name: 'super_admin' },
        reason: null,
      })
    }
    return adminSuccess({ ok: true }, requestId)
  })
}
