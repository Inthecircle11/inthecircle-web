import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''

/** Handles auth callbacks (email confirmation, password reset) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/feed'
  const base = APP_ORIGIN || new URL(request.url).origin

  // Supabase may return ?error= directly (e.g. expired OTP, access_denied)
  const errorParam = searchParams.get('error')
  if (errorParam) {
    return NextResponse.redirect(`${base}/forgot-password?error=link_expired`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${base}/forgot-password?error=link_expired`)
}
