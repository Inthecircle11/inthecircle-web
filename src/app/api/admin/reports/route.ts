import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/admin-idempotency'

export const dynamic = 'force-dynamic'

/** GET - List reports with assignment, sort, filter. Requires read_reports. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_reports)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const sort = req.nextUrl.searchParams.get('sort') || 'overdue' // overdue | oldest | assigned_to_me
  const filter = req.nextUrl.searchParams.get('filter') || 'all' // all | unassigned | assigned_to_me
  const currentUserId = result.user.id
  const now = new Date()

  const { data: reports, error } = await supabase
    .from('user_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  let list = (reports ?? []) as Array<Record<string, unknown>>
  if (status !== 'all') {
    list = list.filter((r) => r.status === status)
  }
  if (filter === 'unassigned') {
    list = list.filter((r) => r.assigned_to == null || (r.assignment_expires_at && new Date(r.assignment_expires_at as string) < now))
  } else if (filter === 'assigned_to_me') {
    list = list.filter((r) => r.assigned_to === currentUserId && r.assignment_expires_at && new Date(r.assignment_expires_at as string) >= now)
  }

  const priority = (createdAt: string) => {
    const age = now.getTime() - new Date(createdAt).getTime()
    if (age >= 24 * 60 * 60 * 1000) return 1
    if (age >= 6 * 60 * 60 * 1000) return 2
    return 3
  }
  list.forEach((r) => {
    r._priority = priority((r.created_at as string) ?? '')
  })
  if (sort === 'oldest') {
    list.sort((a, b) => new Date((a.created_at as string) ?? 0).getTime() - new Date((b.created_at as string) ?? 0).getTime())
  } else if (sort === 'assigned_to_me') {
    list = list.filter((r) => r.assigned_to === currentUserId && r.assignment_expires_at && new Date(r.assignment_expires_at as string) >= now)
    list.sort((a, b) => (a._priority as number) - (b._priority as number) || new Date((a.created_at as string) ?? 0).getTime() - new Date((b.created_at as string) ?? 0).getTime())
  } else {
    list.sort((a, b) => (a._priority as number) - (b._priority as number) || new Date((a.created_at as string) ?? 0).getTime() - new Date((b.created_at as string) ?? 0).getTime())
  }
  list.forEach((r) => delete r._priority)

  const userIds = new Set<string>()
  list.forEach((r) => {
    if (r.reporter_id) userIds.add(r.reporter_id as string)
    if (r.reported_user_id) userIds.add(r.reported_user_id as string)
  })
  const profiles: Record<string, { username: string | null; name: string | null }> = {}
  if (userIds.size > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', Array.from(userIds))
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name }
    })
  }

  const out = list.map((r) => ({
    ...r,
    reporter_username: profiles[r.reporter_id as string]?.username ?? null,
    reporter_name: profiles[r.reporter_id as string]?.name ?? null,
    reported_username: profiles[r.reported_user_id as string]?.username ?? null,
    reported_name: profiles[r.reported_user_id as string]?.name ?? null,
  }))

  return NextResponse.json({ reports: out })
}

/** PATCH - Resolve or dismiss report. Requires resolve_reports. Conflict-safe: requires updated_at; 409 if changed. Idempotency-Key supported. */
export async function PATCH(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.resolve_reports)
  if (forbidden) return forbidden
  const { user } = result
  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const idempotencyKey = req.headers.get('idempotency-key')?.trim()
  const action = 'reports_patch'
  if (idempotencyKey) {
    const stored = await getIdempotencyResponse(supabase, idempotencyKey, user.id, action)
    if (stored) {
      return new NextResponse(stored.body, {
        status: stored.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const body = await req.json().catch(() => ({}))
  const { report_id, status, notes, updated_at } = body
  if (!report_id || !['resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'report_id and status (resolved|dismissed) required' }, { status: 400 })
  }
  if (updated_at == null || typeof updated_at !== 'string') {
    return NextResponse.json({ error: 'updated_at required for conflict safety' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_reports')
    .update({
      status,
      notes: notes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', report_id)
    .eq('updated_at', updated_at)
    .select('id')
    .single()

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (!data) {
    const resBody = JSON.stringify({ error: 'Record changed by another moderator', code: 'CONFLICT' })
    if (idempotencyKey) await setIdempotencyResponse(supabase, idempotencyKey, user.id, action, 409, resBody)
    return NextResponse.json({ error: 'Record changed by another moderator' }, { status: 409 })
  }

  const resBody = JSON.stringify({ ok: true })
  if (idempotencyKey) await setIdempotencyResponse(supabase, idempotencyKey, user.id, action, 200, resBody)
  return NextResponse.json({ ok: true })
}
