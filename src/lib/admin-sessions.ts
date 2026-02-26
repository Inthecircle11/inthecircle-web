/**
 * Phase 6: Admin Session Governance.
 * Create/update admin_sessions, last_seen_at, revoked check, session anomaly escalation.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { getClientIp, getSessionId, writeAuditLog, type AuditUser } from '@/lib/audit-server'

const CONCURRENT_SESSION_THRESHOLD = 3
const COUNTRY_CHANGE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RAPID_IP_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RAPID_IP_MIN_DISTINCT = 3
const ESCALATION_DEDUPE_MS = 60 * 60 * 1000 // 1 hour per session_anomaly

export type AdminSessionRow = {
  id: string
  admin_user_id: string
  session_id: string
  ip_address: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  created_at: string
  last_seen_at: string
  revoked_at: string | null
  is_active: boolean
}

/** Get user-agent from request, truncated. */
function getUserAgent(req: NextRequest): string | null {
  const ua = req.headers.get('user-agent')
  if (!ua) return null
  return ua.length > 500 ? ua.slice(0, 500) : ua
}

/** Ensure session row exists and is not revoked; update last_seen_at. Returns 401 response if revoked, else current session_id. */
export async function ensureAdminSessionAndTouch(
  req: NextRequest,
  supabase: SupabaseClient,
  user: AuditUser
): Promise<{ response: NextResponse } | { sessionId: string }> {
  const service = getServiceRoleClient()
  if (!service) return { sessionId: (await getSessionId(supabase)) }

  const sessionId = await getSessionId(supabase)
  const ip = getClientIp(req)
  const userAgent = getUserAgent(req)
  const now = new Date().toISOString()

  const { data: existing } = await service
    .from('admin_sessions')
    .select('id, is_active, revoked_at')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; is_active: boolean; revoked_at: string | null }
    if (!row.is_active || row.revoked_at) {
      return {
        response: NextResponse.json({ error: 'Session revoked' }, { status: 401 }),
      }
    }
    await service
      .from('admin_sessions')
      .update({ last_seen_at: now })
      .eq('id', row.id)
    return { sessionId }
  }

  // New session: insert and run anomaly checks
  const { data: inserted, error: insertErr } = await service
    .from('admin_sessions')
    .insert({
      admin_user_id: user.id,
      session_id: sessionId,
      ip_address: ip,
      user_agent: userAgent,
      country: null,
      city: null,
      is_active: true,
      last_seen_at: now,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return { sessionId }
  }

  const activeForAdmin = await service
    .from('admin_sessions')
    .select('id, ip_address, country, created_at')
    .eq('admin_user_id', user.id)
    .eq('is_active', true)

  const activeRows = (activeForAdmin.data ?? []) as Array<{
    id: string
    ip_address: string | null
    country: string | null
    created_at: string
  }>

  const otherFromDifferentIp = activeRows.filter(
    (r) => r.id !== (inserted as { id: string }).id && r.ip_address && r.ip_address !== ip
  )
  if (otherFromDifferentIp.length > 0) {
    await writeAuditLog(service, req, user, {
      action: 'session_anomaly',
      target_type: 'admin_session',
      target_id: (inserted as { id: string }).id,
      details: { reason: 'different_ip', other_ips: otherFromDifferentIp.map((r) => r.ip_address) },
    })
    await maybeCreateSessionAnomalyEscalation(service, user.id, 'different_ip', activeRows.length)
  }

  if (activeRows.length > CONCURRENT_SESSION_THRESHOLD) {
    await maybeCreateSessionAnomalyEscalation(service, user.id, 'concurrent_sessions', activeRows.length)
  }

  const recentForCountry = await service
    .from('admin_sessions')
    .select('country')
    .eq('admin_user_id', user.id)
    .gte('created_at', new Date(Date.now() - COUNTRY_CHANGE_WINDOW_MS).toISOString())
  const recentCountries = (recentForCountry.data ?? []) as Array<{ country: string | null }>
  const countries = [...new Set(recentCountries.map((r) => r.country).filter(Boolean))]
  if (countries.length >= 2) {
    await maybeCreateSessionAnomalyEscalation(service, user.id, 'country_change', countries.length)
  }

  const recentForIp = await service
    .from('admin_sessions')
    .select('ip_address')
    .eq('admin_user_id', user.id)
    .gte('created_at', new Date(Date.now() - RAPID_IP_WINDOW_MS).toISOString())
  const recentIps = (recentForIp.data ?? []) as Array<{ ip_address: string | null }>
  const distinctIps = new Set(recentIps.map((r) => r.ip_address).filter(Boolean))
  if (distinctIps.size >= RAPID_IP_MIN_DISTINCT) {
    await maybeCreateSessionAnomalyEscalation(service, user.id, 'rapid_ip_switch', distinctIps.size)
  }

  return { sessionId }
}

async function maybeCreateSessionAnomalyEscalation(
  supabase: SupabaseClient,
  adminUserId: string,
  reason: string,
  value: number
): Promise<void> {
  const since = new Date(Date.now() - ESCALATION_DEDUPE_MS).toISOString()
  const { data: recent } = await supabase
    .from('admin_escalations')
    .select('id')
    .eq('metric_name', 'session_anomaly')
    .gte('created_at', since)
    .limit(1)
  if (recent && recent.length > 0) return

  await supabase.from('admin_escalations').insert({
    metric_name: 'session_anomaly',
    metric_value: value,
    threshold_level: 'yellow',
    status: 'open',
    notes: `admin_user_id=${adminUserId} reason=${reason}`,
  })
}
