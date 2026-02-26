import { requireAdmin } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** GET - Admin check, current user roles, and session id. Used by admin UI to gate access and show/hide features. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  return NextResponse.json({
    authorized: true,
    roles: result.roles,
    sessionId: result.sessionId ?? undefined,
  })
}
