import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - Control health: overall_score, per-control status, last_checked_at. Requires read_audit. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: rows, error } = await supabase
    .from('admin_control_health')
    .select('control_code, status, score, last_checked_at, notes')
    .order('control_code')

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  const controls = (rows ?? []) as Array<{ control_code: string; status: string; score: number; last_checked_at: string; notes: string | null }>
  const scores = controls.map((c) => c.score).filter((n) => typeof n === 'number')
  const overall_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  return NextResponse.json({
    overall_score,
    controls,
    last_checked_at: controls.length > 0 ? controls.reduce((latest, c) => (c.last_checked_at > latest ? c.last_checked_at : latest), controls[0].last_checked_at) : null,
  })
}
