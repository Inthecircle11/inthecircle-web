/* eslint-disable @typescript-eslint/no-explicit-any */
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
    // Get approved application user IDs
    const { data: approvedApps, error: appsError } = await supabase
      .from('applications')
      .select('user_id')
      .eq('status', 'approved')
    
    if (appsError) throw appsError
    
    const approvedUserIds = approvedApps?.map((app: { user_id: string }) => app.user_id) || []
    
    if (approvedUserIds.length === 0) {
      const body = { ok: true, data: [], cached_at: new Date().toISOString() }
      cachedNiches = { at: Date.now(), body }
      return NextResponse.json(body)
    }
    
    // Get niches from profiles for approved users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('niche')
      .in('id', approvedUserIds)
      .not('niche', 'is', null)
      .neq('niche', '')
    
    if (profilesError) throw profilesError
    
    const nicheMap = new Map<string, number>()
    profiles?.forEach((p: { niche: string }) => {
      const niche = p.niche || 'Not specified'
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
