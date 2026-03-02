/**
 * Server-side analytics. Use in API routes or server components.
 * Writes to analytics_events + analytics_sessions. Does not touch admin_audit_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type UserType = 'app' | 'admin'

export interface ServerEventPayload {
  event_name: string
  feature_name?: string | null
  page_name?: string | null
  user_type: UserType
  metadata?: Record<string, unknown> | null
  session_id: string
  device_type?: string | null
  country?: string | null
  app_version?: string | null
}

export interface ServerEventContext {
  user_id?: string | null
  admin_user_id?: string | null
}

const MAX_EVENT_NAME = 100
const MAX_FEATURE_NAME = 100
const MAX_PAGE_NAME = 200
const MAX_METADATA_KEYS = 20
const MAX_METADATA_KEY_LEN = 50
const MAX_METADATA_VALUE_LEN = 1000

function truncate(s: string | null | undefined, max: number): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t.length > max ? t.slice(0, max) : t || null
}

function capValue(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (typeof v === 'string') {
    let s = v.length > MAX_METADATA_VALUE_LEN ? v.slice(0, MAX_METADATA_VALUE_LEN) : v
    if (s.includes('@')) s = '[REDACTED]'
    else if (/\+?[\d\s\-()]{10,}/.test(s)) s = '[REDACTED]'
    return s
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    let out = s.length > MAX_METADATA_VALUE_LEN ? s.slice(0, MAX_METADATA_VALUE_LEN) : s
    if (out.includes('@') || /\+?[\d\s\-()]{10,}/.test(out)) out = '[REDACTED]'
    return out.length > MAX_METADATA_VALUE_LEN ? out.slice(0, MAX_METADATA_VALUE_LEN) : out
  }
  const str = String(v).slice(0, MAX_METADATA_VALUE_LEN)
  if (str.includes('@') || /\+?[\d\s\-()]{10,}/.test(str)) return '[REDACTED]'
  return str
}

function sanitizeMetadata(m: unknown): Record<string, unknown> | null {
  if (m == null || typeof m !== 'object') return null
  const o = m as Record<string, unknown>
  const entries = Object.entries(o)
    .slice(0, MAX_METADATA_KEYS)
    .map(([k, v]) => [k.slice(0, MAX_METADATA_KEY_LEN), capValue(v)])
  return Object.fromEntries(entries)
}

/**
 * Insert a single event and optionally update session. Non-blocking: do not await in critical path if you want fire-and-forget.
 */
export async function logEventServer(
  supabase: SupabaseClient,
  payload: ServerEventPayload,
  context: ServerEventContext
): Promise<{ error: string | null }> {
  const eventName = truncate(payload.event_name, MAX_EVENT_NAME)
  if (!eventName) return { error: 'event_name required' }

  const userType = payload.user_type === 'admin' ? 'admin' : 'app'
  const userId = userType === 'app' ? context.user_id ?? null : null
  const adminUserId = userType === 'admin' ? (context.admin_user_id ?? context.user_id) ?? null : null

  const { error: insertError } = await supabase.rpc('analytics_insert_event', {
    p_user_id: userId,
    p_admin_user_id: adminUserId,
    p_session_id: payload.session_id || 'unknown',
    p_event_name: eventName,
    p_feature_name: truncate(payload.feature_name, MAX_FEATURE_NAME),
    p_page_name: truncate(payload.page_name, MAX_PAGE_NAME),
    p_user_type: userType,
    p_metadata: sanitizeMetadata(payload.metadata) ?? {},
    p_device_type: truncate(payload.device_type, 50),
    p_country: truncate(payload.country, 2),
    p_app_version: truncate(payload.app_version, 50),
  })

  if (insertError) return { error: insertError.message }

  await supabase.rpc('analytics_upsert_session', {
    p_session_id: payload.session_id || 'unknown',
    p_user_id: userId,
    p_admin_user_id: adminUserId,
    p_user_type: userType,
    p_end_session: false,
    p_event_count_delta: 1,
    p_page_views_delta: 0,
    p_device_type: payload.device_type ?? null,
    p_country: payload.country ?? null,
    p_app_version: payload.app_version ?? null,
  })

  return { error: null }
}

/**
 * End a session (call when client sends end_session or session_end event).
 */
export async function endSessionServer(
  supabase: SupabaseClient,
  sessionId: string,
  userType: UserType,
  context: ServerEventContext
): Promise<{ error: string | null }> {
  const userId = userType === 'app' ? context.user_id ?? null : null
  const adminUserId = userType === 'admin' ? (context.admin_user_id ?? context.user_id) ?? null : null

  const { error } = await supabase.rpc('analytics_upsert_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_admin_user_id: adminUserId,
    p_user_type: userType,
    p_end_session: true,
    p_event_count_delta: 0,
    p_page_views_delta: 0,
    p_device_type: null,
    p_country: null,
    p_app_version: null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Insert multiple events in one go (batch). Updates session once with actual successful insert count.
 * Retries each insert once on failure; failed events are skipped and not counted.
 */
export async function logEventBatchServer(
  supabase: SupabaseClient,
  events: ServerEventPayload[],
  context: ServerEventContext,
  options?: { end_session?: boolean }
): Promise<{ error: string | null; inserted: number }> {
  if (events.length === 0) return { error: null, inserted: 0 }

  const userType = events[0]?.user_type === 'admin' ? 'admin' : 'app'
  const userId = userType === 'app' ? context.user_id ?? null : null
  const adminUserId = userType === 'admin' ? (context.admin_user_id ?? context.user_id) ?? null : null
  const sessionId = events[0]?.session_id || 'unknown'
  const deviceType = events[0]?.device_type ?? null
  const country = events[0]?.country ?? null
  const appVersion = events[0]?.app_version ?? null

  const RETRY_DELAY_MS = 50

  let inserted = 0
  for (const payload of events) {
    const eventName = truncate(payload.event_name, MAX_EVENT_NAME)
    if (!eventName || payload.event_name === '_end_session') continue

    const doInsert = async (): Promise<boolean> => {
      const { error } = await supabase.rpc('analytics_insert_event', {
        p_user_id: userId,
        p_admin_user_id: adminUserId,
        p_session_id: payload.session_id || sessionId,
        p_event_name: eventName,
        p_feature_name: truncate(payload.feature_name, MAX_FEATURE_NAME),
        p_page_name: truncate(payload.page_name, MAX_PAGE_NAME),
        p_user_type: payload.user_type === 'admin' ? 'admin' : 'app',
        p_metadata: sanitizeMetadata(payload.metadata) ?? {},
        p_device_type: payload.device_type ?? null,
        p_country: payload.country ?? null,
        p_app_version: payload.app_version ?? null,
      })
      return !error
    }

    let ok = await doInsert()
    if (!ok && RETRY_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      ok = await doInsert()
    }
    if (ok) inserted++
  }

  await supabase.rpc('analytics_upsert_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_admin_user_id: adminUserId,
    p_user_type: userType,
    p_end_session: options?.end_session ?? false,
    p_event_count_delta: inserted,
    p_page_views_delta: 0,
    p_device_type: deviceType,
    p_country: country,
    p_app_version: appVersion,
  })

  return { error: null, inserted }
}
