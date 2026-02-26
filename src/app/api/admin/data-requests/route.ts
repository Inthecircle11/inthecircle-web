import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List data requests. Requires read_data_requests. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_data_requests)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: requests, error } = await supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  const userIds = [...new Set((requests ?? []).map((r: { user_id: string }) => r.user_id))]
  const profiles: Record<string, { username: string | null; name: string | null; email?: string }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name }
    })
  }

  const list = (requests ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    username: profiles[r.user_id as string]?.username ?? null,
    name: profiles[r.user_id as string]?.name ?? null,
  }))

  return NextResponse.json({ requests: list })
}

/** PATCH - Update data request status. Requires update_data_requests. Optional updated_at for conflict-safe update (409 if row changed). */
export async function PATCH(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.update_data_requests)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { request_id, status, updated_at: clientUpdatedAt } = body
  if (!request_id || !['pending', 'completed', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'request_id and status (pending|completed|failed) required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  // C3 stabilization: when client sends updated_at, use optimistic locking; return 409 if row was changed.
  const useOptimisticLock = typeof clientUpdatedAt === 'string' && clientUpdatedAt.trim().length > 0

  let query = supabase
    .from('data_requests')
    .update({ status, updated_at: now })
    .eq('id', request_id)

  if (useOptimisticLock) {
    query = query.eq('updated_at', clientUpdatedAt.trim())
  }

  const { data: updatedRows, error } = await query.select('id')

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (useOptimisticLock && (!updatedRows || updatedRows.length === 0)) {
    return NextResponse.json(
      { error: 'Record changed by another user. Refresh and try again.' },
      { status: 409 }
    )
  }
  return NextResponse.json({ ok: true })
}
