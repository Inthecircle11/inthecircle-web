import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

/** POST - Resolve an escalation. Supervisor+ only. Sets status=resolved, resolved_at=now(). Audit: escalation_resolve. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.resolve_escalations)
  if (forbidden) return forbidden

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid escalation id' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null
  const now = new Date().toISOString()

  const { data: row, error: updateError } = await supabase
    .from('admin_escalations')
    .update({ status: 'resolved', resolved_at: now, notes: notes ?? undefined })
    .eq('id', id)
    .eq('status', 'open')
    .select('id, metric_name, threshold_level')
    .single()

  if (updateError) {
    console.error('[admin 500]', updateError)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json(
      { error: 'Escalation not found or already resolved' },
      { status: 404 }
    )
  }

  await writeAuditLog(supabase, req, result.user, {
    action: 'escalation_resolve',
    target_type: 'escalation',
    target_id: id,
    details: {
      metric_name: (row as Record<string, unknown>).metric_name,
      threshold_level: (row as Record<string, unknown>).threshold_level,
      notes: notes ?? undefined,
    },
  })

  return NextResponse.json({ ok: true, id })
}
