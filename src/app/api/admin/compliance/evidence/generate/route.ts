import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { generateEvidenceForControl } from '@/lib/compliance-evidence'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** POST - Generate evidence for a control_code. Triggers export/verify/summary and stores in admin_control_evidence. Requires export_audit. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.export_audit)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const body = await req.json().catch(() => ({}))
  const controlCode = typeof body.control_code === 'string' ? body.control_code.trim() : null

  if (!controlCode) {
    return adminError('control_code required', 400, requestId)
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const generated = await generateEvidenceForControl(supabase, controlCode)

  if (!generated) {
    return adminError('No evidence generator for this control_code', 400, requestId)
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
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  return adminSuccess({
    ok: true,
    evidence: inserted,
    summary: generated.summary,
  }, requestId)
}
