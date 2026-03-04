import { requireAdmin } from '@/lib/admin-auth'
import { NextRequest } from 'next/server'
import { adminSuccess, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - Admin check, current user roles, and session id. Used by admin UI to gate access and show/hide features. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  return adminSuccess(
    {
      authorized: true,
      roles: result.roles,
      sessionId: result.sessionId ?? undefined,
    },
    requestId
  )
}
