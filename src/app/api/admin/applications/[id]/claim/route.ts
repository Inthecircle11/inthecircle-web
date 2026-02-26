import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

const ASSIGNMENT_TTL_MINUTES = Number(process.env.ADMIN_ASSIGNMENT_TTL_MINUTES) || 15

/** POST - Claim an application. Atomic: only succeeds if unassigned or expired. Returns 409 if conflict. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_applications)
  if (forbidden) return forbidden
  const { id: applicationId } = await params
  const supabase = getServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  const expiresAt = new Date(Date.now() + ASSIGNMENT_TTL_MINUTES * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('applications')
    .update({
      assigned_to: result.user.id,
      assigned_at: now,
      assignment_expires_at: expiresAt,
    })
    .or(`assigned_to.is.null,assignment_expires_at.lt.${now}`)
    .eq('id', applicationId)
    .select('id, assigned_to, assignment_expires_at')
    .single()
  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  if (!data || (data as { assigned_to: string }).assigned_to !== result.user.id) {
    return NextResponse.json(
      { error: 'Application already claimed by another moderator or record not found' },
      { status: 409 }
    )
  }
  return NextResponse.json({
    ok: true,
    assigned_to: (data as { assigned_to: string }).assigned_to,
    assignment_expires_at: (data as { assignment_expires_at: string }).assignment_expires_at,
  })
}
