import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/admin-idempotency'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - List reports with assignment, sort, filter. Requires read_reports. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_reports)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const sort = req.nextUrl.searchParams.get('sort') || 'overdue' // overdue | oldest | assigned_to_me
  const filter = req.nextUrl.searchParams.get('filter') || 'all' // all | unassigned | assigned_to_me
  const search = req.nextUrl.searchParams.get('search')?.trim() || null
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit')) || 50))
  const currentUserId = result.user.id
  const now = new Date()

  let query = supabase
    .from('user_reports')
    .select('*')
    .order('created_at', { ascending: false })

  let countQuery = supabase
    .from('user_reports')
    .select('*', { count: 'exact', head: true })

  if (status !== 'all') {
    query = query.eq('status', status)
    countQuery = countQuery.eq('status', status)
  }

  const { data: reports, error } = await query.limit(5000)
  const { count: _count } = await countQuery

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  let list = (reports ?? []) as Array<Record<string, unknown>>
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
  const profiles: Record<string, { username: string | null; name: string | null; email: string | null }> = {}
  if (userIds.size > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name, email')
      .in('id', Array.from(userIds))
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null; email: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name, email: p.email }
    })
  }

  let out = list.map((r) => ({
    ...r,
    reporter_username: profiles[r.reporter_id as string]?.username ?? null,
    reporter_name: profiles[r.reporter_id as string]?.name ?? null,
    reporter_email: profiles[r.reporter_id as string]?.email ?? null,
    reported_username: profiles[r.reported_user_id as string]?.username ?? null,
    reported_name: profiles[r.reported_user_id as string]?.name ?? null,
  }))

  if (search) {
    const searchLower = search.toLowerCase()
    out = out.filter((r) => {
      const reporterEmail = String(r.reporter_email ?? '').toLowerCase()
      const reporterUsername = String(r.reporter_username ?? '').toLowerCase()
      const reportedUsername = String(r.reported_username ?? '').toLowerCase()
      return reporterEmail.includes(searchLower) || reporterUsername.includes(searchLower) || reportedUsername.includes(searchLower)
    })
  }

  const total = out.length
  const offset = (page - 1) * limit
  const paginated = out.slice(offset, offset + limit)

  return adminSuccess({ reports: paginated, total, page, limit }, requestId)
}

/** PATCH - Resolve or dismiss report. Requires resolve_reports. Conflict-safe: requires updated_at; 409 if changed. Idempotency-Key supported. */
export async function PATCH(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.resolve_reports)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { user } = result
  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const idempotencyKey = req.headers.get('idempotency-key')?.trim()
  const action = 'reports_patch'
  if (idempotencyKey) {
    const stored = await getIdempotencyResponse(supabase, idempotencyKey, user.id, action)
    if (stored) {
      const res = new NextResponse(stored.body, {
        status: stored.status,
        headers: { 'Content-Type': 'application/json' },
      })
      res.headers.set('x-request-id', requestId)
      return res
    }
  }

  const body = await req.json().catch(() => ({}))
  const { report_id, status, notes, updated_at } = body
  if (!report_id || !['resolved', 'dismissed'].includes(status)) {
    return adminError('report_id and status (resolved|dismissed) required', 400, requestId)
  }
  if (updated_at == null || typeof updated_at !== 'string') {
    return adminError('updated_at required for conflict safety', 400, requestId)
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
    return adminError('Operation failed. Please try again.', 500, requestId)
  }
  if (!data) {
    const resBody = JSON.stringify({ error: 'Record changed by another moderator', code: 'CONFLICT' })
    if (idempotencyKey) await setIdempotencyResponse(supabase, idempotencyKey, user.id, action, 409, resBody)
    return adminError('Record changed by another moderator', 409, requestId)
  }

  const resBody = JSON.stringify({ ok: true })
  if (idempotencyKey) await setIdempotencyResponse(supabase, idempotencyKey, user.id, action, 200, resBody)
  return adminSuccess({ ok: true }, requestId)
}
