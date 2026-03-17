import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
let cachedMonthly: { at: number; months: number; body: Record<string, unknown> } | null = null

/** GET - Monthly application counts for last N months */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const months = Math.min(12, Math.max(1, parseInt(req.nextUrl.searchParams.get('months') || '6', 10)))

  // Return cached if fresh and same months param
  if (cachedMonthly && Date.now() - cachedMonthly.at < CACHE_TTL_MS && cachedMonthly.months === months) {
    return NextResponse.json(cachedMonthly.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  try {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    
    const { data: apps, error } = await supabase
      .from('applications')
      .select('created_at, status')
      .gte('created_at', startDate.toISOString())
    
    if (error) throw error
    
    // Group by month
    const monthMap = new Map<string, { total: number; approved: number }>()
    
    // Fill all months with zeros
    for (let i = 0; i < months; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (months - 1 - i))
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      monthMap.set(monthKey, { total: 0, approved: 0 })
    }
    
    // Count applications
    apps?.forEach((app: { created_at: string; status: string }) => {
      const d = new Date(app.created_at)
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      const entry = monthMap.get(monthKey)
      if (entry) {
        entry.total++
        if (app.status === 'APPROVED' || app.status === 'ACTIVE') entry.approved++
      }
    })
    
    // Format months
    const monthlyData = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, counts]) => {
        const [year, month] = monthKey.split('-')
        const d = new Date(parseInt(year), parseInt(month) - 1, 1)
        const monthName = d.toLocaleString('en-US', { month: 'short' })
        return {
          month: `${monthName} ${year}`,
          total: counts.total,
          approved: counts.approved,
        }
      })
    
    const body = { ok: true, data: monthlyData, cached_at: new Date().toISOString() }
    cachedMonthly = { at: Date.now(), months, body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Monthly data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch monthly data' }, { status: 500 })
  }
}
