import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getRequestId, jsonError } from '@/lib/request-id'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/** Phase 13: True pagination. Default limit 50, max 200. When page is omitted, legacy behavior returns array only (temporary). */
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/** Cache TTL: 30s for counts, 15s for application lists (balance freshness and performance) */
let countsCache: { at: number; counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number; total: number } } | null = null
const COUNTS_CACHE_TTL_MS = 30_000

/** Cache for application lists by status+page */
const appsCache = new Map<string, { at: number; data: Array<Record<string, unknown>> }>()
const APPS_CACHE_TTL_MS = 15_000

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

  const supabase = getServiceRoleClient() ?? createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const params = req.nextUrl.searchParams
  const sort = params.get('sort') || 'overdue'
  const filter = params.get('filter') || 'all'
  // Map UI status to DB status (UI uses 'waitlisted', DB uses 'waitlist')
  const rawStatus = (params.get('status') || 'all').toLowerCase()
  const statusParam = rawStatus === 'waitlisted' ? 'waitlist' : rawStatus
  const pageParam = params.get('page')
  const limitParam = params.get('limit')
  const usePagination = pageParam != null && pageParam !== ''
  const page = usePagination ? Math.max(1, parseInt(pageParam!, 10) || 1) : 1
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const now = new Date()
  const offset = (page - 1) * limit

  // OPTIMIZED: Use single RPC for counts (with 30s cache) instead of 6 separate queries
  let counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number; total: number }
  
  if (countsCache && Date.now() - countsCache.at < COUNTS_CACHE_TTL_MS) {
    counts = countsCache.counts
  } else {
    const { data: countsData, error: countsError } = await supabase.rpc('admin_get_application_counts').single()
    if (countsError || !countsData) {
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
    countsCache = { at: Date.now(), counts }
  }

  // Direct query to applications table with profile join
  const cacheKey = `${statusParam}-${page}-${limit}`
  const cached = appsCache.get(cacheKey)
  
  let list: Array<Record<string, unknown>>
  
  if (cached && Date.now() - cached.at < APPS_CACHE_TTL_MS) {
    list = cached.data
  } else {
    // Status filter mapping - UI names to DB values
    const statusMap: Record<string, string[]> = {
      'pending': ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'],
      'approved': ['ACTIVE', 'APPROVED'],
      'rejected': ['REJECTED'],
      'waitlist': ['WAITLISTED', 'WAITLIST'],
      'waitlisted': ['WAITLISTED', 'WAITLIST'],
      'suspended': ['SUSPENDED'],
    }

    // First get applications
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
      console.error('[admin 500] applications list', appsError)
      return jsonError(req, { error: 'Failed to fetch applications' }, 500)
    }

    // Get user IDs and fetch profiles (normalize UUIDs to lowercase for reliable lookup)
    const userIds = [...new Set((appsData ?? []).map((a: Record<string, unknown>) => a.user_id).filter(Boolean) as string[])]
    let profilesMap: Record<string, Record<string, unknown>> = {}
    
    if (userIds.length > 0) {
      const cols = 'id, name, username, email, profile_image_url, bio, niche, phone'
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(cols)
        .in('id', userIds)
      
      if (profilesError) {
        console.error('[admin applications] profiles fetch', profilesError)
      }
      if (profilesData && profilesData.length > 0) {
        for (const p of profilesData as Array<Record<string, unknown>>) {
          const key = String(p.id ?? '').toLowerCase()
          if (key) profilesMap[key] = p
        }
      }
    }
    
    // Merge applications with profiles (match by user_id normalized to lowercase)
    list = (appsData ?? []).map((a: Record<string, unknown>) => {
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
      }
    })
    
    appsCache.set(cacheKey, { at: Date.now(), data: list })
    
    // Clean old cache entries (keep max 20)
    if (appsCache.size > 20) {
      const oldest = [...appsCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) appsCache.delete(oldest[0])
    }
  }

  // Client-side filtering for assignment (not in DB)
  if (filter === 'unassigned') {
    list = list.filter((a) => a.assigned_to == null || (a.assignment_expires_at && new Date(a.assignment_expires_at as string) < now))
  } else if (filter === 'assigned_to_me') {
    const currentUserId = result.user.id
    list = list.filter((a) => a.assigned_to === currentUserId && a.assignment_expires_at && new Date(a.assignment_expires_at as string) >= now)
  }

  // Priority sorting for overdue items
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

  // Map to response format (profile data already included from RPC)
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
      referrer_username: null,
      why_join: a.why_join ?? null,
      what_to_offer: a.what_to_offer ?? null,
      collaboration_goals: a.collaboration_goals ?? null,
      phone: a.phone ?? null,
      instagram_username: null,
      follower_count: null,
      updated_at: a.updated_at ?? null,
      assigned_to: null,
      assigned_at: null,
      assignment_expires_at: null,
    }
  })

  // Determine total for current filter (counts keys use 'waitlisted' not 'waitlist')
  let total = counts.total
  if (statusParam !== 'all') {
    const countsKey = statusParam === 'waitlist' ? 'waitlisted' : statusParam
    const key = countsKey as keyof typeof counts
    if (key in counts) total = counts[key]
  }

  // Legacy: when page not provided, return array only for backward compatibility (temporary).
  if (!usePagination) {
    return addHeader(NextResponse.json(applications))
  }
  return addHeader(NextResponse.json({ applications, total, page, limit, counts }))
}
