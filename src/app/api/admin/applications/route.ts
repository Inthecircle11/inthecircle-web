import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function normalizeApplicationStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase()
  if (['ACTIVE', 'APPROVED'].includes(s)) return 'ACTIVE'
  if (['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'DRAFT'].includes(s)) return s || 'PENDING'
  if (['REJECTED', 'WAITLISTED', 'SUSPENDED'].includes(s)) return s
  return s || 'PENDING'
}

/** GET - Applications with pagination. Always returns { applications, total, page, limit, counts }. No in-memory cache. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const supabase = getServiceRoleClient() ?? createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const params = req.nextUrl.searchParams
  const sort = params.get('sort') || 'overdue'
  const filter = params.get('filter') || 'all'
  const rawStatus = (params.get('status') || 'all').toLowerCase()
  const statusParam = rawStatus === 'waitlisted' ? 'waitlist' : rawStatus
  const pageParam = params.get('page')
  const limitParam = params.get('limit')
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const now = new Date()
  const offset = (page - 1) * limit
  const nowIso = now.toISOString()

  let counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number; total: number }
  const { data: countsData, error: countsError } = await supabase.rpc('admin_get_application_counts').single()
  if (countsError || !countsData) {
    if (countsError) console.error(`[${requestId}]`, countsError.message)
    counts = { pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0, total: 0 }
  } else {
    const cd = countsData as { pending?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number; total?: number }
    counts = {
      pending: Number(cd.pending) || 0,
      approved: Number(cd.approved) || 0,
      rejected: Number(cd.rejected) || 0,
      waitlisted: Number(cd.waitlisted) || 0,
      suspended: Number(cd.suspended) || 0,
      total: Number(cd.total) || 0,
    }
  }

  const statusMap: Record<string, string[]> = {
    pending: ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'],
    approved: ['ACTIVE', 'APPROVED'],
    rejected: ['REJECTED'],
    waitlist: ['WAITLISTED', 'WAITLIST'],
    waitlisted: ['WAITLISTED', 'WAITLIST'],
    suspended: ['SUSPENDED'],
  }

  let appsQuery = supabase
    .from('applications')
    .select('*')
    .order('submitted_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (statusParam !== 'all') {
    const dbStatuses = statusMap[statusParam] || [statusParam.toUpperCase()]
    appsQuery = appsQuery.in('status', dbStatuses)
  }

  const { data: appsData, error: appsError } = await appsQuery

  if (appsError) {
    return adminError('Failed to fetch applications', 500, requestId)
  }

  const userIds = [...new Set((appsData ?? []).map((a: Record<string, unknown>) => a.user_id).filter(Boolean) as string[])]
  const profilesMap: Record<string, Record<string, unknown>> = {}
  if (userIds.length > 0) {
    const cols = 'id, name, username, email, profile_image_url, bio, niche, phone'
    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select(cols).in('id', userIds)
    if (profilesError) return adminError('Failed to load profiles', 500, requestId)
    if (profilesData?.length) {
      for (const p of profilesData as Array<Record<string, unknown>>) {
        const key = String(p.id ?? '').toLowerCase()
        if (key) profilesMap[key] = p
      }
    }
  }

  let list: Array<Record<string, unknown>> = (appsData ?? []).map((a: Record<string, unknown>) => {
    const uid = a.user_id != null ? String(a.user_id).toLowerCase() : ''
    const profile = profilesMap[uid] || {}
    return {
      ...a,
      name: profile.name ?? a.name ?? '',
      username: profile.username ?? a.username ?? '',
      email: profile.email ?? a.email ?? '',
      profile_image_url: profile.profile_image_url ?? a.profile_image_url ?? null,
      bio: profile.bio ?? a.bio ?? '',
      niche: profile.niche ?? a.niche ?? '',
      phone: profile.phone ?? a.phone ?? null,
      referrer_username: a.referrer_username ?? null,
      instagram_username: a.instagram_username ?? null,
      follower_count: a.follower_count ?? null,
    } as Record<string, unknown>
  })

  const needEmail = list.filter((r: Record<string, unknown>) => !(r.email && String(r.email).trim()))
  if (needEmail.length > 0) {
    try {
      const ids = [...new Set(needEmail.map((r: Record<string, unknown>) => r.user_id).filter(Boolean))] as string[]
      const { data: emailRows, error: emailErr } = await supabase.rpc('admin_get_emails_for_user_ids', { p_user_ids: ids })
      if (!emailErr && emailRows) {
        const emailMap: Record<string, string> = {}
        ;(emailRows as Array<{ user_id: string; email: string | null }>).forEach((row) => {
          if (row.email && row.user_id) emailMap[String(row.user_id).toLowerCase()] = row.email
        })
        list = list.map((r: Record<string, unknown>) => {
          if (r.email && String(r.email).trim()) return r
          const uid = r.user_id != null ? String(r.user_id).toLowerCase() : ''
          const authEmail = emailMap[uid]
          return authEmail ? { ...r, email: authEmail } : r
        })
      }
    } catch {
      // RPC may not exist
    }
  }

  if (filter === 'unassigned') {
    list = list.filter((a) => a.assigned_to == null || (a.assignment_expires_at && new Date(a.assignment_expires_at as string) < now))
  } else if (filter === 'assigned_to_me') {
    const currentUserId = result.user.id
    list = list.filter((a) => a.assigned_to === currentUserId && a.assignment_expires_at && new Date(a.assignment_expires_at as string) >= now)
  }

  const priority = (submittedAt: string | null) => {
    if (!submittedAt) return 3
    const age = now.getTime() - new Date(submittedAt).getTime()
    if (age >= 24 * 60 * 60 * 1000) return 1
    if (age >= 6 * 60 * 60 * 1000) return 2
    return 3
  }

  if (sort === 'oldest') {
    list = [...list].sort((a, b) => new Date((a.submitted_at as string) ?? 0).getTime() - new Date((b.submitted_at as string) ?? 0).getTime())
  } else if (sort === 'assigned_to_me') {
    const currentUserId = result.user.id
    list = list.filter((a) => a.assigned_to === currentUserId && a.assignment_expires_at && new Date(a.assignment_expires_at as string) >= now)
    list = [...list].sort((a, b) => priority(a.submitted_at as string) - priority(b.submitted_at as string) || new Date((a.submitted_at as string) ?? 0).getTime() - new Date((b.submitted_at as string) ?? 0).getTime())
  } else {
    list = [...list].sort((a, b) => priority(a.submitted_at as string) - priority(b.submitted_at as string) || new Date((a.submitted_at as string) ?? 0).getTime() - new Date((b.submitted_at as string) ?? 0).getTime())
  }

  const applications = list.map((a) => {
    const rawStatus = a.status
    return {
      id: a.id,
      user_id: a.user_id,
      name: a.name ?? '',
      username: a.username ?? '',
      email: a.email ?? '',
      profile_image_url: a.profile_image_url ?? null,
      bio: a.bio ?? '',
      niche: a.niche ?? '',
      application_date: a.submitted_at ?? '',
      status: normalizeApplicationStatus(rawStatus),
      review_notes: a.review_notes ?? null,
      referrer_username: a.referrer_username ?? null,
      why_join: a.why_join ?? null,
      what_to_offer: a.what_to_offer ?? null,
      collaboration_goals: a.collaboration_goals ?? null,
      phone: a.phone ?? null,
      instagram_username: a.instagram_username ?? null,
      follower_count: a.follower_count ?? null,
      updated_at: a.updated_at ?? null,
      assigned_to: a.assigned_to ?? null,
      assigned_at: a.assigned_at ?? null,
      assignment_expires_at: a.assignment_expires_at ?? null,
    }
  })

  let total = counts.total
  if (statusParam !== 'all') {
    const countsKey = statusParam === 'waitlist' ? 'waitlisted' : statusParam
    const key = countsKey as keyof typeof counts
    if (key in counts) total = counts[key]
  }

  return adminSuccess(
    { applications, total, page, limit, counts },
    requestId
  )
}
