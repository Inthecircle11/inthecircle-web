import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'
import { executeApprovedAction } from '@/lib/admin-approval'

export const dynamic = 'force-dynamic'

/** POST - Approve a request. Supervisor/super_admin only; approver must not be requested_by; cannot approve expired. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.approve_approval)
  if (forbidden) return forbidden

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid approval id' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const now = new Date().toISOString()

  const { data: row, error: fetchErr } = await supabase
    .from('admin_approval_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
  }

  const r = row as Record<string, unknown>
  if (r.status !== 'pending') {
    return NextResponse.json(
      { error: 'Request is not pending' },
      { status: 400 }
    )
  }
  if (r.requested_by === result.user.id) {
    return NextResponse.json(
      { error: 'Approver cannot be the same as requester' },
      { status: 400 }
    )
  }
  if (new Date(String(r.expires_at)) < new Date()) {
    await supabase
      .from('admin_approval_requests')
      .update({ status: 'expired' })
      .eq('id', id)
    await writeAuditLog(supabase, req, result.user, {
      action: 'approval_expired',
      target_type: 'approval_request',
      target_id: id,
      details: { action: r.action, target_type: r.target_type, target_id: r.target_id },
    })
    return NextResponse.json(
      { error: 'Request has expired' },
      { status: 400 }
    )
  }

  const payload = (r.payload as Record<string, unknown>) ?? {}
  const action = String(r.action)
  const execErr = await executeApprovedAction(supabase, action, payload)
  if (execErr.error) {
    return NextResponse.json(
      { error: `Execution failed: ${execErr.error}` },
      { status: 500 }
    )
  }

  await writeAuditLog(supabase, req, result.user, {
    action: String(r.action),
    target_type: String(r.target_type),
    target_id: String(r.target_id),
    details: payload,
    reason: typeof payload.reason === 'string' ? payload.reason : null,
  })

  // C2 stabilization: conditional update by status so only one approver wins; check affected row count.
  // Without this, two concurrent approvers could both get 200 while only one row was updated.
  const { data: updatedRows, error: updateErr } = await supabase
    .from('admin_approval_requests')
    .update({
      status: 'approved',
      approved_by: result.user.id,
      approved_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')

  if (updateErr) {
    console.error('[admin 500]', updateErr)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: 'Request was already approved or is no longer pending' },
      { status: 409 }
    )
  }

  await writeAuditLog(supabase, req, result.user, {
    action: 'approval_approved',
    target_type: 'approval_request',
    target_id: id,
    details: { action, target_type: r.target_type, target_id: r.target_id },
  })

  return NextResponse.json({ ok: true, id })
}
