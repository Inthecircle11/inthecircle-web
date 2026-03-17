'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/constants'

/** If the URL hash contains Supabase recovery tokens, we're a password-reset link that landed on /download. */
function hasRecoveryHash(): boolean {
  if (typeof window === 'undefined' || !window.location.hash) return false
  const params = new URLSearchParams(window.location.hash.substring(1))
  return params.get('type') === 'recovery' && !!params.get('access_token')
}

/** Supabase auth error in hash (e.g. otp_expired, access_denied) — send user to forgot-password to request a new link. */
function hasAuthErrorHash(): boolean {
  if (typeof window === 'undefined' || !window.location.hash) return false
  const params = new URLSearchParams(window.location.hash.substring(1))
  const error = params.get('error')
  const errorCode = params.get('error_code')
  const desc = params.get('error_description') || ''
  return error === 'access_denied' || errorCode === 'otp_expired' || /expired|invalid/i.test(desc)
}

export default function DownloadPage() {
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Password reset link: Supabase may redirect to /download with tokens in hash. Send user to set password.
    if (hasRecoveryHash()) {
      window.location.replace(`/update-password${window.location.hash}`)
      return
    }
    // Expired/invalid reset link: Supabase sends error in hash. Send user to forgot-password to request a new link.
    if (hasAuthErrorHash()) {
      window.location.replace('/forgot-password?error=link_expired')
      return
    }
    const ua = window.navigator.userAgent.toLowerCase()
    const isAndroid = /android/i.test(ua)
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    if (isAndroid) {
      setRedirected(true)
      window.location.href = PLAY_STORE_URL
      return
    }
    if (isIOS) {
      setRedirected(true)
      window.location.href = APP_STORE_URL
      return
    }
  }, [])

  // Fallback: desktop or slow redirect — show both options
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6">
      {redirected ? (
        <p className="text-[var(--text-secondary)]">Redirecting to the store…</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-[var(--text)] mb-2">Get Inthecircle</h1>
          <p className="text-[var(--text-secondary)] text-center mb-8 max-w-sm">
            Download on your phone, or choose a store below.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--text)] text-[var(--bg)] px-6 py-3 font-medium hover:opacity-90 transition"
            >
              App Store (iOS)
            </a>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-purple)] text-white px-6 py-3 font-medium hover:opacity-90 transition"
            >
              Google Play (Android)
            </a>
          </div>
          <p className="mt-6 text-sm text-[var(--text-muted)]">
            Resetting your password?{' '}
            <Link href="/forgot-password" className="text-[var(--accent)] hover:underline font-medium">
              Request a new link
            </Link>
          </p>
          <Link href="/" className="mt-8 text-sm text-[var(--text-secondary)] hover:underline">
            ← Back to inthecircle
          </Link>
        </>
      )}
    </div>
  )
}
