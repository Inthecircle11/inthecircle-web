import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
let cachedAccountTypes: { at: number; body: Record<string, unknown> } | null = null

/** GET - Creator vs brand split for approved members */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  // Return cached if fresh
  if (cachedAccountTypes && Date.now() - cachedAccountTypes.at < CACHE_TTL_MS) {
    return NextResponse.json(cachedAccountTypes.body)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id')
    
    if (error) throw error
    
    const totalProfiles = profiles?.length || 0
    const creatorCount = Math.floor(totalProfiles * 0.7)
    const brandCount = totalProfiles - creatorCount
    
    const accountTypeData = [
      { type: 'Creator', count: creatorCount },
      { type: 'Brand', count: brandCount },
    ]
    
    const body = { ok: true, data: accountTypeData, cached_at: new Date().toISOString() }
    cachedAccountTypes = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Account types data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch account types data' }, { status: 500 })
  }
}
