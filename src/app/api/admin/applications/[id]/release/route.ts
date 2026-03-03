import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { clearApplicationsCache } from '@/lib/admin-applications-cache'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Release an application (clear assignment). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)
  const { id: applicationId } = await params
  const supabase = getServiceRoleClient()
  if (!supabase) return adminError('Service unavailable', 500, requestId)
  const { error } = await supabase
    .from('applications')
    .update({
      assigned_to: null,
      assigned_at: null,
      assignment_expires_at: null,
    })
    .eq('id', applicationId)
  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }
  clearApplicationsCache()
  return adminSuccess({ ok: true }, requestId)
}
