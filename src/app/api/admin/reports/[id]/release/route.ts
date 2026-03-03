import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Release a report (clear assignment). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.resolve_reports)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { id: reportId } = await params
  const supabase = getServiceRoleClient()
  if (!supabase) return adminError('Service unavailable', 500, requestId)
  const { error } = await supabase
    .from('user_reports')
    .update({
      assigned_to: null,
      assigned_at: null,
      assignment_expires_at: null,
    })
    .eq('id', reportId)
  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }
  return adminSuccess({ ok: true }, requestId)
}
