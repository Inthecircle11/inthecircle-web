'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/constants'

export default function DownloadPage() {
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
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
          <Link href="/" className="mt-8 text-sm text-[var(--text-secondary)] hover:underline">
            ← Back to inthecircle
          </Link>
        </>
      )}
    </div>
  )
}
