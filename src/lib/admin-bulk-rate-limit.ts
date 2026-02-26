/**
 * Phase 13: Simple in-memory rate limiter for admin bulk endpoints.
 * 20 requests per minute per admin. Serverless: limit is per instance per admin.
 */

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20

const store = new Map<string, { count: number; resetAt: number }>()

function prune(): void {
  const now = Date.now()
  for (const [key, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(key)
  }
}

/**
 * Check rate limit for admin bulk actions. Returns error message if over limit, null otherwise.
 */
export function checkBulkRateLimit(adminUserId: string): string | null {
  prune()
  const now = Date.now()
  const entry = store.get(adminUserId)
  if (!entry) {
    store.set(adminUserId, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  if (now >= entry.resetAt) {
    store.set(adminUserId, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return 'Too many bulk requests. Limit 20 per minute. Try again later.'
  }
  return null
}
