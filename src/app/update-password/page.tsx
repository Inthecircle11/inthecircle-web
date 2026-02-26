'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

export default function UpdatePassword() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/feed'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setHasSession(!!data.user)
    }
    void check()
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
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
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
