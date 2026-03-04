import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - List control framework mappings with evidence endpoints. Requires read_audit (compliance). */
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

  const { data: rows, error } = await supabase
    .from('admin_control_framework_mapping')
    .select('id, framework, control_code, control_description, system_component, evidence_source, created_at')
    .order('framework')
    .order('control_code')

  if (error) {
    console.error('[admin 500]', error)
    return adminError('Operation failed. Please try again.', 500, requestId)
  }

  const controls = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    framework: r.framework,
    control_code: r.control_code,
    control_description: r.control_description,
    system_component: r.system_component,
    evidence_source: r.evidence_source,
    evidence_endpoints: (r.evidence_source as string)?.split(';').map((s: string) => s.trim()).filter(Boolean) ?? [],
    created_at: r.created_at,
  }))

  return adminSuccess({ controls }, requestId)
}
