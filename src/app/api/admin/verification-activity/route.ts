import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - Recent verification activity (approved/rejected). Replaces admin_get_recent_verification_activity RPC. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_applications)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: rows, error } = await supabase
    .from('verification_requests')
    .select('id, user_id, status, reviewed_at')
    .in('status', ['approved', 'rejected'])
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[admin verification-activity]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))]
  const profiles: Record<string, { username: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)
    ;(profData ?? []).forEach((p: { id: string; username: string | null }) => {
      profiles[p.id] = { username: p.username }
    })
  }

  const activity = (rows ?? []).map((r: { id: string; status: string; user_id: string; reviewed_at: string }, i: number) => ({
    id: `activity-${i}`,
    type: r.status === 'approved' ? 'verification_approved' : 'verification_rejected',
    title: r.status === 'approved' ? 'Verification approved' : 'Verification rejected',
    subtitle: `@${profiles[r.user_id]?.username ?? 'unknown'}`,
    timestamp: r.reviewed_at,
    color: r.status === 'approved' ? '#10B981' : '#EF4444',
  }))

  return NextResponse.json(activity)
}
