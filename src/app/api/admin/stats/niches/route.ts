import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000
let cachedNiches: { at: number; body: Record<string, unknown> } | null = null

/** GET - Top niches for approved members */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  // Return cached if fresh
  if (cachedNiches && Date.now() - cachedNiches.at < CACHE_TTL_MS) {
    return NextResponse.json(cachedNiches.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  try {
    const { data: applications, error } = await supabase
      .from('applications')
      .select('niche')
      .eq('status', 'approved')
      .not('niche', 'is', null)
      .neq('niche', '')
    
    if (error) throw error
    
    const nicheMap = new Map<string, number>()
    applications?.forEach((app: { niche: string }) => {
      const niche = app.niche || 'Not specified'
      nicheMap.set(niche, (nicheMap.get(niche) || 0) + 1)
    })
    
    const nicheData = Array.from(nicheMap.entries())
      .map(([niche, count]) => ({ niche, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    const body = { ok: true, data: nicheData, cached_at: new Date().toISOString() }
    cachedNiches = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Niches data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch niches data' }, { status: 500 })
  }
}
