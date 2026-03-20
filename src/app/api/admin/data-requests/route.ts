import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

/** GET - List data requests. Requires read_data_requests. Supports status, type, pagination filters. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_data_requests)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const params = req.nextUrl.searchParams
  const statusFilter = params.get('status') || 'all'
  const typeFilter = params.get('type') || 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || DEFAULT_LIMIT))
  const offset = (page - 1) * limit

  let query = supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false })

  let countQuery = supabase
    .from('data_requests')
    .select('*', { count: 'exact', head: true })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
    countQuery = countQuery.eq('status', statusFilter)
  }

  if (typeFilter !== 'all') {
    query = query.eq('request_type', typeFilter)
    countQuery = countQuery.eq('request_type', typeFilter)
  }

  query = query.range(offset, offset + limit - 1)

  const [{ data: requests, error }, { count }] = await Promise.all([
    query,
    countQuery,
  ])

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const total = count ?? (requests ?? []).length
  const userIds = [...new Set((requests ?? []).map((r: { user_id: string }) => r.user_id))]
  const profiles: Record<string, { username: string | null; name: string | null; email?: string }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null; name: string | null }) => {
      profiles[p.id] = { username: p.username, name: p.name }
    })
  }

  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const list = (requests ?? []).map((r: Record<string, unknown>) => {
    const createdAt = r.created_at ? new Date(r.created_at as string) : null
    const isOverdue = r.status === 'pending' && createdAt && createdAt < overdueThreshold
    return {
      ...r,
      username: profiles[r.user_id as string]?.username ?? null,
      name: profiles[r.user_id as string]?.name ?? null,
      is_overdue: isOverdue,
    }
  })

  return adminSuccess({ requests: list, total, page, limit }, requestId)
}

/** PATCH - Update data request status. Requires update_data_requests. Optional updated_at for conflict-safe update (409 if row changed). */
export async function PATCH(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.update_data_requests)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const body = await req.json().catch(() => ({}))
  const { request_id, status, updated_at: clientUpdatedAt } = body
  if (!request_id || !['pending', 'completed', 'failed'].includes(status)) {
    return adminError('request_id and status (pending|completed|failed) required', 400, requestId)
  }

  const now = new Date().toISOString()
  // C3 stabilization: when client sends updated_at, use optimistic locking; return 409 if row was changed.
  const useOptimisticLock = typeof clientUpdatedAt === 'string' && clientUpdatedAt.trim().length > 0

  let query = supabase
    .from('data_requests')
    .update({ status, updated_at: now })
    .eq('id', request_id)

  if (useOptimisticLock) {
    query = query.eq('updated_at', clientUpdatedAt.trim())
  }

  const { data: updatedRows, error } = await query.select('id')

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }
  if (useOptimisticLock && (!updatedRows || updatedRows.length === 0)) {
    return adminError('Record changed by another user. Refresh and try again.', 409, requestId)
  }
  return adminSuccess({ ok: true }, requestId)
}
