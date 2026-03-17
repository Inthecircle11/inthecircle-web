import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { triggerWelcomeEmailForApplication } from '@/lib/trigger-welcome-email'
import { clearApplicationsCache } from '@/lib/admin-applications-cache'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Single application action (approve/reject/waitlist/suspend). Conflict-safe when updated_at provided; 409 if changed. When updated_at omitted, fetches current row or updates directly. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getAdminRequestId(req)
  try {
    const result = await requireAdmin(req)
    if ('response' in result) return adminErrorFromResponse(result.response, requestId)
    const perm = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
    if (perm) return adminErrorFromResponse(perm, requestId)
    const { id: applicationId } = await params
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

    const newStatus = action === 'approve' ? 'ACTIVE' : action === 'reject' ? 'REJECTED' : action === 'waitlist' ? 'WAITLISTED' : 'SUSPENDED'

    let resolvedUpdatedAt: string | null = typeof updated_at === 'string' ? updated_at : null

    if (resolvedUpdatedAt == null) {
      const { data: row, error: fetchError } = await supabase
        .from('applications')
        .select('updated_at')
        .eq('id', applicationId)
        .maybeSingle()
      if (fetchError) {
        console.error('[action route] fetch updated_at error:', JSON.stringify(fetchError))
        return adminError(fetchError.message ?? 'Failed to fetch application', 500, requestId)
      }
      if (row?.updated_at != null) resolvedUpdatedAt = typeof row.updated_at === 'string' ? row.updated_at : (row.updated_at as Date)?.toISOString?.() ?? null
    }

    if (resolvedUpdatedAt != null) {
      const { data: row, error } = await supabase.rpc('admin_application_action_v2', {
        p_application_id: applicationId,
        p_updated_at: resolvedUpdatedAt,
        p_action: action,
      })
      if (error) {
        const code = (error as { code?: string }).code
        const msg =
          code === '42883'
            ? 'Database function missing. Run Supabase migrations (admin_application_action_v2).'
            : code === 'PGRST301'
              ? 'Invalid application id or record not found.'
              : (error as { message?: string }).message ?? 'Operation failed. Please try again.'
        console.error('[action route] admin_application_action_v2 RPC error:', JSON.stringify(error))
        return adminError(msg, 500, requestId)
      }
      if (row == null) {
        return adminError('Record changed by another moderator', 409, requestId)
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
    }

    const hasCol = await hasUpdatedAtColumn(supabase)
    const payload: Record<string, unknown> = { status: newStatus }
    if (hasCol) payload.updated_at = new Date().toISOString()
    const { error } = await supabase.from('applications').update(payload).eq('id', applicationId).select('id')
    if (error) {
      const code = (error as { code?: string }).code
      const msg =
        code === '42703'
          ? 'Database column missing. Run Supabase migrations (applications.updated_at).'
          : (error as { message?: string }).message ?? 'Operation failed. Please try again.'
      console.error('[action route] fallback update error:', JSON.stringify(error))
      return adminError(msg, 500, requestId)
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

async function hasUpdatedAtColumn(supabase: Awaited<ReturnType<typeof getServiceRoleClient>>): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('applications').select('updated_at').limit(1).maybeSingle()
  return !error
}
