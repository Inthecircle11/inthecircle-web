import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import {
  runControlHealthChecks,
  upsertControlHealth,
  ensureGovernanceReviewEscalation,
} from '@/lib/control-health'

export const dynamic = 'force-dynamic'

/** POST - Run daily control health checks, upsert admin_control_health, ensure governance review escalation. Requires export_audit. Call from cron once per day. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.export_audit)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  let results = await runControlHealthChecks(supabase)

  // Auto-fix CC6.1: if no super_admin exists, ensure role exists then assign current (allowlisted) user
  const cc61 = results.find((r) => r.control_code === 'CC6.1')
  if (cc61?.status === 'failed' && cc61.notes === 'No super_admin exists') {
    // Ensure super_admin role exists (idempotent; migration may not have run or seed was skipped)
    await supabase.from('admin_roles').upsert(
      { name: 'super_admin', description: 'Full access including delete/anonymize and role management' },
      { onConflict: 'name' }
    )
    const { data: roleRow, error: roleErr } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('name', 'super_admin')
      .single()
    if (roleErr || !roleRow?.id) {
      return NextResponse.json(
        { error: 'CC6.1 auto-fix failed: could not get super_admin role', details: roleErr?.message },
        { status: 500 }
      )
    }
    const { error: assignErr } = await supabase.from('admin_user_roles').upsert(
      { admin_user_id: result.user.id, role_id: roleRow.id },
      { onConflict: 'admin_user_id,role_id' }
    )
    if (assignErr) {
      return NextResponse.json(
        { error: 'CC6.1 auto-fix failed: could not assign super_admin', details: assignErr.message },
        { status: 500 }
      )
    }
    results = await runControlHealthChecks(supabase)
  }

  // Auto-fix CC7.2: if chain broken, run repair then re-check
  const cc72 = results.find((r) => r.control_code === 'CC7.2')
  if (cc72?.status === 'failed' && cc72.notes?.startsWith('Chain broken')) {
    const { error: repairErr } = await supabase.rpc('admin_repair_audit_chain')
    if (!repairErr) {
      results = await runControlHealthChecks(supabase)
    }
  }

  await upsertControlHealth(supabase, results)
  await ensureGovernanceReviewEscalation(supabase)

  const overall = results.length > 0
    ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
    : null

  return NextResponse.json({
    ok: true,
    overall_score: overall,
    controls: results,
  })
}
