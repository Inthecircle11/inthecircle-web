import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { computeSnapshotSignature } from '@/lib/audit-verify'
import { checkSnapshotRateLimit } from '@/lib/admin-snapshot-rate-limit'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Create or update daily audit snapshot (HMAC of latest row_hash). Requires read_audit. Phase 14.5: 5 req/min per admin. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const rateLimitErr = checkSnapshotRateLimit(result.user.id)
  if (rateLimitErr) {
    return adminError(rateLimitErr, 429, requestId)
  }

  const secret = process.env.ADMIN_AUDIT_SNAPSHOT_SECRET
  if (!secret) {
    return adminError('ADMIN_AUDIT_SNAPSHOT_SECRET not set', 500, requestId)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const { data: lastRow, error: fetchErr } = await supabase
    .from('admin_audit_log')
    .select('row_hash, created_at')
    .not('row_hash', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !lastRow) {
    return adminError('No audit rows with row_hash found', 404, requestId)
  }

  const lastRowHash = (lastRow as { row_hash: string }).row_hash
  const signature = computeSnapshotSignature(lastRowHash, secret)
  const today = new Date().toISOString().slice(0, 10)

  const { error: upsertErr } = await supabase
    .from('admin_audit_snapshots')
    .upsert(
      {
        snapshot_date: today,
        last_row_hash: lastRowHash,
        signature,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'snapshot_date' }
    )

  if (upsertErr) {
    console.error('[admin 500]', upsertErr)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  return adminSuccess({ ok: true, snapshot_date: today }, requestId)
}
