import { NextRequest, NextResponse } from 'next/server'

const REQUEST_ID_HEADER = 'x-request-id'

/** Phase 13: Read request ID set by middleware (or generate if missing). */
export function getRequestId(req: NextRequest): string {
  return req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
}

/** Phase 13: Add x-request-id to a NextResponse (call before returning). */
export function addRequestIdToResponse(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId)
  return res
}

/** Phase 13: Return JSON error response with x-request-id and log server errors (5xx). */
export function jsonError(
  req: NextRequest,
  body: { error: string },
  status: number
): NextResponse {
  const requestId = getRequestId(req)
  if (status >= 500) {
    console.error(`[${requestId}]`, body.error)
  }
  return NextResponse.json(body, {
    status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  })
}

/** Phase 14.5: Return sanitized 500 response; log original error server-side only. */
export function jsonError500(req: NextRequest, originalError: unknown): NextResponse {
  const requestId = getRequestId(req)
  console.error(`[${requestId}]`, originalError)
  return jsonError(req, { error: 'Operation failed. Please try again.' }, 500)
}

/** Phase 13: Wrapper so route handler response gets x-request-id and 5xx are logged. */
export async function withRequestId(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = getRequestId(req)
  const res = await handler(req)
  res.headers.set(REQUEST_ID_HEADER, requestId)
  if (res.status >= 500) {
    console.error(`[${requestId}]`, res.status)
  }
  return res
}
