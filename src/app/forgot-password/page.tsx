'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/update-password`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold mb-4">Check your email</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            We sent a password reset link to <strong className="text-[var(--text)]">{email}</strong>
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-8">
            Didn&apos;t receive it? Check spam or{' '}
            <button
              type="button"
              onClick={() => { setSent(false); setError(null) }}
              className="text-[var(--accent)] hover:underline font-medium"
            >
              try again
            </button>
          </p>
          <Link href="/" className="btn-primary inline-block w-full text-center py-4">
            Back to home
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
        <h2 className="text-xl font-semibold text-center mb-2 text-[var(--text)]">Reset password</h2>
        <p className="text-center text-[var(--text-secondary)] text-sm mb-8">
          Enter your email and we&apos;ll send you a link to reset your password
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full mt-6"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Sending...' : 'Send reset link'}
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
