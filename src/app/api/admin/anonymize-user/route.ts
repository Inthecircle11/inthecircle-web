import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import {
  checkDestructiveRateLimit,
  writeAuditLog,
} from '@/lib/audit-server'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { requiresApproval, createApprovalRequest } from '@/lib/admin-approval'

export const dynamic = 'force-dynamic'

const REASON_MIN_LENGTH = 5

/** POST - Anonymize user. Requires anonymize_users. If approval required, returns 202 and request_id. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.anonymize_users)
  if (forbidden) return forbidden
  const { user, supabase } = result

  const body = await req.json().catch(() => ({}))
  const userId = body.user_id
  const rawReason = body.reason != null ? String(body.reason).trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }
  if (rawReason.length < REASON_MIN_LENGTH) {
    return NextResponse.json(
      { error: `reason required (min ${REASON_MIN_LENGTH} characters)` },
      { status: 400 }
    )
  }

  const serviceSupabase = getServiceRoleClient()
  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  if (requiresApproval('user_anonymize', { user_id: userId })) {
    const permForbidden = requirePermission(result, ADMIN_PERMISSIONS.request_approval)
    if (permForbidden) return permForbidden
    const created = await createApprovalRequest(
      serviceSupabase,
      req,
      user,
      'user_anonymize',
      'user',
      userId,
      { user_id: userId, reason: rawReason },
      rawReason
    )
    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 500 })
    }
    return NextResponse.json(
      { approval_required: true, request_id: created.id },
      { status: 202 }
    )
  }

  const rateErr = await checkDestructiveRateLimit(supabase, user.id, 'user_anonymize', 1)
  if (rateErr) {
    return NextResponse.json(
      { error: rateErr },
      { status: 429, headers: { 'Retry-After': '3600' } }
    )
  }

  const anonymizedName = `Anonymized ${userId.slice(0, 8)}`
  const { error: profileError } = await serviceSupabase
    .from('profiles')
    .update({
      name: anonymizedName,
      username: `anon_${userId.slice(0, 8)}`,
      profile_image_url: null,
      location: null,
      bio: null,
      niche: null,
      instagram_username: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    console.error('[admin 500]', profileError)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  await writeAuditLog(supabase, req, user, {
    action: 'user_anonymize',
    target_type: 'user',
    target_id: userId,
    details: {},
    reason: rawReason.slice(0, 500),
  })

  return NextResponse.json({
    ok: true,
    message: 'Profile anonymized. For full GDPR deletion use Delete User or a dedicated RPC.',
  })
}
