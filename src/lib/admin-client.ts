/**
 * Parse standard admin API response { ok, data, error, request_id }.
 * Use after res.json() to unwrap payload or error message.
 */
export function parseAdminResponse<T = unknown>(
  res: Response,
  json: unknown
): { data: T | null; error: string | null; requestId?: string } {
  const o = json && typeof json === 'object' ? (json as { ok?: boolean; data?: T; error?: string; request_id?: string }) : {}
  if (res.ok && o.ok === true && 'data' in o) {
    return { data: o.data as T, error: null, requestId: o.request_id }
  }
  const error = typeof o.error === 'string' ? o.error : 'Request failed'
  return { data: null, error, requestId: o.request_id }
}
