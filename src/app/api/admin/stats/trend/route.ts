import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
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
    const { data, error } = await supabase.rpc('admin_get_trend_data', { days_param: days })
    
    if (error) {
      console.error('Trend RPC error, falling back to direct query:', error)
      // Fallback to direct query
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('created_at, status')
        .gte('created_at', startDate.toISOString())
      
      if (appsError) throw appsError
      
      // Group by date
      const dateMap = new Map<string, { total: number; approved: number; rejected: number }>()
      
      // Fill all dates with zeros
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        const dateStr = d.toISOString().split('T')[0]
        dateMap.set(dateStr, { total: 0, approved: 0, rejected: 0 })
      }
      
      // Count applications
      apps?.forEach((app: { created_at: string; status: string }) => {
        const dateStr = app.created_at.split('T')[0]
        const entry = dateMap.get(dateStr)
        if (entry) {
          entry.total++
          if (app.status === 'APPROVED' || app.status === 'ACTIVE') entry.approved++
          if (app.status === 'REJECTED') entry.rejected++
        }
      })
      
      // Format dates
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
    }
    
    // Format RPC data
    const trendData = (data || []).map((row: { date: string; total: number; approved: number; rejected: number }) => {
      const d = new Date(row.date + 'T00:00:00Z')
      const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      const day = d.getUTCDate()
      return {
        date: `${month} ${day.toString().padStart(2, '0')}`,
        total: row.total || 0,
        approved: row.approved || 0,
        rejected: row.rejected || 0,
      }
    })
    
    const body = { ok: true, data: trendData, cached_at: new Date().toISOString() }
    cachedTrend = { at: Date.now(), days, body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Trend data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch trend data' }, { status: 500 })
  }
}
