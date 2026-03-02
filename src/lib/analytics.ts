/**
 * Client-side analytics. Fire-and-forget, batched, session-aware.
 * Does not block UI. Uses session storage for session_id and last activity.
 */

import {
  APP_EVENTS,
  ADMIN_EVENTS,
  type AppEventName,
  type AdminEventName,
} from './analytics-events'

const SESSION_ID_KEY = 'analytics_session_id'
const SESSION_START_KEY = 'analytics_session_start'
const LAST_ACTIVITY_KEY = 'analytics_last_activity'
const INACTIVITY_MS = 30 * 60 * 1000 // 30 min
const BATCH_MAX = 10
const BATCH_MS = 2000
const ENDPOINT = '/api/analytics/track'

export type UserType = 'app' | 'admin'

export interface AnalyticsEventPayload {
  event_name: string
  feature_name?: string | null
  page_name?: string | null
  user_type: UserType
  metadata?: Record<string, unknown> | null
}

const queue: AnalyticsEventPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    sessionStorage.setItem(SESSION_ID_KEY, id)
    sessionStorage.setItem(SESSION_START_KEY, String(Date.now()))
  }
  return id
}

function touchLastActivity(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return true
  const last = sessionStorage.getItem(LAST_ACTIVITY_KEY)
  if (!last) return true
  return Date.now() - parseInt(last, 10) > INACTIVITY_MS
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function getAppVersion(): string {
  if (typeof window === 'undefined') return ''
  try {
    const d = (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__
    return typeof d?.buildId === 'string' ? d.buildId.slice(0, 50) : ''
  } catch {
    return ''
  }
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (queue.length === 0) return
  const batch = queue.splice(0, BATCH_MAX)
  const sessionId = getSessionId()
  const deviceType = getDeviceType()
  const appVersion = getAppVersion()
  const body = {
    events: batch.map((e) => ({
      ...e,
      session_id: sessionId,
      device_type: deviceType,
      app_version: appVersion,
    })),
    session_id: sessionId,
    device_type: deviceType,
    app_version: appVersion,
    end_session: false,
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    queue.unshift(...batch)
  })
}

/**
 * Flush pending events and end-session payload via sendBeacon (for pagehide/termination).
 * Use this instead of flush() when the page is being unloaded so the request is reliably sent.
 */
function flushWithBeacon(userType: UserType): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  const sessionId = getSessionId()
  const deviceType = getDeviceType()
  const appVersion = getAppVersion()
  const eventName = userType === 'admin' ? ADMIN_EVENTS.admin_session_end : APP_EVENTS.session_end
  const events = queue.splice(0, BATCH_MAX).map((e) => ({
    ...e,
    session_id: sessionId,
    device_type: deviceType,
    app_version: appVersion,
  }))
  events.push(
    { event_name: eventName, user_type: userType, metadata: { new_session: false }, session_id: sessionId, device_type: deviceType, app_version: appVersion },
    { event_name: '_end_session', user_type: userType, metadata: { end: true }, session_id: sessionId, device_type: deviceType, app_version: appVersion }
  )
  const body = {
    events,
    session_id: sessionId,
    device_type: deviceType,
    app_version: appVersion,
    end_session: true,
  }
  const url = typeof window !== 'undefined' && window.location?.origin ? `${window.location.origin}${ENDPOINT}` : ENDPOINT
  navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }))
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, BATCH_MS)
}

/**
 * Track a single event. Non-blocking; queues and batches.
 * User id is resolved server-side from session when credentials: 'include'.
 */
export function trackEvent(
  eventName: AppEventName | AdminEventName | string,
  options: {
    userType: UserType
    featureName?: string | null
    pageName?: string | null
    metadata?: Record<string, unknown> | null
  }
): void {
  if (typeof window === 'undefined') return
  touchLastActivity()
  const payload: AnalyticsEventPayload = {
    event_name: String(eventName).slice(0, 100),
    feature_name: options.featureName?.slice(0, 100) ?? null,
    page_name: options.pageName?.slice(0, 200) ?? null,
    user_type: options.userType,
    metadata:
      options.metadata && typeof options.metadata === 'object'
        ? (Object.fromEntries(
            Object.entries(options.metadata).slice(0, 20).map(([k, v]) => [k.slice(0, 50), v])
          ) as Record<string, unknown>)
        : null,
  }
  queue.push(payload)
  if (queue.length >= BATCH_MAX) flush()
  else scheduleFlush()
}

/** App user: track with user_type 'app'. */
export function trackAppEvent(
  eventName: AppEventName | string,
  options?: { featureName?: string; pageName?: string; metadata?: Record<string, unknown> }
): void {
  trackEvent(eventName, { userType: 'app', ...options })
}

/** Admin user: track with user_type 'admin'. */
export function trackAdminEvent(
  eventName: AdminEventName | string,
  options?: { featureName?: string; pageName?: string; metadata?: Record<string, unknown> }
): void {
  trackEvent(eventName, { userType: 'admin', ...options })
}

/** Call on app load / admin load to start session and send session_start. */
export function startSession(userType: UserType): void {
  if (typeof window === 'undefined') return
  const expired = isSessionExpired()
  const sessionId = getSessionId()
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
  const eventName = userType === 'admin' ? ADMIN_EVENTS.admin_session_start : APP_EVENTS.session_start
  trackEvent(eventName, { userType, metadata: { new_session: expired } })
  if (expired) {
    queue.push({
      event_name: 'session_heartbeat',
      user_type: userType,
      metadata: { session_id: sessionId },
    })
    scheduleFlush()
  }
}

/** Call when user leaves (pagehide) or after inactivity to end session. */
export function endSession(userType: UserType): void {
  if (typeof window === 'undefined') return
  const eventName = userType === 'admin' ? ADMIN_EVENTS.admin_session_end : APP_EVENTS.session_end
  trackEvent(eventName, { userType })
  queue.push({
    event_name: '_end_session',
    user_type: userType,
    metadata: { end: true },
  })
  flush()
}

/**
 * End session and send via sendBeacon (for pagehide/visibilitychange).
 * Use this in pagehide handler so the request is reliably delivered when the tab is closed.
 * Replaces deprecated beforeunload/unload listeners.
 */
export function endSessionWithBeacon(userType: UserType): void {
  if (typeof window === 'undefined') return
  flushWithBeacon(userType)
}

/** Heartbeat: call periodically (e.g. every 5 min) to extend session and optionally send tab time. */
export function heartbeat(userType: UserType, tabOrPage?: string): void {
  if (typeof window === 'undefined') return
  touchLastActivity()
  if (tabOrPage) {
    trackEvent(ADMIN_EVENTS.admin_tab_time_spent, {
      userType: 'admin',
      featureName: tabOrPage,
      metadata: { tab: tabOrPage },
    })
  }
}

/** Get current session id (for debugging or server correlation). */
export function getCurrentSessionId(): string {
  return getSessionId()
}

/** Check if current session is considered expired (e.g. to show login again). */
export function getSessionExpired(): boolean {
  return isSessionExpired()
}

// Re-export event names for convenience
export { APP_EVENTS, ADMIN_EVENTS }
