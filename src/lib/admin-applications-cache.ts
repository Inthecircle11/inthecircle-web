/**
 * In-memory cache for admin applications list and counts.
 * Mutations (action, bulk, claim, release) should call clearApplicationsCache()
 * so the next GET returns fresh data.
 */

export type ApplicationsCounts = {
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
  total: number
}

let countsCache: { at: number; counts: ApplicationsCounts } | null = null
const appsCache = new Map<string, { at: number; data: Array<Record<string, unknown>> }>()

export const COUNTS_CACHE_TTL_MS = 30_000
export const APPS_CACHE_TTL_MS = 15_000

export function getCountsCache(): typeof countsCache {
  return countsCache
}

export function setCountsCache(value: typeof countsCache): void {
  countsCache = value
}

export function getAppsCache(): typeof appsCache {
  return appsCache
}

/** Call after any application mutation (single action, bulk, claim, release) so next GET is fresh. */
export function clearApplicationsCache(): void {
  countsCache = null
  appsCache.clear()
}
