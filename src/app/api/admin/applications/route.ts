import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getRequestId, jsonError, jsonError500 } from '@/lib/request-id'

export const dynamic = 'force-dynamic'

/** Phase 13: True pagination. Default limit 50, max 200. When page is omitted, legacy behavior returns array only (temporary). */
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function normalizeApplicationStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase()
  if (['ACTIVE', 'APPROVED'].includes(s)) return 'ACTIVE'
  if (['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'DRAFT'].includes(s)) return s || 'PENDING'
  if (['REJECTED', 'WAITLISTED', 'SUSPENDED'].includes(s)) return s
  return s || 'PENDING'
}

/** GET - Applications with pagination (page, limit) or legacy array. Requires read_applications. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const requestId = getRequestId(req)
  const addHeader = (res: NextResponse) => {
    res.headers.set('x-request-id', requestId)
    return res
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return jsonError(req, { error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, 500)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const params = req.nextUrl.searchParams
  const sort = params.get('sort') || 'overdue'
  const filter = params.get('filter') || 'all'
  const statusParam = (params.get('status') || 'all').toLowerCase()
  const pageParam = params.get('page')
  const limitParam = params.get('limit')
  const usePagination = pageParam != null && pageParam !== ''
  const page = usePagination ? Math.max(1, parseInt(pageParam!, 10) || 1) : 1
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const currentUserId = result.user.id
  const now = new Date()

  /** DB status values for filtering by UI status (status tab). */
  const statusValuesFor = (uiStatus: string): string[] => {
    switch (uiStatus) {
      case 'approved':
        return ['ACTIVE', 'APPROVED', 'active', 'approved']
      case 'pending':
        return ['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'DRAFT', 'pending', 'pending_review', 'submitted', 'draft']
      case 'rejected':
        return ['REJECTED', 'rejected']
      case 'waitlisted':
        return ['WAITLISTED', 'waitlisted']
      case 'suspended':
        return ['SUSPENDED', 'suspended']
      default:
        return []
    }
  }

  const selectColsWithAssignment = 'id, user_id, status, submitted_at, review_notes, why_join, what_to_offer, collaboration_goals, updated_at, assigned_to, assigned_at, assignment_expires_at'
  const selectColsLegacy = 'id, user_id, status, submitted_at, review_notes, why_join, what_to_offer, collaboration_goals'
  let useAssignment = true
  const from = (page - 1) * limit
  const statusFilterValues = statusParam !== 'all' ? statusValuesFor(statusParam) : []

  // Run counts and list query in parallel to minimize latency (was: counts then list = 2 waves)
  let total = 0
  /** Global counts by normalized status for filter tabs and sidebar badge */
  let counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } = {
    pending: 0,
    approved: 0,
    rejected: 0,
    waitlisted: 0,
    suspended: 0,
  }
  let rawData: Array<Record<string, unknown>> | null = null
  let listQueryError: unknown = null

  if (usePagination) {
    const countByStatus = async (statusValues: string[]): Promise<number> => {
      if (statusValues.length === 0) return 0
      const { count, error } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', statusValues)
      if (error) return 0
      return count ?? 0
    }
    let listQuery = supabase
      .from('applications')
      .select(useAssignment ? selectColsWithAssignment : selectColsLegacy)
    if (statusFilterValues.length > 0) {
      listQuery = listQuery.in('status', statusFilterValues)
    }
    const listPromise = listQuery
      .order('submitted_at', { ascending: false })
      .range(from, from + limit - 1)
      .then((res) => {
        if (res.error) {
          listQueryError = res.error
          return [] as Array<Record<string, unknown>>
        }
        return ((res.data ?? []) as unknown) as Array<Record<string, unknown>>
      })

    const [totalResult, approvedCount, pendingCount, rejectedCount, waitlistedCount, suspendedCount, listData] = await Promise.all([
      (async (): Promise<number> => {
        const r = await supabase.from('applications').select('*', { count: 'exact', head: true })
        if (r.error && (r.error as { code?: string }).code === '42703') {
          const r2 = await supabase.from('applications').select('*', { count: 'exact', head: true })
          return r2.count ?? 0
        }
        return r.count ?? 0
      })(),
      countByStatus(['ACTIVE', 'APPROVED', 'active', 'approved']),
      countByStatus(['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'DRAFT', 'pending', 'pending_review', 'submitted', 'draft']),
      countByStatus(['REJECTED', 'rejected']),
      countByStatus(['WAITLISTED', 'waitlisted']),
      countByStatus(['SUSPENDED', 'suspended']),
      listPromise,
    ])

    total = typeof totalResult === 'number' ? totalResult : 0
    counts = {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      waitlisted: waitlistedCount,
      suspended: suspendedCount,
    }
    if (statusParam !== 'all') {
      const key = statusParam as keyof typeof counts
      if (key in counts) total = counts[key]
    }
    rawData = listData

    if (listQueryError && (listQueryError as { code?: string }).code === '42703' && useAssignment) {
      useAssignment = false
      let retryQuery = supabase.from('applications').select(selectColsLegacy)
      if (statusFilterValues.length > 0) retryQuery = retryQuery.in('status', statusFilterValues)
      const retry = await retryQuery.order('submitted_at', { ascending: false }).range(from, from + limit - 1)
      if (retry.error) return jsonError500(req, retry.error)
      rawData = (retry.data ?? []) as unknown as Array<Record<string, unknown>>
    } else if (listQueryError) {
      return jsonError500(req, listQueryError as Error)
    }
  } else {
    // Legacy: no page param — fetch list only (no counts)
    let legacyQuery = supabase
      .from('applications')
      .select(useAssignment ? selectColsWithAssignment : selectColsLegacy)
    if (statusFilterValues.length > 0) legacyQuery = legacyQuery.in('status', statusFilterValues)
    const { data: legacyData, error: legacyError } = await legacyQuery
      .order('submitted_at', { ascending: false })
      .limit(limit)
    if (legacyError) {
      if ((legacyError as { code?: string }).code === '42703' && useAssignment) {
        useAssignment = false
        let retryQ = supabase.from('applications').select(selectColsLegacy)
        if (statusFilterValues.length > 0) retryQ = retryQ.in('status', statusFilterValues)
        const retry = await retryQ.order('submitted_at', { ascending: false }).limit(limit)
        if (retry.error) return jsonError500(req, retry.error)
        rawData = (retry.data ?? []) as unknown as Array<Record<string, unknown>>
      } else {
        return jsonError500(req, legacyError)
      }
    } else {
      rawData = (legacyData ?? []) as unknown as Array<Record<string, unknown>>
    }
  }

  let list = (rawData ?? []) as Array<Record<string, unknown>>
  if (filter === 'unassigned') {
    list = list.filter((a) => a.assigned_to == null || (a.assignment_expires_at && new Date(a.assignment_expires_at as string) < now))
  } else if (filter === 'assigned_to_me') {
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
    list = list.filter((a) => a.assigned_to === currentUserId && a.assignment_expires_at && new Date(a.assignment_expires_at as string) >= now)
    list = [...list].sort((a, b) => priority(a.submitted_at as string) - priority(b.submitted_at as string) || new Date((a.submitted_at as string) ?? 0).getTime() - new Date((b.submitted_at as string) ?? 0).getTime())
  } else {
    list = [...list].sort((a, b) => priority(a.submitted_at as string) - priority(b.submitted_at as string) || new Date((a.submitted_at as string) ?? 0).getTime() - new Date((b.submitted_at as string) ?? 0).getTime())
  }

  const userIds = [...new Set(list.map((r) => r.user_id as string))]
  const profileById = new Map<string, Record<string, unknown>>()
  const BATCH_SIZE = 100
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, name, username, email, profile_image_url, about, niche, phone')
      .in('id', batch)
    if (profError) return jsonError500(req, profError)
    for (const p of profiles || []) {
      profileById.set(p.id as string, p as Record<string, unknown>)
    }
  }

  const applications = list.map((a) => {
    const p = profileById.get(a.user_id as string) as Record<string, unknown> | undefined
    const rawStatus = a.status ?? (a as Record<string, unknown>).application_status
    return {
      id: a.id,
      user_id: a.user_id,
      name: p?.name ?? '',
      username: p?.username ?? '',
      email: p?.email ?? '',
      profile_image_url: p?.profile_image_url ?? null,
      bio: p?.about ?? '',
      niche: p?.niche ?? '',
      application_date: a.submitted_at ?? '',
      status: normalizeApplicationStatus(rawStatus),
      review_notes: a.review_notes ?? null,
      referrer_username: null,
      why_join: a.why_join ?? null,
      what_to_offer: a.what_to_offer ?? null,
      collaboration_goals: a.collaboration_goals ?? null,
      phone: p?.phone ?? null,
      instagram_username: null,
      follower_count: null,
      updated_at: a.updated_at ?? null,
      assigned_to: a.assigned_to ?? null,
      assigned_at: a.assigned_at ?? null,
      assignment_expires_at: a.assignment_expires_at ?? null,
    }
  })

  // Legacy: when page not provided, return array only for backward compatibility (temporary).
  if (!usePagination) {
    return addHeader(NextResponse.json(applications))
  }
  return addHeader(NextResponse.json({ applications, total, page, limit, counts }))
}
