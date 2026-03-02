import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { deleteUserById } from '@/lib/admin-delete-user'

export const dynamic = 'force-dynamic'

/** DELETE - Permanently delete a user. Requires delete_users. Uses Auth Admin API; no RPC. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.delete_users)
  if (forbidden) return forbidden

  const { id: userId } = await params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const outcome = await deleteUserById(supabase, userId)
  if (outcome.error) {
    return NextResponse.json({ error: outcome.error }, { status: 500 })
  }

  await writeAuditLog(supabase, req, result.user, {
    action: 'user_delete',
    target_type: 'user',
    target_id: userId,
    details: {},
  })

  return NextResponse.json({ ok: true })
}
