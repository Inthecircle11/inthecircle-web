import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

function escapeCsvCell(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  const needsQuotes = /[",\n\r]/.test(s)
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s
}

/** GET - Export reports as CSV. Requires read_reports. */
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

  const params = req.nextUrl.searchParams
  const status = params.get('status') || 'all'
  const search = params.get('search')?.trim() || null

  let query = supabase
    .from('user_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: reports, error } = await query

  if (error) {
    console.error(`[${requestId}] export error:`, error)
    return adminError('Failed to export reports', 500, requestId)
  }

  let list = (reports ?? []) as Array<Record<string, unknown>>

  const userIds = new Set<string>()
  list.forEach((r) => {
    if (r.reporter_id) userIds.add(r.reporter_id as string)
    if (r.reported_user_id) userIds.add(r.reported_user_id as string)
  })
  const profiles: Record<string, { username: string | null; email: string | null }> = {}
  if (userIds.size > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', Array.from(userIds))
    ;(profData ?? []).forEach((p: { id: string; username: string | null; email: string | null }) => {
      profiles[p.id] = { username: p.username, email: p.email }
    })
  }

  let out = list.map((r) => ({
    id: r.id,
    reporter_email: profiles[r.reporter_id as string]?.email ?? '',
    reporter_username: profiles[r.reporter_id as string]?.username ?? '',
    reported_username: profiles[r.reported_user_id as string]?.username ?? '',
    status: r.status ?? '',
    created_at: r.created_at ?? '',
    reason: r.reason ?? '',
  }))

  if (search) {
    const searchLower = search.toLowerCase()
    out = out.filter((r) => {
      const reporterEmail = String(r.reporter_email).toLowerCase()
      const reporterUsername = String(r.reporter_username).toLowerCase()
      const reportedUsername = String(r.reported_username).toLowerCase()
      return reporterEmail.includes(searchLower) || reporterUsername.includes(searchLower) || reportedUsername.includes(searchLower)
    })
  }

  const headers = ['id', 'reporter_email', 'reporter_username', 'reported_username', 'status', 'created_at', 'reason']
  const csvRows = out.map((r) => headers.map((h) => escapeCsvCell(r[h as keyof typeof r])))
  const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n')

  const filename = `reports-${new Date().toISOString().slice(0, 10)}.csv`
  const res = new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
  res.headers.set('x-request-id', requestId)
  return res
}
