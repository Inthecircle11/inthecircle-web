/**
 * Admin applications cache.
 * In-memory caching removed for serverless safety.
 * If caching is required, add a TODO for Redis/KV and default to no cache.
 */

export type ApplicationsCounts = {
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
  total: number
}

/** No-op: cache removed. Kept for API compatibility. */
export function getCountsCache(): { at: number; counts: ApplicationsCounts } | null {
  return null
}

/** No-op: cache removed. */
export function setCountsCache(_value: { at: number; counts: ApplicationsCounts } | null): void {
  // no-op
}

/** No-op: cache removed. Returns empty Map for compatibility. */
export function getAppsCache(): Map<string, { at: number; data: Array<Record<string, unknown>> }> {
  return new Map()
}

/** No-op: call after mutations for future cache implementation (e.g. Redis/KV). */
export function clearApplicationsCache(): void {
  // no-op
}
