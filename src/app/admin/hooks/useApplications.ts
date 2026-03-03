'use client'

import { useState, useCallback } from 'react'
import type { Application, Stats, AppFilter } from '../types'
import { parseAdminResponse } from '@/lib/admin-client'

const DEFAULT_PAGE_SIZE = 50

export function useApplications(opts?: { setError?: (e: string | null) => void; handle403?: () => void }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [applicationsTotal, setApplicationsTotal] = useState(0)
  const [applicationsPage, setApplicationsPage] = useState(1)
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 })
  const [appFilter, setAppFilter] = useState<AppFilter>('all')
  const [appSort, setAppSort] = useState<string>('overdue')
  const [appAssignmentFilter, setAppAssignmentFilter] = useState<string>('all')
  const [appSearch, setAppSearch] = useState('')
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [applicationsLoading, setApplicationsLoading] = useState(false)

  const setError = opts?.setError ?? (() => {})
  const handle403 = opts?.handle403 ?? (() => {})

  const fetchApplications = useCallback(async (
    sort?: string,
    filter?: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    statusFilter?: AppFilter
  ): Promise<{ apps: Application[]; total: number; counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } | null; countsError?: boolean; permissionDenied?: boolean }> => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (sort) params.set('sort', sort)
      if (filter) params.set('filter', filter)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/admin/applications?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error } = parseAdminResponse<{ applications?: Application[]; total?: number; counts?: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } }>(res, json)
      if (res.status === 403) {
        handle403()
        return { apps: [], total: 0, counts: null, permissionDenied: true }
      }
      if (!res.ok || error) {
        setError(error || 'Failed to load applications')
        return { apps: [], total: 0, counts: null }
      }
      const apps = Array.isArray(data?.applications) ? data.applications : []
      const total = typeof data?.total === 'number' ? data.total : 0
      const counts = data?.counts ?? null
      return { apps, total, counts, countsError: false }
    } catch {
      setError('Failed to load applications')
      return { apps: [], total: 0, counts: null }
    }
  }, [handle403, setError])

  return {
    applications,
    setApplications,
    applicationsTotal,
    setApplicationsTotal,
    applicationsPage,
    setApplicationsPage,
    APPLICATIONS_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    stats,
    setStats,
    appFilter,
    setAppFilter,
    appSort,
    setAppSort,
    appAssignmentFilter,
    setAppAssignmentFilter,
    appSearch,
    setAppSearch,
    selectedApp,
    setSelectedApp,
    selectedAppIds,
    setSelectedAppIds,
    applicationsLoading,
    setApplicationsLoading,
    fetchApplications,
  }
}
