/**
 * 4-Eyes approval workflow. When ADMIN_APPROVAL_BULK_THRESHOLD is set,
 * bulk_reject/bulk_suspend above that count require approval. user_delete and user_anonymize
 * always require approval when this flow is enabled (threshold set).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { writeAuditLog } from './audit-server'
import type { AuditUser } from './audit-server'

const APPROVAL_EXPIRY_HOURS = 24

export const APPROVAL_REQUIRED_ACTIONS = [
  'user_delete',
  'user_anonymize',
  'bulk_reject',
  'bulk_suspend',
] as const

export type ApprovalRequiredAction = (typeof APPROVAL_REQUIRED_ACTIONS)[number]

/** If not set or 0, no approval required for bulk (backward compatible). */
export function getApprovalBulkThreshold(): number {
  const v = process.env.ADMIN_APPROVAL_BULK_THRESHOLD
  if (v === undefined || v === '') return 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** True if this destructive action must go through approval queue instead of executing immediately. */
export function requiresApproval(
  action: string,
  payload: { application_ids?: unknown[]; user_id?: string }
): boolean {
  const threshold = getApprovalBulkThreshold()
  if (threshold <= 0) return false
  if (action === 'user_delete' || action === 'user_anonymize') return true
  if (action === 'bulk_reject' || action === 'bulk_suspend') {
    const ids = Array.isArray(payload?.application_ids) ? payload.application_ids : []
    return ids.length > threshold
  }
  return false
}

/** Insert approval request; returns request id or null on error. */
export async function createApprovalRequest(
  supabase: SupabaseClient,
  req: NextRequest,
  user: AuditUser,
  action: string,
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
  reason: string
): Promise<{ id: string } | { error: string }> {
  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('admin_approval_requests')
    .insert({
      action,
      target_type: targetType,
      target_id: targetId,
      payload,
      requested_by: user.id,
      requested_at: new Date().toISOString(),
      status: 'pending',
      reason: reason.slice(0, 500),
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  const id = (data as { id: string })?.id
  if (!id) return { error: 'Insert failed' }

  const auditErr = await writeAuditLog(supabase, req, user, {
    action: 'approval_requested',
    target_type: 'approval_request',
    target_id: id,
    details: { action, target_type: targetType, target_id: targetId },
    reason: reason.slice(0, 500),
  })
  if (auditErr.error) return { error: auditErr.error }

  return { id }
}

/** Execute the original action for an approved request. No double execution: call after status is updated to approved. */
export async function executeApprovedAction(
  supabase: SupabaseClient,
  action: string,
  payload: Record<string, unknown>
): Promise<{ error: string | null }> {
  if (action === 'user_delete') {
    const userId = payload.user_id as string
    if (!userId) return { error: 'user_id missing in payload' }
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
    return error ? { error: error.message } : { error: null }
  }

  if (action === 'user_anonymize') {
    const userId = payload.user_id as string
    if (!userId) return { error: 'user_id missing in payload' }
    const anonymizedName = `Anonymized ${userId.slice(0, 8)}`
    const { error } = await supabase
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
    return error ? { error: error.message } : { error: null }
  }

  if (action === 'bulk_reject' || action === 'bulk_suspend') {
    const ids = payload.application_ids as string[]
    if (!Array.isArray(ids) || ids.length === 0) return { error: 'application_ids missing in payload' }
    const rpcName = action === 'bulk_reject' ? 'admin_reject_application' : 'admin_suspend_application'
    for (const id of ids) {
      const { error } = await supabase.rpc(rpcName, { p_application_id: id })
      if (error) return { error: `${id}: ${error.message}` }
    }
    return { error: null }
  }

  return { error: `Unknown action: ${action}` }
}
