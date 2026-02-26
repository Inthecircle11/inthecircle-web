import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List control framework mappings with evidence endpoints. Requires read_audit (compliance). */
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
    .from('admin_control_framework_mapping')
    .select('id, framework, control_code, control_description, system_component, evidence_source, created_at')
    .order('framework')
    .order('control_code')

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
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

  return NextResponse.json({ controls })
}
