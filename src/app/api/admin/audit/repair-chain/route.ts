import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Recompute previous_hash and row_hash for all admin_audit_log rows (repair broken chain). Requires export_audit. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.export_audit)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data, error } = await supabase.rpc('admin_repair_audit_chain')

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const out = data as { ok?: boolean; rows_updated?: number } | null
  return adminSuccess({
    ok: out?.ok ?? true,
    rows_updated: out?.rows_updated ?? 0,
  }, requestId)
}
