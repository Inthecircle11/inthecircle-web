import { NextResponse } from 'next/server'
import { getRequestId } from './request-id'
import type { NextRequest } from 'next/server'

/**
 * Standard admin API success response.
 * All admin routes must use this instead of raw NextResponse.json.
 * Format: { ok: true, data, request_id }
 */
export function adminSuccess(data: unknown, requestId?: string, status = 200): NextResponse {
  const id = requestId ?? ''
  const body = { ok: true as const, data, request_id: id || undefined }
  const res = NextResponse.json(body, { status })
  if (id) res.headers.set('x-request-id', id)
  return res
}

/**
 * Standard admin API error response.
 * All admin routes must use this for errors.
 * Format: { ok: false, error, request_id }
 * Logs to console.error for 5xx.
 */
export function adminError(
  message: string,
  status = 400,
  requestId?: string
): NextResponse {
  const id = requestId ?? ''
  if (status >= 500) {
    console.error(`[${id}]`, message)
  }
  const body = { ok: false as const, error: message, request_id: id || undefined }
  const res = NextResponse.json(body, { status })
  if (id) res.headers.set('x-request-id', id)
  return res
}

/** Get request ID from request for use with adminSuccess/adminError. */
export function getAdminRequestId(req: NextRequest): string {
  return getRequestId(req)
}

/**
 * Convert an existing NextResponse (e.g. from requireAdmin or requirePermission) to standard admin error format.
 * Use when returning result.response or requirePermission(...) result.
 */
export async function adminErrorFromResponse(
  response: NextResponse,
  requestId: string
): Promise<NextResponse> {
  const status = response.status
  const cloned = response.clone()
  let message = status === 401 ? 'Not authenticated' : status === 403 ? 'Forbidden' : 'Error'
  try {
    const text = await cloned.text()
    const j = JSON.parse(text || '{}') as { error?: string }
    if (j?.error && typeof j.error === 'string') message = j.error
  } catch {
    // use default message
  }
  return adminError(message, status, requestId)
}
