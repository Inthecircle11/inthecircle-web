import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000
let cachedTrend: { at: number; days: number; body: Record<string, unknown> } | null = null

/** GET - Daily application trend for last N days */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '14', 10)))

  // Return cached if fresh and same days param
  if (cachedTrend && Date.now() - cachedTrend.at < CACHE_TTL_MS && cachedTrend.days === days) {
    return NextResponse.json(cachedTrend.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('submitted_at, status')
      .gte('submitted_at', startDate.toISOString())
    
    if (appsError) throw appsError
    
    const dateMap = new Map<string, { total: number; approved: number; rejected: number }>()
    
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const dateStr = d.toISOString().split('T')[0]
      dateMap.set(dateStr, { total: 0, approved: 0, rejected: 0 })
    }
    
    apps?.forEach((app: { submitted_at: string; status: string }) => {
      const dateStr = app.submitted_at.split('T')[0]
      const entry = dateMap.get(dateStr)
      if (entry) {
        entry.total++
        if (app.status === 'APPROVED' || app.status === 'ACTIVE') entry.approved++
        if (app.status === 'REJECTED') entry.rejected++
      }
    })
    
    const trendData = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, counts]) => {
        const d = new Date(dateStr + 'T00:00:00Z')
        const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
        const day = d.getUTCDate()
        return {
          date: `${month} ${day.toString().padStart(2, '0')}`,
          ...counts,
        }
      })
    
    const body = { ok: true, data: trendData, cached_at: new Date().toISOString() }
    cachedTrend = { at: Date.now(), days, body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('[TREND ERROR]', e?.message, e?.code, e?.details, JSON.stringify(e))
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch trend data' }, { status: 500 })
  }
}
