import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { generateEvidenceForControl } from '@/lib/compliance-evidence'

export const dynamic = 'force-dynamic'

/** POST - Generate evidence for a control_code. Triggers export/verify/summary and stores in admin_control_evidence. Requires export_audit. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.export_audit)
  if (forbidden) return forbidden

  const body = await req.json().catch(() => ({}))
  const controlCode = typeof body.control_code === 'string' ? body.control_code.trim() : null

  if (!controlCode) {
    return NextResponse.json({ error: 'control_code required' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const generated = await generateEvidenceForControl(supabase, controlCode)

  if (!generated) {
    return NextResponse.json(
      { error: 'No evidence generator for this control_code', control_code: controlCode },
      { status: 400 }
    )
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('admin_control_evidence')
    .insert({
      control_code: controlCode,
      evidence_type: generated.evidence_type,
      reference: generated.reference,
      generated_by: result.user.id,
    })
    .select('id, control_code, evidence_type, reference, generated_at')
    .single()

  if (insertErr) {
    console.error('[admin 500]', insertErr)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    evidence: inserted,
    summary: generated.summary,
  })
}
