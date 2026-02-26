'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface MFAEnrollProps {
  onEnrolled: () => void
  onCancelled: () => void
}

export default function MFAEnroll({ onEnrolled, onCancelled }: MFAEnrollProps) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrollLoading, setEnrollLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const enroll = async () => {
      setEnrollLoading(true)
      setError(null)
      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'inthecircle',
          issuer: 'inthecircle',
        })
        if (enrollError) throw enrollError
        setFactorId(data.id)
        setQrCode(data.totp?.qr_code ?? null)
        setSecret(data.totp?.secret ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start 2FA setup')
      } finally {
        setEnrollLoading(false)
      }
    }
    enroll()
  }, [])

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)

    const trimmedCode = verifyCode.replace(/\s/g, '').trim()
    if (!trimmedCode || trimmedCode.length < 6) {
      setError('Please enter the 6-digit code from your authenticator app.')
      setLoading(false)
      return
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: trimmedCode,
      })
      if (verifyError) throw verifyError

      onEnrolled()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (enrollLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-[var(--text-secondary)]">Setting up 2FA...</p>
      </div>
    )
  }

  if (error && !factorId) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
        <button onClick={onCancelled} className="btn-primary w-full">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[var(--text)]">Set up authenticator app</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Scan the QR code with Google Authenticator, Authy, or any TOTP app
        </p>
      </div>

      {qrCode && (
        <div className="flex justify-center p-4 bg-white rounded-xl">
          <img
            src={qrCode}
            alt="QR code for authenticator"
            className="w-48 h-48"
          />
        </div>
      )}

      {secret && (
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] font-medium mb-2">Or enter manually</p>
          <p className="font-mono text-sm text-[var(--text)] break-all">{secret}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleEnable} className="space-y-4">
        <div>
          <label htmlFor="verify-code" className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
            Enter the 6-digit code from your app
          </label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            className="input-field text-center text-xl tracking-[0.4em] font-mono"
            disabled={loading}
            autoComplete="one-time-code"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelled}
            className="flex-1 py-3 rounded-xl font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 btn-primary"
            disabled={loading || verifyCode.length < 6}
          >
            {loading ? 'Verifying...' : 'Enable 2FA'}
          </button>
        </div>
      </form>
    </div>
  )
}
