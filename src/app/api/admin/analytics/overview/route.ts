import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 60_000
let cache: { at: number; body: Record<string, unknown> } | null = null

export interface Insight {
  type: 'funnel' | 'feature' | 'retention' | 'churn' | 'admin'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  metric_value: number
  comparison_value: number | null
  recommendation: string
  priority_score?: number
}

/** GET - Product Analytics overview for admin dashboard. DAU/WAU/MAU, stickiness, sessions, feature usage, funnels, admin behavior. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_analytics)
  if (forbidden) return forbidden

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.body, { headers: { 'X-Cache': 'HIT' } })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server unavailable' }, { status: 503 })
  }

  const params = req.nextUrl.searchParams
  const days = Math.min(90, Math.max(1, parseInt(params.get('days') || '30', 10)))

  try {
    const [
      dauWauMauRes,
      stickinessRes,
      avgDurationRes,
      sessionsPerUserRes,
      featureUsageRes,
      adminProductivityRes,
      adminTabRes,
      funnelAppRes,
      funnelAdminRes,
      inactiveRes,
      churnRes,
      dailyAggRes,
      insightsRes,
    ] = await Promise.all([
      supabase.rpc('analytics_get_dau_wau_mau', { p_days: days }),
      supabase.rpc('analytics_get_stickiness', { p_date: new Date().toISOString().slice(0, 10) }),
      supabase.rpc('analytics_get_avg_session_duration', { p_days: 7 }),
      supabase.rpc('analytics_get_sessions_per_user', { p_days: 7 }),
      supabase.rpc('analytics_get_feature_usage', { p_days: days, p_limit: 25 }),
      supabase.rpc('analytics_get_admin_productivity', { p_days: days }),
      supabase.rpc('analytics_get_admin_tab_usage', { p_days: days }),
      supabase.rpc('analytics_get_funnel_steps', {
        p_funnel_name: 'App Activation',
        p_user_type: 'app',
        p_from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
        p_to: new Date().toISOString().slice(0, 10),
      }),
      supabase.rpc('analytics_get_funnel_steps', {
        p_funnel_name: 'Admin Review',
        p_user_type: 'admin',
        p_from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
        p_to: new Date().toISOString().slice(0, 10),
      }),
      supabase.rpc('analytics_get_inactive_users', { p_days: 7 }),
      supabase.rpc('analytics_get_churn', {
        p_period1_end: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
        p_period2_end: new Date().toISOString().slice(0, 10),
      }),
      supabase.from('analytics_daily_aggregates').select('date, user_type, metric_name, metric_value').gte('date', new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)).order('date', { ascending: false }).limit(200),
      supabase.rpc('analytics_generate_insights', { p_days: days }),
    ])

    const dauWauMau = (dauWauMauRes.data ?? []) as Array<{ date: string; dau: number; wau: number; mau: number }>
    const latestDau = dauWauMau[0]
    const stickinessRow = Array.isArray(stickinessRes.data) && stickinessRes.data[0] ? (stickinessRes.data[0] as { stickiness?: number }) : null
    const avgDurationRow = Array.isArray(avgDurationRes.data) && avgDurationRes.data[0] ? (avgDurationRes.data[0] as { avg_seconds?: number }) : null
    const sessionsPerUserRow = Array.isArray(sessionsPerUserRes.data) && sessionsPerUserRes.data[0] ? (sessionsPerUserRes.data[0] as { sessions_per_user?: number }) : null
    const inactiveRow = Array.isArray(inactiveRes.data) && inactiveRes.data[0] ? (inactiveRes.data[0] as { inactive_count?: number }) : null

    const body = {
      overview: {
        dau: latestDau?.dau ?? 0,
        wau: latestDau?.wau ?? 0,
        mau: latestDau?.mau ?? 0,
        stickiness: Number(stickinessRow?.stickiness ?? 0),
        avgSessionDurationSeconds: Number(avgDurationRow?.avg_seconds ?? 0),
        sessionsPerUser: Number(sessionsPerUserRow?.sessions_per_user ?? 0),
        inactiveUsers7d: Number(inactiveRow?.inactive_count ?? 0),
        churn: Array.isArray(churnRes.data) && churnRes.data[0]
          ? (churnRes.data[0] as { period1_active: number; period2_active: number; churned: number })
          : { period1_active: 0, period2_active: 0, churned: 0 },
      },
      dauWauMau: dauWauMau.slice(0, 30),
      featureUsage: (featureUsageRes.data ?? []) as Array<{ feature_name: string; event_name: string; unique_users: number; total_events: number }>,
      adminProductivity: (adminProductivityRes.data ?? []) as Array<{ admin_user_id: string; event_count: number; session_count: number; unique_days: number }>,
      adminTabUsage: (adminTabRes.data ?? []) as Array<{ feature_name: string; event_count: number; unique_admins: number }>,
      funnelApp: (funnelAppRes.data ?? []) as Array<{ step_index: number; step_event_name: string; unique_users: number; conversion_rate_from_previous_step?: number | null }>,
      funnelAdmin: (funnelAdminRes.data ?? []) as Array<{ step_index: number; step_event_name: string; unique_users: number; conversion_rate_from_previous_step?: number | null }>,
      dailyAggregates: (dailyAggRes.data ?? []) as Array<{ date: string; user_type: string; metric_name: string; metric_value: number }>,
      insights: (insightsRes.data && typeof insightsRes.data === 'object' && 'insights' in insightsRes.data
        ? (insightsRes.data as { insights?: unknown[] }).insights
        : []) ?? [],
      topInsights: (insightsRes.data && typeof insightsRes.data === 'object' && 'top_insights' in insightsRes.data
        ? (insightsRes.data as { top_insights?: unknown[] }).top_insights
        : []) ?? [],
      _meta: { days, cachedAt: new Date().toISOString() },
    }

    cache = { at: Date.now(), body }
    return NextResponse.json(body, { headers: { 'X-Cache': 'MISS' } })
  } catch (e) {
    console.error('[admin analytics]', e)
    return NextResponse.json({ error: 'Analytics query failed' }, { status: 500 })
  }
}
