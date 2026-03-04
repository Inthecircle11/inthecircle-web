import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List approval requests. Requires approve_approval. Marks expired (pending + expires_at < now) as expired. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.approve_approval)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
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
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  return adminSuccess({ requests: data ?? [] }, requestId)
}
