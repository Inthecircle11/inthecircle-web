import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminRoleName } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** CACHING DISABLED: Was causing stale data issues. Re-enable after metrics are stable. */
const CACHE_TTL_MS = 0  // Disabled - was 60_000
let overviewCache: { at: number; body: Record<string, unknown> } | null = null

/** GET - Ultra-fast overview stats using single RPC call. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  // Return cached data if fresh (60s TTL)
  if (overviewCache && Date.now() - overviewCache.at < CACHE_TTL_MS) {
    const res = NextResponse.json(overviewCache.body)
    res.headers.set('X-Cache', 'HIT')
    return res
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  // Always use admin_get_overview_counts (the accurate source) + admin_get_overview_app_stats
  // Note: admin_get_all_stats exists but returns outdated data (wrong verifiedCount, missing newUsersLast7d)
  let parsed: { stats: Record<string, number>; overview: Record<string, number>; activeToday?: number | string }
  {
    const [appRes, countsRes] = await Promise.all([
      supabase.rpc('admin_get_overview_app_stats').single(),
      supabase.rpc('admin_get_overview_counts').single(),
    ])
    // TABLE-returning RPCs can return array of one row; .single() gives that row, but be defensive
    const app = (Array.isArray(appRes.data) ? appRes.data[0] : appRes.data) ?? {}
    const countsRow = (Array.isArray(countsRes.data) ? countsRes.data[0] : countsRes.data) ?? {}
    const appData = app as { total?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number }
    const c = countsRow as { total_users?: number; verified_count?: number; new_users_24h?: number; new_users_7d?: number; new_users_30d?: number; total_threads?: number; total_messages?: number; applications_7d?: number; applications_approved_7d?: number }
    const total = Number(appData.total) || 0
    const approved = Number(appData.approved) || 0
    const rejected = Number(appData.rejected) || 0
    const waitlisted = Number(appData.waitlisted) || 0
    const suspended = Number(appData.suspended) || 0
    
    // Get new_users_7d - if RPC doesn't return it, it will be null/undefined
    // We need to ensure it's at least as large as new_users_24h (logical constraint)
    const newUsers24h = Number(c.new_users_24h) || 0
    let newUsers7d = Number(c.new_users_7d) || 0
    // Sanity check: 7d must be >= 24h (if not, RPC is outdated)
    if (newUsers7d < newUsers24h) {
      newUsers7d = newUsers24h
    }
    
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
        totalUsers: Number(c.total_users) || 0,
        verifiedCount: Number(c.verified_count) || 0,
        newUsersLast24h: newUsers24h,
        newUsersLast7d: newUsers7d,
        newUsersLast30d: Number(c.new_users_30d) || 0,
        totalThreadCount: Number(c.total_threads) || 0,
        totalMessageCount: Number(c.total_messages) || 0,
        applicationsSubmittedLast7d: Number(c.applications_7d) || 0,
        applicationsApprovedLast7d: Number(c.applications_approved_7d) || 0,
      },
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
    if (sessionsData && Array.isArray(sessionsData) && sessionsData.length > 0) {
      const list = sessionsData as Array<{ user_id: string; email: string | null; last_active_at: string }>
      const userIds = [...new Set(list.map((r) => r.user_id))]
      const profiles: Record<string, { username: string | null; name: string | null }> = {}
      if (userIds.length > 0) {
        const { data: profData } = await supabase.from('profiles').select('id, username, name').in('id', userIds)
        ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
          profiles[p.id] = { username: p.username, name: p.name }
        })
      }
      activeSessions = {
        count: list.length,
        users: list.map((r) => ({
          user_id: r.user_id,
          email: r.email ?? null,
          username: profiles[r.user_id]?.username ?? null,
          name: profiles[r.user_id]?.name ?? null,
          last_active_at: r.last_active_at,
        })),
        minutes: 15,
      }
    }
  }

  const body = {
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

  overviewCache = { at: Date.now(), body }
  const res = NextResponse.json(body)
  res.headers.set('X-Cache', 'MISS')
  return res
}
