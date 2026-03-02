import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminRoleName } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** AGGRESSIVE CACHING: 60 seconds for overview stats (data doesn't change that fast) */
const CACHE_TTL_MS = 60_000
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

  // SINGLE RPC CALL - returns all stats in one database round-trip
  const { data: allStats, error } = await supabase.rpc('admin_get_all_stats').single()
  
  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }

  const parsed = allStats as { stats: Record<string, number>; overview: Record<string, number>; activeToday: number }

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
    activeToday: Number(parsed.activeToday) || null,
    activeSessions,
    overviewCounts: {
      totalUsers: Number(parsed.overview?.totalUsers) || 0,
      verifiedCount: Number(parsed.overview?.verifiedCount) || 0,
      newUsersLast24h: Number(parsed.overview?.newUsersLast24h) || 0,
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
