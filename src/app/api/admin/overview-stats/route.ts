import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminRoleName } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** Cache TTL: 30 seconds for overview stats (balance between freshness and performance). Keyed by active_sessions permission so cache is not shared across permission boundaries. */
const CACHE_TTL_MS = 30_000
const overviewCacheMap = new Map<string, { at: number; body: Record<string, unknown> }>()

/** GET - Ultra-fast overview stats using single RPC call. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const canViewActiveSessions = hasPermission(result.roles as AdminRoleName[], ADMIN_PERMISSIONS.active_sessions)
  const cacheKey = `overview:${canViewActiveSessions}`
  const cached = overviewCacheMap.get(cacheKey)

  // Return cached data if fresh (30s TTL); cache is keyed by permission so activeSessions is never leaked
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const res = NextResponse.json(cached.body)
    res.headers.set('X-Cache', 'HIT')
    return res
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  // Always run direct DB counts in parallel with RPCs; use them when RPCs fail or return zeros.
  const now = new Date()
  const iso24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const iso7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const iso30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [appRes, countsRes, totalUsersRes, verifiedRes, new24hRes, new7dRes, new30dRes, threadsRes, messagesRes, apps7dRes, appsApproved7dRes] = await Promise.all([
    supabase.rpc('admin_get_overview_app_stats').single(),
    supabase.rpc('admin_get_overview_counts').single(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', iso24h),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', iso7d),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', iso30d),
    supabase.from('message_threads').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
    supabase.from('applications').select('*', { count: 'exact', head: true }).gte('submitted_at', iso7d),
    supabase.from('applications').select('*', { count: 'exact', head: true }).gte('submitted_at', iso7d).in('status', ['APPROVED', 'ACTIVE']),
  ])

  const appError = appRes.error != null
  const countsError = countsRes.error != null
  const useRpc = !appError && !countsError

  let parsed: { stats: Record<string, number>; overview: Record<string, number>; activeToday?: number | string }

  const directOverview = {
    totalUsers: totalUsersRes.count ?? 0,
    verifiedCount: verifiedRes.count ?? 0,
    newUsersLast24h: new24hRes.count ?? 0,
    newUsersLast7d: new7dRes.count ?? 0,
    newUsersLast30d: new30dRes.count ?? 0,
    totalThreadCount: threadsRes.count ?? 0,
    totalMessageCount: messagesRes.count ?? 0,
    applicationsSubmittedLast7d: apps7dRes.count ?? 0,
    applicationsApprovedLast7d: appsApproved7dRes.count ?? 0,
  }

  if (useRpc) {
    const app = (Array.isArray(appRes.data) ? appRes.data[0] : appRes.data) ?? {}
    const countsRow = (Array.isArray(countsRes.data) ? countsRes.data[0] : countsRes.data) ?? {}
    const appData = app as { total?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number }
    const c = countsRow as { total_users?: number; verified_count?: number; new_users_24h?: number; new_users_7d?: number; new_users_30d?: number; total_threads?: number; total_messages?: number; applications_7d?: number; applications_approved_7d?: number }
    const total = Number(appData.total) || 0
    const approved = Number(appData.approved) || 0
    const rejected = Number(appData.rejected) || 0
    const waitlisted = Number(appData.waitlisted) || 0
    const suspended = Number(appData.suspended) || 0
    let newUsers7d = Number(c.new_users_7d) || 0
    const newUsers24h = Number(c.new_users_24h) || 0
    if (newUsers7d < newUsers24h) newUsers7d = newUsers24h
    parsed = {
      stats: {
        total,
        pending: Math.max(0, total - approved - rejected - waitlisted - suspended),
        approved,
        rejected,
        waitlisted,
        suspended,
      },
      overview: {
        totalUsers: Number(c.total_users) || directOverview.totalUsers,
        verifiedCount: (Number(c.verified_count) ?? directOverview.verifiedCount) || directOverview.verifiedCount,
        newUsersLast24h: newUsers24h || directOverview.newUsersLast24h,
        newUsersLast7d: newUsers7d || directOverview.newUsersLast7d,
        newUsersLast30d: Number(c.new_users_30d) || directOverview.newUsersLast30d,
        totalThreadCount: Number(c.total_threads) || directOverview.totalThreadCount,
        totalMessageCount: Number(c.total_messages) || directOverview.totalMessageCount,
        applicationsSubmittedLast7d: Number(c.applications_7d) || directOverview.applicationsSubmittedLast7d,
        applicationsApprovedLast7d: (Number(c.applications_approved_7d) ?? directOverview.applicationsApprovedLast7d) || directOverview.applicationsApprovedLast7d,
      },
    }
  } else {
    const { data: statsData } = await supabase.rpc('admin_get_application_stats')
    const statsRow = Array.isArray(statsData) ? statsData[0] : statsData
    const row = statsRow as { total?: number; pending?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number } | null
    parsed = {
      stats: {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        approved: Number(row?.approved ?? 0),
        rejected: Number(row?.rejected ?? 0),
        waitlisted: Number(row?.waitlisted ?? 0),
        suspended: Number(row?.suspended ?? 0),
      },
      overview: { ...directOverview },
    }
  }
  
  // Sanity check: ensure new_users_7d >= new_users_24h (logical constraint)
  if ((parsed.overview?.newUsersLast7d ?? 0) < (parsed.overview?.newUsersLast24h ?? 0)) {
    parsed.overview.newUsersLast7d = parsed.overview.newUsersLast24h
  }
  
  // Fallback for verified count: if RPC returns 0, query profiles.is_verified directly
  // This handles the case where the old RPC uses verification_requests instead of profiles.is_verified
  if ((parsed.overview?.verifiedCount ?? 0) === 0) {
    const { count: verifiedFromProfiles } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true)
    if (verifiedFromProfiles != null && verifiedFromProfiles > 0) {
      parsed.overview.verifiedCount = verifiedFromProfiles
    }
  }

  // If admin_get_all_stats didn't return activeToday, fetch it from dedicated RPC (same DB, no extra permission)
  let activeToday: number | null =
    parsed.activeToday != null && parsed.activeToday !== ''
      ? Number(parsed.activeToday)
      : null
  if (activeToday === null) {
    const { data: activeTodayRow } = await supabase.rpc('admin_get_active_today_count').maybeSingle()
    if (activeTodayRow != null && typeof (activeTodayRow as { active_count?: unknown }).active_count !== 'undefined') {
      const raw = (activeTodayRow as { active_count: number | string }).active_count
      activeToday =
        typeof raw === 'number'
          ? Math.max(0, Math.floor(raw))
          : Math.max(0, parseInt(String(raw), 10) || 0)
    }
    // Fallback when admin_get_active_today_count is missing (e.g. migration not run)
    if (activeToday === null) {
      const { data: rows } = await supabase.rpc('get_active_sessions', { active_minutes: 24 * 60 })
      const list = (rows ?? []) as Array<{ user_id: string }>
      activeToday = new Set(list.map((r) => r.user_id)).size
    }
  }

  // Fetch active sessions separately (requires profile join, but only if user has permission)
  let activeSessions = null
  if (hasPermission(result.roles as AdminRoleName[], ADMIN_PERMISSIONS.active_sessions)) {
    const { data: sessionsData } = await supabase.rpc('get_active_sessions', { active_minutes: 15 })
    if (sessionsData && Array.isArray(sessionsData)) {
      if (sessionsData.length === 0) {
        // RPC worked but nobody is active right now — return an explicit empty result
        // so the UI can show "No one active" instead of "Loading…"
        activeSessions = { count: 0, users: [], minutes: 15 }
      } else {
      const list = sessionsData as Array<{ user_id: string; email: string | null; last_active_at: string }>
      // Deduplicate by user_id: get_active_sessions returns one row per session, so a user
      // on two devices appears twice. Keep the most-recent session (list is ordered DESC).
      const seenUserIds = new Set<string>()
      const dedupedList = list.filter((r) => {
        if (seenUserIds.has(r.user_id)) return false
        seenUserIds.add(r.user_id)
        return true
      })
      const userIds = dedupedList.map((r) => r.user_id)
      const profiles: Record<string, { username: string | null; name: string | null }> = {}
      if (userIds.length > 0) {
        const { data: profData } = await supabase.from('profiles').select('id, username, name').in('id', userIds)
        ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
          profiles[p.id] = { username: p.username, name: p.name }
        })
      }
      activeSessions = {
        count: dedupedList.length,
        users: dedupedList.map((r) => ({
          user_id: r.user_id,
          email: r.email ?? null,
          username: profiles[r.user_id]?.username ?? null,
          name: profiles[r.user_id]?.name ?? null,
          last_active_at: r.last_active_at,
        })),
        minutes: 15,
      }
      }  // end else (sessions.length > 0)
    }  // end if (sessionsData is array)
  }  // end if (hasPermission active_sessions)

  const payload = {
    stats: {
      total: Number(parsed.stats?.total) || 0,
      pending: Number(parsed.stats?.pending) || 0,
      approved: Number(parsed.stats?.approved) || 0,
      rejected: Number(parsed.stats?.rejected) || 0,
      waitlisted: Number(parsed.stats?.waitlisted) || 0,
      suspended: Number(parsed.stats?.suspended) || 0,
    },
    activeToday: activeToday ?? 0,
    activeSessions,
    overviewCounts: {
      totalUsers: Number(parsed.overview?.totalUsers) || 0,
      verifiedCount: Number(parsed.overview?.verifiedCount) || 0,
      newUsersLast24h: Number(parsed.overview?.newUsersLast24h) || 0,
      newUsersLast7d: Number(parsed.overview?.newUsersLast7d) || 0,
      newUsersLast30d: Number(parsed.overview?.newUsersLast30d) || 0,
      totalThreadCount: Number(parsed.overview?.totalThreadCount) || 0,
      totalMessageCount: Number(parsed.overview?.totalMessageCount) || 0,
      applicationsSubmittedLast7d: Number(parsed.overview?.applicationsSubmittedLast7d) || 0,
      applicationsApprovedLast7d: Number(parsed.overview?.applicationsApprovedLast7d) || 0,
    },
  }

  const body = { ok: true as const, data: payload }
  overviewCacheMap.set(cacheKey, { at: Date.now(), body })
  const res = NextResponse.json(body)
  res.headers.set('X-Cache', 'MISS')
  return res
}
