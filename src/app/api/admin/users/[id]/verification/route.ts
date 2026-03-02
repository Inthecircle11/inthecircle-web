import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** POST - Set user verification status. Requires mutate_users. No client RPC. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.mutate_users)
  if (forbidden) return forbidden

  const { id: userId } = await params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const isVerified = body?.is_verified === true

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('[admin verification]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog(supabase, req, result.user, {
    action: isVerified ? 'verification_set' : 'verification_remove',
    target_type: 'user',
    target_id: userId,
    details: { is_verified: isVerified },
  })

  return NextResponse.json({ ok: true })
}
