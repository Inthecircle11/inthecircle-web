'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { parseAdminResponse } from '@/lib/admin-client'

export function useAdminAuth() {
  const [authorized, setAuthorized] = useState(false)
  const [adminRoles, setAdminRoles] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false)

  const checkAuth = useCallback(async (onAuthorized?: () => void | Promise<void>) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAuthorized(false)
        return { error: 'Please log in with your admin account to access this panel.' }
      }
      const res = await fetch('/api/admin/check', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        return { error: 'Session expired. Please log in again.' }
      }
      const { data } = parseAdminResponse<{ authorized?: boolean; roles?: string[]; sessionId?: string }>(res, json)
      const isAuthorized = !!data?.authorized
      const roles = Array.isArray(data?.roles) ? data.roles : []
      if (!isAuthorized) {
        setAuthorized(false)
        setLoginError('This account is not authorized to access the admin panel.')
        return { error: 'Not authorized' }
      }
      setAuthorized(true)
      setAdminRoles(roles)
      setCurrentUserId(user.id)
      await onAuthorized?.()
      return { error: null }
    } catch (e) {
      console.error('[admin] checkAuth failed', e)
      setAuthorized(false)
      return { error: 'Failed to load admin. Check your connection and try again.' }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null)
    setLoginLoading(true)
    const supabase = createClient()
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setLoginError(signInError.message)
        return false
      }
      const res = await fetch('/api/admin/check', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ authorized?: boolean }>(res, json)
      if (!data?.authorized) {
        await supabase.auth.signOut()
        setLoginError('This account is not authorized to access the admin panel.')
        return false
      }
      return true
    } catch {
      setLoginError('Something went wrong. Please try again.')
      return false
    } finally {
      setLoginLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setAuthorized(false)
    setAdminRoles([])
    setCurrentUserId(null)
  }, [])

  return {
    authorized,
    setAuthorized,
    adminRoles,
    setAdminRoles,
    currentUserId,
    setCurrentUserId,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    setLoginError,
    loginLoading,
    setLoginLoading,
    loginPasswordVisible,
    setLoginPasswordVisible,
    checkAuth,
    login,
    logout,
  }
}
