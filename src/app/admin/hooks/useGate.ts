'use client'

import { useEffect, useState, useCallback } from 'react'
import { parseAdminResponse } from '@/lib/admin-client'

export function useGate() {
  const [gateUnlocked, setGateUnlocked] = useState<boolean | null>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  const [gateSubmitting, setGateSubmitting] = useState(false)

  const checkGate = useCallback(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setGateUnlocked(false)
        setGateError('Gate check timed out. Check your connection and try again.')
      }
    }, 10000)
    fetch('/api/admin/gate', { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json()
        return { res, json }
      })
      .then(({ res, json }) => {
        if (!cancelled) {
          clearTimeout(timeoutId)
          const { data } = parseAdminResponse<{ unlocked?: boolean }>(res, json)
          setGateUnlocked(data?.unlocked === true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeoutId)
          setGateUnlocked(false)
          setGateError('Could not reach gate. Check your connection and try again.')
        }
      })
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const cleanup = checkGate()
    return cleanup
  }, [checkGate])

  const submitGate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setGateError(null)
    setGateSubmitting(true)
    try {
      const res = await fetch('/api/admin/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: gatePassword }),
      })
      const json = await res.json()
      const { data, error } = parseAdminResponse<{ ok?: boolean }>(res, json)
      if (error) {
        setGateError(error)
      } else if (data) {
        setGateUnlocked(true)
        setGatePassword('')
      }
    } catch {
      setGateError('Something went wrong')
    }
    setGateSubmitting(false)
  }, [gatePassword])

  return {
    gateUnlocked,
    setGateUnlocked,
    gatePassword,
    setGatePassword,
    gateError,
    setGateError,
    gateSubmitting,
    submitGate,
    checkGate,
  }
}
