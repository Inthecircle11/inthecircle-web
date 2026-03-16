'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/Logo'
import {
  APP_DEEP_LINK_PASSWORD_RESET,
  APP_STORE_URL,
  PLAY_STORE_URL,
} from '@/lib/constants'

/** Detect mobile platform for redirecting to the correct app/store. */
function getMobilePlatform(): 'ios' | 'android' | null {
  if (typeof window === 'undefined' || !window.navigator?.userAgent) return null
  const ua = window.navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return null
}

/** After password reset: try to open native app, then fall back to store (iOS/Android) or show success state. */
function redirectToAppOrStore(
  onDesktopSuccess: () => void
) {
  const platform = getMobilePlatform()
  const appUrl = APP_DEEP_LINK_PASSWORD_RESET

  if (platform === 'ios' || platform === 'android') {
    // Try to open the app first
    window.location.href = appUrl
    // If app doesn't open (user still on page), send to the correct store after a short delay
    const storeUrl = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL
    const timeoutId = setTimeout(() => {
      window.location.href = storeUrl
    }, 2000)
    // Cancel store redirect if the app opened (page hidden)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearTimeout(timeoutId)
    }
    document.addEventListener('visibilitychange', onVisibilityChange, { once: true })
    return
  }

  // Desktop: show inline success state (middleware blocks /feed for non-app routes)
  onDesktopSuccess()
}

function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [processingToken, setProcessingToken] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function handleAuth() {
      const supabase = createClient()
      
      // Check if there's a hash fragment with access_token (from direct reset link)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type')
        
        if (accessToken && refreshToken && type === 'recovery') {
          // Set the session from the hash tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (!sessionError) {
            // Clear the hash from URL for cleaner display
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            setHasSession(true)
            setProcessingToken(false)
            return
          } else {
            console.error('[update-password] Failed to set session from hash:', sessionError.message)
          }
        }
      }
      
      // Fallback: check if user already has a session
      const { data } = await supabase.auth.getUser()
      setHasSession(!!data.user)
      setProcessingToken(false)
    }
    
    void handleAuth()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      redirectToAppOrStore(() => setSuccess(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold mb-4 text-[var(--text)]">Password updated!</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            Your password has been changed. Open the app to sign in with your new password.
          </p>
          <Link href="/download" className="btn-primary inline-block w-full text-center py-4">
            Get the app
          </Link>
        </div>
      </main>
    )
  }

  // Show loading while processing token from hash
  if (processingToken) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <div className="max-w-md w-full text-center">
          <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm">Verifying reset link...</p>
        </div>
      </main>
    )
  }

  if (hasSession === false) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <div className="max-w-md w-full text-center">
          <p className="text-[var(--text-secondary)] mb-6">Your reset link may have expired.</p>
          <Link href="/forgot-password" className="btn-primary inline-block">
            Request new link
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
      <div className="max-w-md w-full animate-fade-in">
        <Link href="/" className="text-2xl font-bold flex items-center justify-center gap-2 mb-2 gradient-text">
          <Logo size="sm" />
          inthecircle
        </Link>
        <h2 className="text-xl font-semibold text-center mb-2 text-[var(--text)]">Set new password</h2>
        <p className="text-center text-[var(--text-secondary)] text-sm mb-8">
          Enter your new password below
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="input-field"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="input-field"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full mt-6"
            disabled={loading || password.length < 6 || password !== confirmPassword}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          <Link href="/" className="text-[var(--accent)] hover:underline font-medium">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}

function UpdatePasswordFallback() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
      <div className="max-w-md w-full animate-pulse text-center text-[var(--text-secondary)]">
        Loading…
      </div>
    </main>
  )
}

export default function UpdatePassword() {
  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordForm />
    </Suspense>
  )
}
