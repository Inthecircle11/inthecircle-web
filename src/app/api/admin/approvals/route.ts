import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List approval requests. Requires approve_approval. Marks expired (pending + expires_at < now) as expired. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.approve_approval)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const now = new Date().toISOString()

  // Mark expired: pending rows with expires_at < now
  await supabase
    .from('admin_approval_requests')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', now)

  const { data, error } = await supabase
    .from('admin_approval_requests')
    .select('*')
    .eq('status', status)
    .order('requested_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}
