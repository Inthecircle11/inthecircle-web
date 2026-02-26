import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import {
  checkDestructiveRateLimit,
  writeAuditLog,
} from '@/lib/audit-server'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/admin-idempotency'
import { requiresApproval, createApprovalRequest } from '@/lib/admin-approval'
import { checkBulkRateLimit } from '@/lib/admin-bulk-rate-limit'
import { getRequestId, jsonError } from '@/lib/request-id'

export const dynamic = 'force-dynamic'

const REASON_MIN_LENGTH = 5
/** C4 stabilization: cap bulk size to prevent DoS and timeouts (one RPC per id). */
const MAX_BULK_APPLICATION_IDS = 200

/** POST - Bulk approve, reject, waitlist, or suspend. Idempotency-Key supported. Phase 13: 20 req/min rate limit. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response

  const requestId = getRequestId(req)
  const addHeader = (res: NextResponse) => {
    res.headers.set('x-request-id', requestId)
    return res
  }

  // Phase 13: 20 bulk requests per minute per admin
  const rateLimitErr = checkBulkRateLimit(result.user.id)
  if (rateLimitErr) {
    return jsonError(req, { error: rateLimitErr }, 429)
  }

  const body = await req.json().catch(() => ({}))
  const { application_ids, action, reason } = body
  const ids = Array.isArray(application_ids) ? application_ids : []
  if (ids.length === 0 || !['approve', 'reject', 'waitlist', 'suspend'].includes(action)) {
    return addHeader(NextResponse.json(
      { error: 'application_ids (array) and action (approve|reject|waitlist|suspend) required' },
      { status: 400 }
    ))
  }
  if (ids.length > MAX_BULK_APPLICATION_IDS) {
    return addHeader(NextResponse.json(
      { error: `Too many applications. Maximum ${MAX_BULK_APPLICATION_IDS} per request.` },
      { status: 400 }
    ))
  }
  const isDestructive = action === 'reject' || action === 'suspend'
  const perm = isDestructive ? ADMIN_PERMISSIONS.bulk_applications : ADMIN_PERMISSIONS.mutate_applications
  const forbidden = requirePermission(result, perm)
  if (forbidden) return forbidden
  const idempotencyKey = req.headers.get('idempotency-key')?.trim()
  const actionKey = `bulk_applications_${action}`
  const serviceSupabase = getServiceRoleClient()
  if (idempotencyKey && serviceSupabase) {
    const stored = await getIdempotencyResponse(serviceSupabase, idempotencyKey, result.user.id, actionKey)
    if (stored) {
      return addHeader(new NextResponse(stored.body, { status: stored.status, headers: { 'Content-Type': 'application/json' } }))
    }
  }
  const { user, supabase: anonSupabase } = result
  if (!serviceSupabase) return jsonError(req, { error: 'Service unavailable' }, 500)
  if (isDestructive) {
    const rawReason = reason != null ? String(reason).trim() : ''
    if (rawReason.length < REASON_MIN_LENGTH) {
      return addHeader(NextResponse.json(
        { error: `reason required (min ${REASON_MIN_LENGTH} characters) for reject/suspend` },
        { status: 400 }
      ))
    }
    const auditAction = action === 'reject' ? 'bulk_reject' : 'bulk_suspend'
    if (requiresApproval(auditAction, { application_ids: ids })) {
      const permForbidden = requirePermission(result, ADMIN_PERMISSIONS.request_approval)
      if (permForbidden) return permForbidden
      const created = await createApprovalRequest(
        serviceSupabase,
        req,
        result.user,
        auditAction,
        'application',
        ids[0] ?? 'bulk',
        { application_ids: ids, reason: rawReason },
        rawReason
      )
      if ('error' in created) {
        return jsonError(req, { error: created.error }, 500)
      }
      return addHeader(NextResponse.json(
        { approval_required: true, request_id: created.id },
        { status: 202 }
      ))
    }
    const rateErr = await checkDestructiveRateLimit(anonSupabase, user.id, auditAction, 1)
    if (rateErr) {
      return addHeader(NextResponse.json({ error: rateErr }, { status: 429, headers: { 'Retry-After': '3600' } }))
    }
  }

  const rpcName =
    action === 'approve'
      ? 'admin_approve_application'
      : action === 'reject'
        ? 'admin_reject_application'
        : action === 'waitlist'
          ? 'admin_waitlist_application'
          : 'admin_suspend_application'
  const paramName = 'p_application_id'

  const errors: string[] = []
  for (const id of ids) {
    const { error } = await serviceSupabase.rpc(rpcName, { [paramName]: id })
    if (error) errors.push(`${id}: ${error.message}`)
  }

  if (errors.length > 0) {
    const resBody = JSON.stringify({ ok: false, errors })
    if (idempotencyKey && serviceSupabase) await setIdempotencyResponse(serviceSupabase, idempotencyKey, user.id, actionKey, 207, resBody)
    return addHeader(NextResponse.json({ ok: false, errors }, { status: 207 }))
  }

  const auditAction = `bulk_${action}` as 'bulk_approve' | 'bulk_reject' | 'bulk_waitlist' | 'bulk_suspend'
  const auditReason = isDestructive && reason != null ? String(reason).trim().slice(0, 500) : undefined
  await writeAuditLog(anonSupabase, req, user, {
    action: auditAction,
    target_type: 'application',
    target_id: undefined,
    details: { count: ids.length, ids },
    reason: auditReason ?? null,
  })

  const resBody = JSON.stringify({ ok: true, count: ids.length })
  if (idempotencyKey && serviceSupabase) await setIdempotencyResponse(serviceSupabase, idempotencyKey, user.id, actionKey, 200, resBody)
  return addHeader(NextResponse.json({ ok: true, count: ids.length }))
}
