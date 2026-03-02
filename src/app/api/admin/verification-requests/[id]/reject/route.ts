import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** POST - Reject a verification request. Requires mutate_users. No client direct update. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_users)
  if (forbidden) return forbidden

  const { id: requestId } = await params
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: row, error: updateError } = await supabase
    .from('verification_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('user_id')
    .single()

  if (updateError || !row) {
    return NextResponse.json(
      { error: 'Request not found or already reviewed' },
      { status: 404 }
    )
  }

  const userId = (row as { user_id: string }).user_id
  await writeAuditLog(supabase, req, result.user, {
    action: 'verification_reject',
    target_type: 'user',
    target_id: userId,
    details: { verification_request_id: requestId },
  })

  return NextResponse.json({ ok: true })
}
