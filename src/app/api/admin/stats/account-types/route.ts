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
    const { data: apps, error } = await supabase
      .from('applications')
      .select('account_type')
      .in('status', ['APPROVED', 'ACTIVE'])
    
    if (error) throw error
    
    // Count account types
    const typeMap = new Map<string, number>()
    apps?.forEach((app: { account_type: string | null }) => {
      const type = app.account_type || 'unknown'
      typeMap.set(type, (typeMap.get(type) || 0) + 1)
    })
    
    const accountTypeData = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
    
    const body = { ok: true, data: accountTypeData, cached_at: new Date().toISOString() }
    cachedAccountTypes = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('Account types data error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch account types data' }, { status: 500 })
  }
}
