import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getReproduceInstruction } from '@/lib/compliance-evidence'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - List evidence records for a control (optional ?control_code=). Returns how to reproduce. Requires read_audit. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)
  }

  const controlCode = req.nextUrl.searchParams.get('control_code')?.trim() || null

  let query = supabase
    .from('admin_control_evidence')
    .select('id, control_code, evidence_type, reference, generated_at, generated_by')
    .order('generated_at', { ascending: false })
    .limit(200)

  if (controlCode) {
    query = query.eq('control_code', controlCode)
  }

  const { data: rows, error } = await query

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const evidence = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    control_code: r.control_code,
    evidence_type: r.evidence_type,
    reference: r.reference,
    generated_at: r.generated_at,
    generated_by: r.generated_by,
    reproduce: getReproduceInstruction(String(r.control_code ?? '')),
  }))

  return adminSuccess({
    evidence,
    reproduce_instruction: controlCode ? getReproduceInstruction(controlCode) : null,
  }, requestId)
}
