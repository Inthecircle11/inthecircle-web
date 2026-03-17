import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { triggerWelcomeEmailForApplication } from '@/lib/trigger-welcome-email'
import { clearApplicationsCache } from '@/lib/admin-applications-cache'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Single application action (approve/reject/waitlist/suspend). Direct table update (RPC bypassed for serverless reliability). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  console.log('[action] POST handler reached, id:', resolvedParams?.id)
  const requestId = getAdminRequestId(req)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[action] service key present:', !!serviceKey, 'length:', serviceKey?.length ?? 0)
  try {
    const result = await requireAdmin(req)
    if ('response' in result) return adminErrorFromResponse(result.response, requestId)
    const perm = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
    if (perm) return adminErrorFromResponse(perm, requestId)
    const applicationId = resolvedParams.id
    if (!applicationId) {
      console.error('[action route] missing application id in params')
      return adminError('Missing application id', 400, requestId)
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(applicationId)) {
      return adminError('Invalid application id format', 400, requestId)
    }
    const body = await req.json().catch(() => ({}))
    const { action, updated_at } = body
    if (!action || !['approve', 'reject', 'waitlist', 'suspend'].includes(action)) {
      return adminError('action must be approve|reject|waitlist|suspend', 400, requestId)
    }

    const supabase = getServiceRoleClient()
    if (!supabase) {
      console.error('[action route] getServiceRoleClient() returned null — check SUPABASE_SERVICE_ROLE_KEY')
      return adminError('Service unavailable (missing SUPABASE_SERVICE_ROLE_KEY)', 500, requestId)
    }

    // DB constraint applications_status_check allows: 'pending', 'approved', 'rejected', 'waitlist', 'suspended'
    const newStatus =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : action === 'waitlist'
            ? 'waitlist'
            : action === 'suspend'
              ? 'suspended'
              : null
    if (newStatus === null) {
      return adminError('Invalid action', 400, requestId)
    }

    console.log('[action] applicationId:', applicationId)
    const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('applications').update(payload).eq('id', applicationId).select('id')
    if (error) {
      console.error('[action route] direct update error:', JSON.stringify(error))
      return adminError((error as { message?: string }).message ?? 'Operation failed. Please try again.', 500, requestId)
    }
    if (action === 'approve') {
      try {
        void triggerWelcomeEmailForApplication(supabase, applicationId)
      } catch (e) {
        console.error('[action route] triggerWelcomeEmailForApplication (non-fatal):', e)
      }
    }
    try {
      clearApplicationsCache()
    } catch (e) {
      console.error('[action route] clearApplicationsCache (non-fatal):', e)
    }
    return adminSuccess({ ok: true }, requestId)
  } catch (err: unknown) {
    const ex = err as { message?: string }
    console.error('[action route] unhandled error:', err)
    const msg = ex?.message ?? (typeof err === 'string' ? err : String(err)) ?? 'Unknown error'
    return adminError(msg || 'Operation failed. Please try again.', 500, requestId)
  }
}
