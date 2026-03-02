import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Trigger the welcome email by calling the send-welcome-email Edge Function.
 * The template and sending logic live in the Inthecircle repo (Supabase Edge Function);
 * this repo only invokes it with a synthetic webhook payload so the same email is sent
 * when the web admin approves an application.
 *
 * No-op if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.
 * Fire-and-forget: errors are logged but not thrown.
 */
export async function triggerWelcomeEmailForApplication(
  supabase: SupabaseClient,
  applicationId: string
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return

  const { data: row, error } = await supabase
    .from('applications')
    .select('user_id, status, updated_at')
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !row?.user_id) {
    if (error) console.error('[trigger-welcome-email]', error.message)
    return
  }

  const updatedAt =
    typeof row.updated_at === 'string'
      ? row.updated_at
      : (row.updated_at as Date)?.toISOString?.() ?? new Date().toISOString()

  const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/send-welcome-email`
  const body = {
    table: 'applications',
    type: 'UPDATE',
    record: {
      id: applicationId,
      user_id: row.user_id,
      status: 'ACTIVE',
      updated_at: updatedAt,
    },
    old_record: { status: 'PENDING' },
  }

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[trigger-welcome-email]', res.status, data)
      return
    }
    if (data.sent) {
      console.log('[trigger-welcome-email] Sent for application', applicationId)
    } else if (data.skipped) {
      console.log('[trigger-welcome-email] Skipped:', data.skipped, applicationId)
    }
  } catch (e) {
    console.error('[trigger-welcome-email]', e)
  }
}
