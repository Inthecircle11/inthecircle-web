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
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const perm = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
  if (perm) return adminErrorFromResponse(perm, requestId)
  const { id: applicationId } = await params
  const body = await req.json().catch(() => ({}))
  const { action, updated_at } = body
  if (!action || !['approve', 'reject', 'waitlist', 'suspend'].includes(action)) {
    return adminError('action must be approve|reject|waitlist|suspend', 400, requestId)
  }
  const supabase = getServiceRoleClient()
  if (!supabase) return adminError('Service unavailable', 500, requestId)

  const newStatus = action === 'approve' ? 'ACTIVE' : action === 'reject' ? 'REJECTED' : action === 'waitlist' ? 'WAITLISTED' : 'SUSPENDED'

  let resolvedUpdatedAt: string | null = typeof updated_at === 'string' ? updated_at : null

  if (resolvedUpdatedAt == null) {
    const { data: row } = await supabase
      .from('applications')
      .select('updated_at')
      .eq('id', applicationId)
      .maybeSingle()
    if (row?.updated_at != null) resolvedUpdatedAt = typeof row.updated_at === 'string' ? row.updated_at : (row.updated_at as Date)?.toISOString?.() ?? null
  }

  if (resolvedUpdatedAt != null) {
    const { data: row, error } = await supabase.rpc('admin_application_action_v2', {
      p_application_id: applicationId,
      p_updated_at: resolvedUpdatedAt,
      p_action: action,
    })
    if (error) {
      console.error('[admin 500] applications action', error)
      const msg = (error as { code?: string }).code === '42883'
        ? 'Database function missing. Run Supabase migrations (admin_application_action_v2).'
        : 'Operation failed. Please try again.'
      return adminError(msg, 500, requestId)
    }
    if (row == null) {
      return adminError('Record changed by another moderator', 409, requestId)
    }
    if (action === 'approve') {
      void triggerWelcomeEmailForApplication(supabase, applicationId)
    }
    clearApplicationsCache()
    return adminSuccess({ ok: true }, requestId)
  }

  const { error } = await (async () => {
    const hasCol = await hasUpdatedAtColumn(supabase)
    const payload: Record<string, unknown> = { status: newStatus }
    if (hasCol) payload.updated_at = new Date().toISOString()
    return supabase.from('applications').update(payload).eq('id', applicationId)
  })()
  if (error) {
    console.error('[admin 500] applications action fallback update', error)
    const msg = (error as { code?: string }).code === '42703'
      ? 'Database column missing. Run Supabase migrations (applications.updated_at).'
      : 'Operation failed. Please try again.'
    return adminError(msg, 500, requestId)
  }
  if (action === 'approve') {
    void triggerWelcomeEmailForApplication(supabase, applicationId)
  }
  clearApplicationsCache()
  return adminSuccess({ ok: true }, requestId)
}

async function hasUpdatedAtColumn(supabase: Awaited<ReturnType<typeof getServiceRoleClient>>): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('applications').select('updated_at').limit(1).maybeSingle()
  return !error
}
