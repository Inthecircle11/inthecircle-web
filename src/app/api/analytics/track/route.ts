import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { logEventBatchServer, endSessionServer } from '@/lib/analytics-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const MAX_EVENTS_PER_REQUEST = 20
const RATE_LIMIT_WINDOW_MS = 60 * 1000
/** Authenticated: 60 batches/min per user. */
const MAX_BATCH_PER_USER_PER_MINUTE = 60
/** Unauthenticated (app_open/session_start only): 10 batches/min per IP. */
const MAX_BATCH_UNAUTH_PER_IP_PER_MINUTE = 10

const ALLOWED_UNAUTH_EVENTS = new Set(['app_open', 'session_start'])

const ipCounts = new Map<string, { count: number; resetAt: number }>()
const userCounts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function rateLimitAuthenticated(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  if (userCounts.size > 10_000) {
    for (const [key, entry] of userCounts.entries()) {
      if (entry.resetAt < now) userCounts.delete(key)
    }
  }
  let entry = userCounts.get(userId)
  if (!entry) {
    userCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
    userCounts.set(userId, entry)
    return { allowed: true }
  }
  entry.count++
  if (entry.count > MAX_BATCH_PER_USER_PER_MINUTE) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true }
}

function rateLimitUnauthenticated(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  if (ipCounts.size > 10_000) {
    for (const [key, entry] of ipCounts.entries()) {
      if (entry.resetAt < now) ipCounts.delete(key)
    }
  }
  let entry = ipCounts.get(ip)
  if (!entry) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
    ipCounts.set(ip, entry)
    return { allowed: true }
  }
  entry.count++
  if (entry.count > MAX_BATCH_UNAUTH_PER_IP_PER_MINUTE) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true }
}

function parseBody(body: unknown): {
  events?: unknown[]
  session_id?: string
  device_type?: string
  app_version?: string
  end_session?: boolean
} | null {
  if (body == null || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  return {
    events: Array.isArray(b.events) ? b.events : undefined,
    session_id: typeof b.session_id === 'string' ? b.session_id.slice(0, 128) : undefined,
    device_type: typeof b.device_type === 'string' ? b.device_type.slice(0, 50) : undefined,
    app_version: typeof b.app_version === 'string' ? b.app_version.slice(0, 50) : undefined,
    end_session: b.end_session === true,
  }
}

function normalizeEvent(e: unknown): {
  event_name: string
  feature_name?: string | null
  page_name?: string | null
  user_type: 'app' | 'admin'
  metadata?: Record<string, unknown> | null
  session_id?: string
  device_type?: string | null
  app_version?: string | null
} | null {
  if (e == null || typeof e !== 'object') return null
  const o = e as Record<string, unknown>
  const eventName = typeof o.event_name === 'string' ? o.event_name.trim().slice(0, 100) : null
  if (!eventName) return null
  const userType = o.user_type === 'admin' ? 'admin' : 'app'
  return {
    event_name: eventName,
    feature_name: typeof o.feature_name === 'string' ? o.feature_name.slice(0, 100) : null,
    page_name: typeof o.page_name === 'string' ? o.page_name.slice(0, 200) : null,
    user_type: userType,
    metadata: o.metadata && typeof o.metadata === 'object' ? (o.metadata as Record<string, unknown>) : null,
    session_id: typeof o.session_id === 'string' ? o.session_id.slice(0, 128) : undefined,
    device_type: typeof o.device_type === 'string' ? o.device_type.slice(0, 50) : null,
    app_version: typeof o.app_version === 'string' ? o.app_version.slice(0, 50) : null,
  }
}

/** POST /api/analytics/track — batch events, optional end_session. Auth required except app_open/session_start (strict limit). */
export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 })
  }

  const ip = getClientIp(req)

  let body: ReturnType<typeof parseBody>
  try {
    const raw = await req.text()
    const parsed = raw ? JSON.parse(raw) : null
    body = parseBody(parsed)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || !body.events || body.events.length === 0) {
    return NextResponse.json({ error: 'events array required' }, { status: 400 })
  }

  if (body.events.length > MAX_EVENTS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Max ${MAX_EVENTS_PER_REQUEST} events per request` },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const events = body.events.map(normalizeEvent).filter(Boolean) as Array<{
    event_name: string
    feature_name?: string | null
    page_name?: string | null
    user_type: 'app' | 'admin'
    metadata?: Record<string, unknown> | null
    session_id?: string
    device_type?: string | null
    app_version?: string | null
  }>

  const userTypes = new Set(events.map((e) => e.user_type))
  if (userTypes.size > 1) {
    return NextResponse.json(
      { error: 'All events in a batch must have the same user_type (app or admin)' },
      { status: 400 }
    )
  }

  const userType = events[0]?.user_type ?? 'app'
  const isUnauth = !user?.id
  const allowedEventNames = new Set(events.map((e) => e.event_name).filter((n) => n !== '_end_session'))

  if (isUnauth) {
    const disallowed = [...allowedEventNames].filter((n) => !ALLOWED_UNAUTH_EVENTS.has(n))
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: 'Authentication required for tracking. Only app_open and session_start allowed when not logged in.' },
        { status: 401 }
      )
    }
    const rl = rateLimitUnauthenticated(ip)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
      )
    }
  } else {
    const rl = rateLimitAuthenticated(user.id)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
      )
    }
  }

  const sessionId = body.session_id ?? 'unknown'
  const deviceType = body.device_type ?? null
  const appVersion = body.app_version ?? null

  const context = {
    user_id: user?.id ?? null,
    admin_user_id: null as string | null,
  }

  const service = getServiceRoleClient()
  if (!service) {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 })
  }

  const isAdmin = userType === 'admin'
  if (isAdmin && user?.id) (context as { admin_user_id: string | null }).admin_user_id = user.id

  const hasEndSession = events.some((e) => e.event_name === '_end_session')
  const eventsToInsert = events.filter((e) => e.event_name !== '_end_session')

  const payloads = eventsToInsert.map((e) => ({
    ...e,
    session_id: e.session_id ?? sessionId,
    device_type: e.device_type ?? deviceType,
    app_version: e.app_version ?? appVersion,
    country: null as string | null,
  }))

  const { error, inserted } = await logEventBatchServer(service, payloads, context, {
    end_session: body.end_session || hasEndSession,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to store events' }, { status: 500 })
  }

  if (body.end_session || hasEndSession) {
    await endSessionServer(service, sessionId, userType, context)
  }

  return NextResponse.json({ ok: true, inserted }, { status: 200 })
}
