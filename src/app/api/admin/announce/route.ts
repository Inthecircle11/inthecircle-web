import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

const MAX_EMAIL_RECIPIENTS = 50

/** Get recipient emails: from body.to, env RESEND_ANNOUNCE_TO, or Supabase (segment 'all' only). */
async function getRecipientEmails(
  body: { to?: string[]; segment?: string }
): Promise<{ emails: string[]; error?: string }> {
  if (Array.isArray(body.to) && body.to.length > 0) {
    const emails = body.to.filter((e): e is string => typeof e === 'string' && e.includes('@'))
    return { emails }
  }
  const envTo = process.env.RESEND_ANNOUNCE_TO
  if (envTo && typeof envTo === 'string') {
    const emails = envTo.split(',').map((e) => e.trim()).filter((e) => e.includes('@'))
    return { emails }
  }
  if (body.segment === 'all') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return { emails: [], error: 'Missing Supabase config for segment' }
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: MAX_EMAIL_RECIPIENTS, page: 1 })
    if (error) return { emails: [], error: error.message }
    const emails = (data?.users ?? [])
      .map((u) => u.email)
      .filter((e): e is string => typeof e === 'string' && e.includes('@'))
    return { emails }
  }
  return {
    emails: [],
    error: 'Set body.to (array of emails), RESEND_ANNOUNCE_TO, or segment "all" to send. Push (OneSignal/Firebase) can be added in the same route when needed.',
  }
}

/** POST - Send announcement. Requires announce. Sends email when RESEND_API_KEY and RESEND_FROM_EMAIL are set. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.announce)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const body = await req.json().catch(() => ({})) as { title?: string; body?: string; segment?: string; to?: string[] }
  const title = typeof body.title === 'string' ? body.title : 'Announcement'
  const message = typeof body.body === 'string' ? body.body : ''
  const segment = typeof body.segment === 'string' ? body.segment : 'all'

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (apiKey && fromEmail) {
    const { emails, error: recipientError } = await getRecipientEmails(body)
    if (recipientError && emails.length === 0) {
      return adminError(recipientError, 400, requestId)
    }
    if (emails.length > 0) {
      const resend = new Resend(apiKey)
      const toList = emails.slice(0, MAX_EMAIL_RECIPIENTS)
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: toList,
        subject: title,
        html: message ? `<p>${message.replace(/\n/g, '</p><p>')}</p>` : '<p>No message body.</p>',
      })
      if (error) {
        console.error('[Admin Announce] Resend error:', error)
        return adminError((error as { message?: string }).message ?? 'Email send failed', 500, requestId)
      }
      console.log('[Admin Announce]', { title, segment, sent: toList.length, id: data?.id })
      return adminSuccess({
        ok: true,
        message: `Announcement sent to ${toList.length} recipient(s).`,
        id: data?.id,
      }, requestId)
    }
  }

  console.log('[Admin Announce]', { title, message, segment })
  return adminSuccess({
    ok: true,
    message: apiKey && fromEmail
      ? 'Announcement logged. Add body.to, RESEND_ANNOUNCE_TO, or use segment "all" to send email.'
      : 'Announcement queued. Set RESEND_API_KEY and RESEND_FROM_EMAIL to send email. Push (OneSignal/Firebase) can be added when needed.',
  }, requestId)
}
