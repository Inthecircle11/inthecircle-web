import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/** GET - List all roles. Requires manage_roles. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_roles)
  if (forbidden) return forbidden
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  const { data, error } = await supabase.from('admin_roles').select('id, name, description, created_at').order('name')
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ roles: data ?? [] })
}
