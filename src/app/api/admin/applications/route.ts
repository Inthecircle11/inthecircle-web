import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getRequestId, jsonError } from '@/lib/request-id'
import { getServiceRoleClient } from '@/lib/supabase-service'
import {
  getCountsCache,
  setCountsCache,
  getAppsCache,
  COUNTS_CACHE_TTL_MS,
  APPS_CACHE_TTL_MS,
} from '@/lib/admin-applications-cache'

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
  const nowIso = now.toISOString()

  // Cache key must include assignment filter so "all" vs "assigned_to_me" vs "unassigned" don't share cache
  const cacheKey = `${statusParam}-${filter}-${page}-${limit}`
  let counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number; total: number }
  let countsErrorFlag = false
  const countsCache = getCountsCache()
  if (countsCache && Date.now() - countsCache.at < COUNTS_CACHE_TTL_MS) {
    counts = countsCache.counts
  } else {
    const { data: countsData, error: countsError } = await supabase.rpc('admin_get_application_counts').single()
    if (countsError || !countsData) {
      if (countsError) {
        console.error('[admin applications] admin_get_application_counts error:', countsError.message)
        countsErrorFlag = true
      }
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
    setCountsCache({ at: Date.now(), counts })
  }

  // Direct query to applications table with profile join
  const appsCache = getAppsCache()
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

    // First get applications (apply assignment filter in DB so we get the right page of rows)
    let appsQuery = supabase
      .from('applications')
      .select('*')
      .order('submitted_at', { ascending: true })

    if (statusParam !== 'all') {
      const dbStatuses = statusMap[statusParam] || [statusParam.toUpperCase()]
      appsQuery = appsQuery.in('status', dbStatuses)
    }

    const currentUserId = result.user.id
    if (filter === 'unassigned') {
      appsQuery = appsQuery.or(`assigned_to.is.null,assignment_expires_at.lt.${nowIso}`)
    } else if (filter === 'assigned_to_me') {
      appsQuery = appsQuery.eq('assigned_to', currentUserId).gte('assignment_expires_at', nowIso)
    }

    appsQuery = appsQuery.range(offset, offset + limit - 1)

    const { data: appsData, error: appsError } = await appsQuery

    if (appsError) {
      console.error('[admin 500] applications list', appsError)
      return jsonError(req, { error: 'Failed to fetch applications' }, 500)
    }

    // Get user IDs and fetch profiles (normalize UUIDs to lowercase for reliable lookup)
    const userIds = [...new Set((appsData ?? []).map((a: Record<string, unknown>) => a.user_id).filter(Boolean) as string[])]
    const profilesMap: Record<string, Record<string, unknown>> = {}
    
    if (userIds.length > 0) {
      const cols = 'id, name, username, email, profile_image_url, bio, niche, phone'
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(cols)
        .in('id', userIds)
      
      if (profilesError) {
        console.error('[admin applications] profiles fetch', profilesError)
        return jsonError(req, { error: 'Failed to load profiles' }, 500)
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
        referrer_username: a.referrer_username ?? null,
        instagram_username: a.instagram_username ?? null,
        follower_count: a.follower_count ?? null,
      }
    })

    // Enrich email from auth.users for rows that still have no email (profile may not store it)
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
        // RPC may not exist yet (migration not run); continue without auth email enrichment
      }
    }
    
    appsCache.set(cacheKey, { at: Date.now(), data: list })
    
    // Clean old cache entries (keep max 20)
    if (appsCache.size > 20) {
      const oldest = [...appsCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) appsCache.delete(oldest[0])
    }
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

  // Map to response format (profile + auth email + application fields)
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
  return addHeader(NextResponse.json({ applications, total, page, limit, counts, countsError: countsErrorFlag }))
}
