import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

/** POST - Revoke an admin session. Permission: manage_roles (or super_admin). Sets is_active=false, revoked_at=now(). Audit: session_revoked. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return forbidden

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const { data: row, error: updateError } = await supabase
    .from('admin_sessions')
    .update({ is_active: false, revoked_at: now })
    .eq('id', id)
    .eq('is_active', true)
    .select('id, admin_user_id, session_id, ip_address')
    .single()

  if (updateError) {
    console.error('[admin 500]', updateError)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json(
      { error: 'Session not found or already revoked' },
      { status: 404 }
    )
  }

  await writeAuditLog(supabase, req, result.user, {
    action: 'session_revoked',
    target_type: 'admin_session',
    target_id: id,
    details: {
      revoked_session_id: (row as Record<string, unknown>).session_id,
      admin_user_id: (row as Record<string, unknown>).admin_user_id,
      ip_address: (row as Record<string, unknown>).ip_address,
    },
  })

  return NextResponse.json({ ok: true, id })
}
