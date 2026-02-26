import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** POST - Release a report (clear assignment). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.resolve_reports)
  if (forbidden) return forbidden
  const { id: reportId } = await params
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  const { error } = await supabase
    .from('user_reports')
    .update({
      assigned_to: null,
      assigned_at: null,
      assignment_expires_at: null,
    })
    .eq('id', reportId)
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
