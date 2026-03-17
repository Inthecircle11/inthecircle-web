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

/** GET - Export data requests as CSV. Requires read_data_requests. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_data_requests)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const params = req.nextUrl.searchParams
  const statusFilter = params.get('status') || 'all'
  const typeFilter = params.get('type') || 'all'

  let query = supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (typeFilter !== 'all') {
    query = query.eq('request_type', typeFilter)
  }

  const { data: requests, error } = await query

  if (error) {
    console.error(`[${requestId}] export error:`, error)
    return adminError('Failed to export data requests', 500, requestId)
  }

  const userIds = [...new Set((requests ?? []).map((r: { user_id: string }) => r.user_id))]
  const profiles: Record<string, { username: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null }) => {
      profiles[p.id] = { username: p.username }
    })
  }

  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const rows = (requests ?? []).map((r: Record<string, unknown>) => {
    const createdAt = r.created_at ? new Date(r.created_at as string) : null
    const isOverdue = r.status === 'pending' && createdAt && createdAt < overdueThreshold
    return {
      id: r.id,
      username: profiles[r.user_id as string]?.username ?? '',
      request_type: r.request_type ?? '',
      status: r.status ?? '',
      created_at: r.created_at ?? '',
      is_overdue: isOverdue ? 'yes' : 'no',
    }
  })

  const headers = ['id', 'username', 'request_type', 'status', 'created_at', 'is_overdue']
  const csvRows = rows.map((r) => headers.map((h) => escapeCsvCell(r[h as keyof typeof r])))
  const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n')

  const filename = `data-requests-${new Date().toISOString().slice(0, 10)}.csv`
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
