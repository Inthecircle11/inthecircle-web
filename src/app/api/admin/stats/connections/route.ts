import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache
let cachedConnections: { at: number; body: Record<string, unknown> } | null = null

/** GET - Connection creation trends over time (message threads) */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  // Return cached if fresh
  if (cachedConnections && Date.now() - cachedConnections.at < CACHE_TTL_MS) {
    return NextResponse.json(cachedConnections.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  try {
    const daysParam = req.nextUrl.searchParams.get('days')
    const days = Math.min(90, Math.max(7, Number(daysParam) || 30))
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startISO = startDate.toISOString()

    // Fetch message threads created in the time range
    const { data: threads, error } = await supabase
      .from('message_threads')
      .select('created_at')
      .gte('created_at', startISO)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group by date
    const dateMap = new Map<string, number>()
    
    threads?.forEach((thread: { created_at: string }) => {
      const date = new Date(thread.created_at).toISOString().split('T')[0]
      dateMap.set(date, (dateMap.get(date) || 0) + 1)
    })

    // Fill in missing dates with 0
    const result: Array<{ date: string; count: number }> = []
    const currentDate = new Date(startISO)
    const today = new Date()
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0]
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const body = { ok: true, data: result, cached_at: new Date().toISOString() }
    cachedConnections = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Connections data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch connections data' }, { status: 500 })
  }
}
