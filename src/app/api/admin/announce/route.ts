import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** POST - Send announcement. Requires announce. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.announce)
  if (forbidden) return forbidden

  const body = await req.json().catch(() => ({}))
  const { title, body: message, segment } = body
  // segment: 'all' | 'verified' | 'country:AE' etc.

  // TODO: integrate with push (e.g. OneSignal, Firebase) and/or email (Resend, SendGrid)
  console.log('[Admin Announce]', { title, message, segment })
  return NextResponse.json({
    ok: true,
    message: 'Announcement queued. Connect a push/email provider in api/admin/announce/route.ts to send.',
  })
}
