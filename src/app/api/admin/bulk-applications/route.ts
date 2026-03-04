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
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'
import { triggerWelcomeEmailForApplication } from '@/lib/trigger-welcome-email'
import { clearApplicationsCache } from '@/lib/admin-applications-cache'

export const dynamic = 'force-dynamic'

const REASON_MIN_LENGTH = 5
/** C4 stabilization: cap bulk size to prevent DoS and timeouts (one RPC per id). */
const MAX_BULK_APPLICATION_IDS = 200

/** POST - Bulk approve, reject, waitlist, or suspend. Idempotency-Key supported. Phase 13: 20 req/min rate limit. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)

  return withAdminRateLimit(req, 'bulk-applications', 20, 60000, async () => {
    // Phase 13: 20 bulk requests per minute per admin
    const rateLimitErr = checkBulkRateLimit(result.user.id)
    if (rateLimitErr) {
      return adminError(rateLimitErr, 429, requestId)
    }

    const body = await req.json().catch(() => ({}))
    const { application_ids, action, reason, updated_at_by_id } = body
    const ids = Array.isArray(application_ids) ? application_ids : []
    if (ids.length === 0 || !['approve', 'reject', 'waitlist', 'suspend'].includes(action)) {
      return adminError('application_ids (array) and action (approve|reject|waitlist|suspend) required', 400, requestId)
    }
    const updatedAtById = updated_at_by_id != null && typeof updated_at_by_id === 'object' ? updated_at_by_id as Record<string, unknown> : {}
    const missingUpdatedAt = ids.filter((id) => !updatedAtById[id] || typeof updatedAtById[id] !== 'string')
    if (missingUpdatedAt.length > 0) {
      return adminError('updated_at_by_id required for each application id (for conflict checking)', 400, requestId)
    }
    if (ids.length > MAX_BULK_APPLICATION_IDS) {
      return adminError(`Too many applications. Maximum ${MAX_BULK_APPLICATION_IDS} per request.`, 400, requestId)
    }
    const isDestructive = action === 'reject' || action === 'suspend'
    const perm = isDestructive ? ADMIN_PERMISSIONS.bulk_applications : ADMIN_PERMISSIONS.mutate_applications
    const forbidden = requirePermission(result, perm)
    if (forbidden) return adminErrorFromResponse(forbidden, requestId)
    const idempotencyKey = req.headers.get('idempotency-key')?.trim()
    const actionKey = `bulk_applications_${action}`
    const serviceSupabase = getServiceRoleClient()
    if (idempotencyKey && serviceSupabase) {
      const stored = await getIdempotencyResponse(serviceSupabase, idempotencyKey, result.user.id, actionKey)
      if (stored) {
        const res = new NextResponse(stored.body, { status: stored.status, headers: { 'Content-Type': 'application/json' } })
        res.headers.set('x-request-id', requestId)
        return res
      }
    }
    const { user, supabase: anonSupabase } = result
    if (!serviceSupabase) return adminError('Service unavailable', 500, requestId)
    if (isDestructive) {
      const rawReason = reason != null ? String(reason).trim() : ''
      if (rawReason.length < REASON_MIN_LENGTH) {
        return adminError(`reason required (min ${REASON_MIN_LENGTH} characters) for reject/suspend`, 400, requestId)
      }
      const auditAction = action === 'reject' ? 'bulk_reject' : 'bulk_suspend'
      if (requiresApproval(auditAction, { application_ids: ids })) {
        const permForbidden = requirePermission(result, ADMIN_PERMISSIONS.request_approval)
        if (permForbidden) return adminErrorFromResponse(permForbidden, requestId)
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
          return adminError(created.error, 500, requestId)
        }
        return adminSuccess({ approval_required: true, request_id: created.id }, requestId, 202)
      }
      const rateErr = await checkDestructiveRateLimit(anonSupabase, user.id, auditAction, 1)
      if (rateErr) {
        const res = adminError(rateErr, 429, requestId)
        res.headers.set('Retry-After', '3600')
        return res
      }
    }

    const newStatus =
      action === 'approve'
        ? 'ACTIVE'
        : action === 'reject'
          ? 'REJECTED'
          : action === 'waitlist'
            ? 'WAITLISTED'
            : 'SUSPENDED'

    const nowIso = new Date().toISOString()
    let conflictCount = 0
    const errors: string[] = []
    for (const id of ids) {
      const updatedAt = String(updatedAtById[id]).trim()
      const { data, error } = await serviceSupabase
        .from('applications')
        .update({ status: newStatus, updated_at: nowIso })
        .eq('id', id)
        .eq('updated_at', updatedAt)
        .select('id')
        .single()
      if (error) {
        if ((error as { code?: string }).code === 'PGRST116') {
          conflictCount += 1
        } else {
          errors.push(`${id}: ${error.message}`)
        }
        continue
      }
      if (!data) conflictCount += 1
    }

    if (conflictCount > 0) {
      const resBody = JSON.stringify({ error: 'Some applications were modified by another admin' })
      if (idempotencyKey && serviceSupabase) await setIdempotencyResponse(serviceSupabase, idempotencyKey, user.id, actionKey, 409, resBody)
      return adminError('Some applications were modified by another admin', 409, requestId)
    }

    if (errors.length > 0) {
      const resBody = JSON.stringify({ ok: false, errors })
      if (idempotencyKey && serviceSupabase) await setIdempotencyResponse(serviceSupabase, idempotencyKey, user.id, actionKey, 207, resBody)
      return adminSuccess({ ok: false, errors }, requestId, 207)
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

    if (action === 'approve') {
      for (const id of ids) {
        void triggerWelcomeEmailForApplication(serviceSupabase, id)
      }
    }

    clearApplicationsCache()
    const resBody = JSON.stringify({ ok: true, count: ids.length })
    if (idempotencyKey && serviceSupabase) await setIdempotencyResponse(serviceSupabase, idempotencyKey, user.id, actionKey, 200, resBody)
    return adminSuccess({ ok: true, count: ids.length }, requestId)
  })
}
