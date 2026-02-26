import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { computeSnapshotSignature } from '@/lib/audit-verify'
import { checkSnapshotRateLimit } from '@/lib/admin-snapshot-rate-limit'

export const dynamic = 'force-dynamic'

/** POST - Create or update daily audit snapshot (HMAC of latest row_hash). Requires read_audit. Phase 14.5: 5 req/min per admin. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return forbidden

  const rateLimitErr = checkSnapshotRateLimit(result.user.id)
  if (rateLimitErr) {
    return NextResponse.json({ error: rateLimitErr }, { status: 429 })
  }

  const secret = process.env.ADMIN_AUDIT_SNAPSHOT_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_AUDIT_SNAPSHOT_SECRET not set' },
      { status: 500 }
    )
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: lastRow, error: fetchErr } = await supabase
    .from('admin_audit_log')
    .select('row_hash, created_at')
    .not('row_hash', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !lastRow) {
    return NextResponse.json(
      { error: 'No audit rows with row_hash found', details: fetchErr?.message },
      { status: 404 }
    )
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
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, snapshot_date: today })
}
