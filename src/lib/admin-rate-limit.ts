import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { adminError, getAdminRequestId } from './admin-response'

/** In-memory rate limit state: key -> list of timestamps (pruned by windowMs). */
const rateLimitStore = new Map<string, number[]>()
const PRUNE_INTERVAL = 60_000 // prune every 60s
let lastPrune = Date.now()

function prune(key: string, windowMs: number): void {
  const list = rateLimitStore.get(key)
  if (!list) return
  const cutoff = Date.now() - windowMs
  const kept = list.filter((t) => t > cutoff)
  if (kept.length === 0) rateLimitStore.delete(key)
  else rateLimitStore.set(key, kept)
}

function pruneAll(windowMs: number): void {
  const now = Date.now()
  if (now - lastPrune < PRUNE_INTERVAL) return
  lastPrune = now
  for (const key of rateLimitStore.keys()) prune(key, windowMs)
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Wrap a handler with a rate limit.
 * key: identifier for this limit (e.g. 'gate', 'bulk-applications')
 * limit: max attempts per window
 * windowMs: window in milliseconds
 * Returns 429 with adminError when limit exceeded.
 */
export async function withAdminRateLimit(
  req: NextRequest,
  key: string,
  limit: number,
  windowMs: number,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const ip = getClientIp(req)
  const storeKey = `${key}:${ip}`
  pruneAll(windowMs)
  prune(storeKey, windowMs)
  const list = rateLimitStore.get(storeKey) ?? []
  if (list.length >= limit) {
    return adminError('Too many requests. Try again later.', 429, getAdminRequestId(req))
  }
  list.push(Date.now())
  rateLimitStore.set(storeKey, list)
  return handler()
}
