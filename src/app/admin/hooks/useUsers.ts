'use client'

import { useState, useCallback } from 'react'
import type { User } from '../types'
import { parseAdminResponse } from '@/lib/admin-client'

export function useUsers(opts?: { setError?: (e: string | null) => void; handle403?: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [usersTotalCount, setUsersTotalCount] = useState<number | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const setError = opts?.setError ?? (() => {})
  const handle403 = opts?.handle403 ?? (() => {})

  const loadUsers = useCallback(async (page = 1, limit = 50, search?: string) => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error } = parseAdminResponse<{ users?: User[]; total?: number }>(res, json)
      if (res.status === 403) {
        handle403()
        return
      }
      if (!res.ok || error) {
        setError(error || 'Failed to load users')
        return
      }
      setUsers(Array.isArray(data?.users) ? data.users : [])
      setUsersTotalCount(typeof data?.total === 'number' ? data.total : null)
    } catch {
      setError('Failed to load users')
    }
  }, [handle403, setError])

  return {
    users,
    setUsers,
    usersTotalCount,
    setUsersTotalCount,
    selectedUser,
    setSelectedUser,
    loadUsers,
  }
}
