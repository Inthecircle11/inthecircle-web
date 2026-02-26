'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface MFAChallengeProps {
  onSuccess: () => void
  onCancel?: () => void
}

export default function MFAChallenge({ onSuccess, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedCode = code.replace(/\s/g, '').trim()
    if (!trimmedCode || trimmedCode.length < 6) {
      setError('Please enter the 6-digit code from your authenticator app.')
      setLoading(false)
      return
    }

    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError

      const totpFactor = factorsData?.totp?.[0]
      if (!totpFactor) {
        setError('No authenticator app found. Please set up 2FA first.')
        setLoading(false)
        return
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: trimmedCode,
      })
      if (verifyError) throw verifyError

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--text)]">Two-factor authentication</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="input-field text-center text-2xl tracking-[0.5em] font-mono"
          disabled={loading}
          autoFocus
          autoComplete="one-time-code"
        />
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || code.length < 6}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 text-[var(--text-secondary)] hover:text-[var(--text)] text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  )
}
