import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditUser = { id: string; email: string | null }

/** Actions that require a reason and are rate-limited */
export const DESTRUCTIVE_ACTIONS = new Set([
  'user_delete',
  'user_anonymize',
  'bulk_reject',
  'bulk_suspend',
])

const REASON_MIN_LENGTH = 5
const REASON_MAX_LENGTH = 500
const RATE_LIMIT_WINDOW_HOURS = 1
const DEFAULT_RATE_LIMIT_PER_HOUR = 5

function getRateLimitThreshold(): number {
  const v = process.env.ADMIN_DESTRUCTIVE_RATE_LIMIT_PER_HOUR
  if (v === undefined || v === '') return DEFAULT_RATE_LIMIT_PER_HOUR
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RATE_LIMIT_PER_HOUR
}

/** Read client IP from request (x-forwarded-for or x-real-ip). */
export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first && first.length <= 45) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real && real.length <= 45) return real
  return null
}

/** Get session ID from Supabase session, or fallback UUID. */
export async function getSessionId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const sessionId = data.session?.access_token?.slice(0, 32)
  if (sessionId) return sessionId
  return crypto.randomUUID()
}

export interface AuditPayload {
  action: string
  target_type?: string | null
  target_id?: string | null
  details?: Record<string, unknown> | null
  reason?: string | null
}

/** Validate reason for destructive actions. Returns error message or null. */
export function validateReasonForDestructive(action: string, reason: unknown): string | null {
  if (!DESTRUCTIVE_ACTIONS.has(action)) return null
  if (reason == null || typeof reason !== 'string') return 'reason required for this action'
  const trimmed = reason.trim()
  if (trimmed.length < REASON_MIN_LENGTH) return `reason must be at least ${REASON_MIN_LENGTH} characters`
  if (trimmed.length > REASON_MAX_LENGTH) return `reason must be at most ${REASON_MAX_LENGTH} characters`
  return null
}

/** Check destructive action rate limit. Returns error message if over limit. */
export async function checkDestructiveRateLimit(
  supabase: SupabaseClient,
  adminUserId: string,
  action: string,
  extraCount: number = 0
): Promise<string | null> {
  if (!DESTRUCTIVE_ACTIONS.has(action)) return null
  const threshold = getRateLimitThreshold()
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const orFilter =
    'action.eq.user_delete,action.eq.user_anonymize,action.eq.bulk_reject,action.eq.bulk_suspend'

  const { count, error } = await supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('admin_user_id', adminUserId)
    .gte('created_at', windowStart)
    .or(orFilter)

  if (error) return 'Rate limit check failed'
  const current = (count ?? 0) + extraCount
  if (current >= threshold) {
    return `Rate limit exceeded: max ${threshold} destructive action(s) per ${RATE_LIMIT_WINDOW_HOURS} hour(s). Try again later.`
  }
  return null
}

/** Insert one audit log row. Caller must enforce reason for destructive actions. */
export async function writeAuditLog(
  supabase: SupabaseClient,
  req: NextRequest,
  user: AuditUser,
  payload: AuditPayload
): Promise<{ error: string | null }> {
  const clientIp = getClientIp(req)
  const sessionId = await getSessionId(supabase)
  const reason =
    payload.reason != null && typeof payload.reason === 'string'
      ? payload.reason.trim().slice(0, REASON_MAX_LENGTH)
      : null

  const { error } = await supabase.from('admin_audit_log').insert({
    admin_user_id: user.id,
    admin_email: user.email ?? undefined,
    action: payload.action.slice(0, 100),
    target_type: payload.target_type ?? null,
    target_id: payload.target_id ?? null,
    details: payload.details ?? {},
    reason: reason || null,
    client_ip: clientIp,
    session_id: sessionId,
  })

  if (error) return { error: error.message }
  return { error: null }
}
