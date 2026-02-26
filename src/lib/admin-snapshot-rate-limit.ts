/**
 * Phase 14.5: Rate limiter for audit snapshot endpoint.
 * 5 requests per minute per admin. Serverless: limit is per instance per admin.
 */

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 5

const store = new Map<string, { count: number; resetAt: number }>()

function prune(): void {
  const now = Date.now()
  for (const [key, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(key)
  }
}

/**
 * Check rate limit for audit snapshot. Returns error message if over limit, null otherwise.
 */
export function checkSnapshotRateLimit(adminUserId: string): string | null {
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
    return 'Too many snapshot requests. Limit 5 per minute. Try again later.'
  }
  return null
}
