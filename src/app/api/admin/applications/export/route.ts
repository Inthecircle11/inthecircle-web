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

/** GET - Export applications as CSV. Requires read_applications. Supports same filters as list endpoint. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const params = req.nextUrl.searchParams
  const statusParam = (params.get('status') || 'all').toLowerCase()
  const searchParam = params.get('search')?.trim() || null
  const typeParam = params.get('type')?.trim() || null

  const statusMap: Record<string, string[]> = {
    pending: ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'],
    approved: ['ACTIVE', 'APPROVED'],
    rejected: ['REJECTED'],
    waitlist: ['WAITLISTED', 'WAITLIST'],
    waitlisted: ['WAITLISTED', 'WAITLIST'],
    suspended: ['SUSPENDED'],
  }

  let query = supabase
    .from('applications')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(5000)

  if (statusParam !== 'all') {
    const dbStatuses = statusMap[statusParam] || [statusParam.toUpperCase()]
    query = query.in('status', dbStatuses)
  }

  if (typeParam) {
    query = query.eq('account_type', typeParam)
  }

  const { data: applications, error } = await query

  if (error) {
    console.error(`[${requestId}] export error:`, error)
    return adminError('Failed to export applications', 500, requestId)
  }

  let list = (applications ?? []) as Array<Record<string, unknown>>

  if (searchParam) {
    const searchLower = searchParam.toLowerCase()
    list = list.filter((a) => {
      const name = String(a.name ?? '').toLowerCase()
      const email = String(a.email ?? '').toLowerCase()
      const username = String(a.username ?? '').toLowerCase()
      return name.includes(searchLower) || email.includes(searchLower) || username.includes(searchLower)
    })
  }

  const userIds = [...new Set(list.map((a) => a.user_id).filter(Boolean) as string[])]
  const profilesMap: Record<string, Record<string, unknown>> = {}
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, username, email, niche')
      .in('id', userIds)
    if (profilesData?.length) {
      for (const p of profilesData as Array<Record<string, unknown>>) {
        const key = String(p.id ?? '').toLowerCase()
        if (key) profilesMap[key] = p
      }
    }
  }

  const rows = list.map((a) => {
    const uid = a.user_id != null ? String(a.user_id).toLowerCase() : ''
    const profile = profilesMap[uid] || {}
    return {
      id: a.id,
      full_name: profile.name ?? a.name ?? '',
      email: profile.email ?? a.email ?? '',
      account_type: a.account_type ?? a.type ?? '',
      niche: profile.niche ?? a.niche ?? '',
      status: a.status ?? '',
      created_at: a.submitted_at ?? a.created_at ?? '',
      referrer_username: a.referrer_username ?? '',
    }
  })

  const headers = ['id', 'full_name', 'email', 'account_type', 'niche', 'status', 'created_at', 'referrer_username']
  const csvRows = rows.map((r) => headers.map((h) => escapeCsvCell(r[h as keyof typeof r])))
  const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n')

  const filename = `applications-${new Date().toISOString().slice(0, 10)}.csv`
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
