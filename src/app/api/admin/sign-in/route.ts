import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Admin sign-in rate limiting and "Multiple failed attempts" message:
 *
 * The message comes from Supabase Auth (their hosted layer). The exact attempt
 * limit is not documented in the public API; it is likely tied to:
 * - Dashboard → Authentication → Rate Limits → "Rate limit for sign-ups and sign-ins"
 *   (configurable, e.g. per IP per 5 minutes). There is a known bug where the
 *   configured value is not always enforced and ~30–50 requests may be allowed.
 * - A separate protection for failed password attempts (per email or per IP).
 *
 * Users can see the message "from the beginning" if:
 * - The same IP already had many sign-in attempts (e.g. office/school VPN, shared WiFi).
 * - The project has a very low rate limit set in the Dashboard.
 * - Multiple tabs or quick retries count as multiple attempts.
 *
 * To raise the limit: use Supabase Dashboard → Authentication → Rate Limits and increase
 * "Rate limit for sign-ups and sign-ins", or run: npm run increase-auth-rate-limits
 * (requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens).
 */

const FRIENDLY_MESSAGE =
  "Too many sign-in attempts. Please wait a few minutes and try again, or reset your password if you don't remember it."

function parseEnvList(env: string | undefined): string[] {
  if (!env || typeof env !== 'string') return []
  return env
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** Normalize Supabase auth errors to a user-friendly message (avoids "Multiple failed attempts. Please verify your credentials."). */
function normalizeAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('multiple failed') ||
    lower.includes('verify your credentials') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('too many attempts')
  ) {
    return FRIENDLY_MESSAGE
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Invalid email or password. Please check and try again.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }
  return message
}

/** POST - Admin sign-in. Runs on server so we can return a friendly error instead of Supabase's "Multiple failed attempts" message. */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Please enter your email and password.' },
      { status: 400 }
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const friendlyMessage = normalizeAuthError(error.message)
    return NextResponse.json({ error: friendlyMessage }, { status: 401 })
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 401 })
  }

  const adminUserIds = parseEnvList(process.env.ADMIN_USER_IDS)
  const adminEmails = parseEnvList(process.env.ADMIN_EMAILS)
  const isAllowlisted =
    (data.user.id && adminUserIds.includes(data.user.id.toLowerCase())) ||
    (data.user.email && adminEmails.includes(data.user.email.toLowerCase()))

  if (!isAllowlisted) {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'This account is not authorized to access the admin panel.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, data: { authorized: true } })
}
