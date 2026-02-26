import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { verifyChain, verifySnapshotSignature } from '@/lib/audit-verify'
import type { AuditRow } from '@/lib/audit-verify'

export const dynamic = 'force-dynamic'

const VERIFY_PAGE_SIZE = 5000
const VERIFY_MAX_ROWS = 100_000

/** GET - Verify audit log hash chain and optional snapshot. Requires read_audit. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const rows: AuditRow[] = []
  let offset = 0
  let hasMore = true

  while (hasMore && rows.length < VERIFY_MAX_ROWS) {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id, admin_user_id, action, target_type, target_id, details, created_at, previous_hash, row_hash')
      .order('created_at', { ascending: true })
      .range(offset, offset + VERIFY_PAGE_SIZE - 1)

    if (error) {
      console.error('[admin 500]', error)
      return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
    }
    const chunk = (data ?? []) as AuditRow[]
    rows.push(...chunk)
    hasMore = chunk.length === VERIFY_PAGE_SIZE
    offset += VERIFY_PAGE_SIZE
  }

  const chainResult = verifyChain(rows)
  let snapshotValid: boolean | null = null
  let snapshotDate: string | null = null

  const secret = process.env.ADMIN_AUDIT_SNAPSHOT_SECRET
  if (secret && rows.length > 0) {
    const lastRow = rows[rows.length - 1]
    const lastRowHash = lastRow?.row_hash ?? null
    if (lastRowHash) {
      const { data: snap } = await supabase
        .from('admin_audit_snapshots')
        .select('snapshot_date, last_row_hash, signature')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single()
      if (snap) {
        const s = snap as { snapshot_date: string; last_row_hash: string; signature: string }
        snapshotDate = s.snapshot_date
        snapshotValid = s.last_row_hash === lastRowHash && verifySnapshotSignature(s.last_row_hash, s.signature, secret)
      }
    }
  }

  return NextResponse.json({
    chain_valid: chainResult.valid,
    first_corrupted_id: chainResult.firstCorruptedId ?? undefined,
    snapshot_valid: snapshotValid ?? undefined,
    snapshot_date: snapshotDate ?? undefined,
    rows_checked: rows.length,
  })
}
