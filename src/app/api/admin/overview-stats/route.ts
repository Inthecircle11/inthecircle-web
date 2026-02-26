import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminRoleName } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 30_000 // 30 seconds
let overviewCache: { at: number; body: Record<string, unknown> } | null = null

/** GET - Lightweight overview stats for fast initial paint. Requires read_applications. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  if (overviewCache && Date.now() - overviewCache.at < CACHE_TTL_MS) {
    return NextResponse.json(overviewCache.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const db = supabase

  // Single-query RPC for app counts (fast path). Falls back to per-status counts if RPC missing or column differs.
  async function getApplicationCounts(statusCol: string) {
    const [totalRes, approvedRes, rejectedRes, waitlistedRes, suspendedRes] = await Promise.all([
      db.from('applications').select('*', { count: 'exact', head: true }),
      db.from('applications').select('*', { count: 'exact', head: true }).in(statusCol, ['ACTIVE', 'APPROVED']),
      db.from('applications').select('*', { count: 'exact', head: true }).eq(statusCol, 'REJECTED'),
      db.from('applications').select('*', { count: 'exact', head: true }).eq(statusCol, 'WAITLISTED'),
      db.from('applications').select('*', { count: 'exact', head: true }).eq(statusCol, 'SUSPENDED'),
    ])
    const hasColumnError = [totalRes, approvedRes, rejectedRes, waitlistedRes, suspendedRes].some(
      (r) => r.error && ((r.error as { code?: string }).code === '42703' || (r.error as { message?: string }).message?.includes('column'))
    )
    if (hasColumnError) return null
    const total = totalRes.count ?? 0
    const approved = approvedRes.count ?? 0
    const rejected = rejectedRes.count ?? 0
    const waitlisted = waitlistedRes.count ?? 0
    const suspended = suspendedRes.count ?? 0
    const pending = Math.max(0, total - approved - rejected - waitlisted - suspended)
    return { total, pending, approved, rejected, waitlisted, suspended }
  }

  // Run all overview data in parallel: app stats, active today, active sessions, card counts
  const [overviewAppRes, activeTodayRes, activeSessionsRes, overviewCountsRes] = await Promise.all([
    db.rpc('admin_get_overview_app_stats').maybeSingle(),
    db.rpc('admin_get_active_today_count'),
    (async () => {
      if (!hasPermission(result.roles as AdminRoleName[], ADMIN_PERMISSIONS.active_sessions)) return null
      const { data, error } = await db.rpc('get_active_sessions', { active_minutes: 15 })
      if (error) return null
      const list = (data ?? []) as Array<{ user_id: string; email: string | null; last_active_at: string }>
      const userIds = [...new Set(list.map((r) => r.user_id))]
      const profiles: Record<string, { username: string | null; name: string | null }> = {}
      if (userIds.length > 0) {
        const { data: profData } = await db
          .from('profiles')
          .select('id, username, name')
          .in('id', userIds)
        ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
          profiles[p.id] = { username: p.username, name: p.name }
        })
      }
      const users = list.map((r) => ({
        user_id: r.user_id,
        email: r.email ?? null,
        username: profiles[r.user_id]?.username ?? null,
        name: profiles[r.user_id]?.name ?? null,
        last_active_at: r.last_active_at,
      }))
      return { count: users.length, users, minutes: 15 }
    })(),
    db.rpc('admin_get_overview_counts').maybeSingle(),
  ])

  let stats: { total: number; pending: number; approved: number; rejected: number; waitlisted: number; suspended: number }
  const raw = overviewAppRes?.data
  const row = Array.isArray(raw) && raw[0] != null ? raw[0] : (raw as { total?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number } | null)
  if (row != null && (typeof row.total === 'number' || typeof (row as { total?: unknown }).total === 'number')) {
    const r = row as { total?: number; approved?: number; rejected?: number; waitlisted?: number; suspended?: number }
    const total = Number(r.total)
    const approved = Number(r.approved ?? 0)
    const rejected = Number(r.rejected ?? 0)
    const waitlisted = Number(r.waitlisted ?? 0)
    const suspended = Number(r.suspended ?? 0)
    stats = {
      total,
      pending: Math.max(0, total - approved - rejected - waitlisted - suspended),
      approved,
      rejected,
      waitlisted,
      suspended,
    }
  } else {
    const statsWithStatus = await getApplicationCounts('status')
    if (statsWithStatus) {
      stats = statsWithStatus
    } else {
      const statsWithAppStatus = await getApplicationCounts('application_status')
      if (!statsWithAppStatus) {
        return NextResponse.json(
          { error: 'Applications table missing status or application_status column' },
          { status: 500 }
        )
      }
      stats = statsWithAppStatus
    }
  }

  const activeToday =
    activeTodayRes?.data != null && Array.isArray(activeTodayRes.data) && activeTodayRes.data[0] != null
      ? Number((activeTodayRes.data[0] as { active_count?: number | string }).active_count) || null
      : null

  const countsRaw = overviewCountsRes?.data
  const countsRow = Array.isArray(countsRaw) && countsRaw[0] != null ? countsRaw[0] : (countsRaw as Record<string, unknown> | null)
  const totalUsersVal = countsRow != null ? (countsRow.total_users as number | string | undefined) : undefined
  const overviewCounts =
    totalUsersVal != null && (typeof totalUsersVal === 'number' || typeof totalUsersVal === 'string')
      ? {
          totalUsers: Number(totalUsersVal),
          verifiedCount: Number(countsRow!.verified_count ?? 0),
          newUsersLast24h: Number(countsRow!.new_users_24h ?? 0),
          newUsersLast7d: countsRow!.new_users_7d != null ? Number(countsRow!.new_users_7d) : undefined,
          newUsersLast30d: Number(countsRow!.new_users_30d ?? 0),
          totalThreadCount: Number(countsRow!.total_threads ?? 0),
          totalMessageCount: Number(countsRow!.total_messages ?? 0),
          applicationsSubmittedLast7d: Number(countsRow!.applications_7d ?? 0),
          applicationsApprovedLast7d: Number(countsRow!.applications_approved_7d ?? 0),
        }
      : null

  const body = {
    stats,
    activeToday,
    activeSessions: activeSessionsRes,
    ...(overviewCounts ? { overviewCounts } : {}),
  }
  overviewCache = { at: Date.now(), body }
  return NextResponse.json(body)
}
