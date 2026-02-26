import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** POST - Single application action (approve/reject/waitlist/suspend). Conflict-safe when updated_at provided; 409 if changed. When updated_at omitted, fetches current row or updates directly. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const perm = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
  if (perm) return perm
  const { id: applicationId } = await params
  const body = await req.json().catch(() => ({}))
  const { action, updated_at } = body
  if (!action || !['approve', 'reject', 'waitlist', 'suspend'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve|reject|waitlist|suspend' }, { status: 400 })
  }
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })

  const newStatus = action === 'approve' ? 'ACTIVE' : action === 'reject' ? 'REJECTED' : action === 'waitlist' ? 'WAITLISTED' : 'SUSPENDED'

  let resolvedUpdatedAt: string | null = typeof updated_at === 'string' ? updated_at : null

  if (resolvedUpdatedAt == null) {
    const { data: row } = await supabase
      .from('applications')
      .select('updated_at')
      .eq('id', applicationId)
      .maybeSingle()
    if (row?.updated_at != null) resolvedUpdatedAt = typeof row.updated_at === 'string' ? row.updated_at : (row.updated_at as Date)?.toISOString?.() ?? null
  }

  if (resolvedUpdatedAt != null) {
    const { data: row, error } = await supabase.rpc('admin_application_action_v2', {
      p_application_id: applicationId,
      p_updated_at: resolvedUpdatedAt,
      p_action: action,
    })
    if (error) {
      console.error('[admin 500]', error)
      return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
    }
    if (row == null) {
      return NextResponse.json(
        { error: 'Record changed by another moderator', code: 'CONFLICT' },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true })
  }

  const { error } = await (async () => {
    const hasCol = await hasUpdatedAtColumn(supabase)
    const payload: Record<string, unknown> = { status: newStatus }
    if (hasCol) payload.updated_at = new Date().toISOString()
    return supabase.from('applications').update(payload).eq('id', applicationId)
  })()
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

async function hasUpdatedAtColumn(supabase: Awaited<ReturnType<typeof getServiceRoleClient>>): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('applications').select('updated_at').limit(1).maybeSingle()
  return !error
}
