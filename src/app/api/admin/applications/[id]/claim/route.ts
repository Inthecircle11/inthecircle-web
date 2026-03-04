import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { clearApplicationsCache } from '@/lib/admin-applications-cache'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

const ASSIGNMENT_TTL_MINUTES = Number(process.env.ADMIN_ASSIGNMENT_TTL_MINUTES) || 15

/** POST - Claim an application. Atomic: only succeeds if unassigned or expired. Returns 409 if conflict. */
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
  const expiresAt = new Date(Date.now() + ASSIGNMENT_TTL_MINUTES * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('applications')
    .update({
      assigned_to: result.user.id,
      assigned_at: now,
      assignment_expires_at: expiresAt,
    })
    .or(`assigned_to.is.null,assignment_expires_at.lt.${now}`)
    .eq('id', applicationId)
    .select('id, assigned_to, assignment_expires_at')
    .single()
  if (error) {
    console.error('[admin 500] applications claim', error)
    const msg = (error as { code?: string }).code === '42703'
      ? 'Database column missing. Run Supabase migrations (applications.assigned_to).'
      : 'Operation failed. Please try again.'
    return adminError(msg, 500, requestId)
  }
  if (!data || (data as { assigned_to: string }).assigned_to !== result.user.id) {
    return adminError('Application already claimed by another moderator or record not found', 409, requestId)
  }
  clearApplicationsCache()
  return adminSuccess({
    ok: true,
    assigned_to: (data as { assigned_to: string }).assigned_to,
    assignment_expires_at: (data as { assignment_expires_at: string }).assignment_expires_at,
  }, requestId)
}
