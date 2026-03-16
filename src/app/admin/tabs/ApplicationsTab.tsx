'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { Application, AppFilter } from '../types'
import { Avatar } from '../components/Avatar'

function useModalFocusTrap(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const savedFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    savedFocusRef.current = document.activeElement as HTMLElement
    const el = dialogRef.current
    if (!el) return
    const focusables = Array.from(
      el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((e) => !e.hasAttribute('disabled'))
    const first = focusables[0]
    if (first) first.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        savedFocusRef.current?.focus()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const current = document.activeElement
      const idx = focusables.indexOf(current as HTMLElement)
      if (idx === -1) return
      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault()
          focusables[focusables.length - 1].focus()
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault()
          focusables[0].focus()
        }
      }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [onClose])
  return useCallback(() => {
    savedFocusRef.current?.focus()
    onClose()
  }, [onClose])
}

export interface ApplicationsTabProps {
  applications: Application[]
  filter: AppFilter
  setFilter: (f: AppFilter) => void
  getFilterCount: (f: AppFilter) => number
  onStatusFilterChange?: (f: AppFilter) => void
  appSearch: string
  setAppSearch: (s: string) => void
  applicationsTotal: number
  applicationsPage: number
  applicationsPageSize: number
  onApplicationsPageChange: (page: number) => void
  applicationsLoading?: boolean
  applicationsCountsError?: boolean
  onApprove: (id: string, updated_at?: string) => void
  onReject: (id: string, updated_at?: string) => void
  onWaitlist: (id: string, updated_at?: string) => void
  onSuspend: (id: string, updated_at?: string) => void
  onExportCsv: () => void
  actionLoading: string | null
  selectedApp: Application | null
  setSelectedApp: (a: Application | null) => void
  currentUserId?: string | null
  onClaim?: (id: string) => Promise<void>
  onRelease?: (id: string) => Promise<void>
  allApplications?: Application[]
  stats?: unknown
  appSort?: string
  appAssignmentFilter?: string
  onSortFilterChange?: (sort: string, filter: string) => void
  selectedAppIds?: Set<string>
  setSelectedAppIds?: React.Dispatch<React.SetStateAction<Set<string>>>
  onBulkAction?: (ids: string[], action: 'approve' | 'reject' | 'waitlist' | 'suspend') => void
  applicationsMigration?: { error: string; detail?: string; sql?: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  REJECTED: { label: 'Rejected', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  WAITLISTED: { label: 'Waitlisted', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  WAITLIST: { label: 'Waitlisted', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  SUSPENDED: { label: 'Suspended', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
}

function getStatusDisplay(status: string) {
  const u = (status || '').toUpperCase()
  return STATUS_CONFIG[u] ?? { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
}

function isPendingStatus(s: string) {
  return ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes((s || '').toUpperCase())
}

const FILTERS: { key: AppFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'waitlisted', label: 'Waitlisted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
]

export function ApplicationsTab({
  applications,
  filter,
  setFilter,
  getFilterCount,
  onStatusFilterChange,
  appSearch,
  setAppSearch,
  applicationsTotal,
  applicationsPage,
  applicationsPageSize,
  onApplicationsPageChange,
  applicationsLoading = false,
  applicationsMigration,
  onApprove,
  onReject,
  onWaitlist,
  onSuspend,
  onExportCsv,
  actionLoading,
  selectedApp,
  setSelectedApp,
  onClaim,
  onRelease,
  currentUserId,
}: ApplicationsTabProps) {
  const safePageSize = Math.max(1, applicationsPageSize || 50)
  const totalPages = Math.max(1, Math.ceil((applicationsTotal ?? 0) / safePageSize))
  const handleFilterClick = (f: AppFilter) => (onStatusFilterChange ?? setFilter)(f)

  return (
    <div className="space-y-6">
      {/* Migration warning — only if API reported one */}
      {applicationsMigration && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h3 className="font-semibold text-amber-200">Database migration required</h3>
          <p className="text-sm text-amber-200/80 mt-1">{applicationsMigration.error}</p>
          {applicationsMigration.sql && (
            <div className="mt-3">
              <p className="text-xs text-amber-200/70 mb-2">Run in Supabase SQL Editor:</p>
              <pre className="p-3 rounded-lg bg-black/20 text-xs overflow-x-auto max-h-40 overflow-y-auto font-mono text-amber-100/90 whitespace-pre-wrap break-all">
                {applicationsMigration.sql}
              </pre>
              <button
                type="button"
                onClick={() => applicationsMigration?.sql && navigator.clipboard.writeText(applicationsMigration.sql)}
                className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/30 text-amber-100 hover:bg-amber-500/40"
              >
                Copy SQL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-white">Applications</h2>
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search by email, name, or username..."
          value={appSearch}
          onChange={(e) => setAppSearch(e.target.value)}
          className="w-full max-w-md pl-10 pr-10 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
        />
        {appSearch.trim() && (
          <button
            type="button"
            onClick={() => setAppSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const count = getFilterCount(key)
          const isActive = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterClick(key)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {label}
              <span className={`ml-1.5 ${isActive ? 'text-violet-200' : 'text-zinc-500'}`}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* Loading skeleton */}
      {applicationsLoading && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
                <div className="h-3 w-64 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!applicationsLoading && applications.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">
            {appSearch.trim() ? 'No matches' : 'No applications here'}
          </h3>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            {appSearch.trim()
              ? 'Try a different search or clear the search box.'
              : applicationsTotal > 0
                ? 'Try another status tab or refresh the page.'
                : 'Applications will appear here once creators apply.'}
          </p>
        </div>
      )}

      {/* List */}
      {!applicationsLoading && applications.length > 0 && (
        <>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Applicant</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Niche</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Date</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {applications.map((app) => {
                    const statusDisplay = getStatusDisplay(app.status)
                    const pending = isPendingStatus(app.status)
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        className="group cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              url={app.profile_image_url}
                              name={app.name || app.username || app.email || ''}
                              size={40}
                            />
                            <div>
                              <p className="font-medium text-white">
                                {app.name || app.username || app.email || `User ${String(app.user_id).slice(0, 8)}`}
                              </p>
                              {app.username && (
                                <p className="text-xs text-zinc-500">@{app.username}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-zinc-400">
                          {app.email || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-violet-300">{app.niche || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${statusDisplay.className}`}>
                            {statusDisplay.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-zinc-500">
                          {app.application_date
                            ? new Date(app.application_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {pending && (
                            <div className="flex items-center justify-end gap-1.5">
                              {onClaim &&
                                (app.assigned_to == null ||
                                  (app.assignment_expires_at && new Date(app.assignment_expires_at) < new Date())) && (
                                  <button
                                    type="button"
                                    onClick={() => onClaim(app.id)}
                                    disabled={actionLoading === app.id}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
                                  >
                                    Claim
                                  </button>
                                )}
                              {onRelease &&
                                app.assigned_to === currentUserId &&
                                app.assignment_expires_at &&
                                new Date(app.assignment_expires_at) >= new Date() && (
                                  <button
                                    type="button"
                                    onClick={() => onRelease(app.id)}
                                    disabled={actionLoading === app.id}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-zinc-300 border border-white/10 hover:bg-white/15 disabled:opacity-50"
                                  >
                                    Release
                                  </button>
                                )}
                              <button
                                type="button"
                                onClick={() => onApprove(app.id, app.updated_at)}
                                disabled={actionLoading === app.id}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => onWaitlist(app.id, app.updated_at)}
                                disabled={actionLoading === app.id}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-zinc-300 border border-white/10 hover:bg-white/15 disabled:opacity-50"
                              >
                                Waitlist
                              </button>
                              <button
                                type="button"
                                onClick={() => onReject(app.id, app.updated_at)}
                                disabled={actionLoading === app.id}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {applications.map((app) => {
                const statusDisplay = getStatusDisplay(app.status)
                const pending = isPendingStatus(app.status)
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className="p-4 active:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        url={app.profile_image_url}
                        name={app.name || app.username || app.email || ''}
                        size={48}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {app.name || app.username || app.email || `User ${String(app.user_id).slice(0, 8)}`}
                        </p>
                        {(app.username || app.email) && (
                          <p className="text-sm text-zinc-500 truncate">
                            {[app.username && `@${app.username}`, app.email].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusDisplay.className}`}>
                            {statusDisplay.label}
                          </span>
                          {app.niche && <span className="text-xs text-violet-300">{app.niche}</span>}
                          {app.application_date && (
                            <span className="text-xs text-zinc-500">
                              {new Date(app.application_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {pending && (
                          <div className="flex flex-wrap gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                            {onClaim &&
                              (app.assigned_to == null ||
                                (app.assignment_expires_at && new Date(app.assignment_expires_at) < new Date())) && (
                                <button
                                  type="button"
                                  onClick={() => onClaim(app.id)}
                                  disabled={actionLoading === app.id}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400"
                                >
                                  Claim
                                </button>
                              )}
                            {onRelease &&
                              app.assigned_to === currentUserId &&
                              app.assignment_expires_at &&
                              new Date(app.assignment_expires_at) >= new Date() && (
                                <button
                                  type="button"
                                  onClick={() => onRelease(app.id)}
                                  disabled={actionLoading === app.id}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-zinc-300"
                                >
                                  Release
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => onApprove(app.id, app.updated_at)}
                              disabled={actionLoading === app.id}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onWaitlist(app.id, app.updated_at)}
                              disabled={actionLoading === app.id}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-zinc-300"
                            >
                              Waitlist
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(app.id, app.updated_at)}
                              disabled={actionLoading === app.id}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-400"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-zinc-500">
                Showing page {applicationsPage} of {totalPages}
                {' · '}
                {(applicationsPage - 1) * safePageSize + 1}–{Math.min(applicationsPage * safePageSize, applicationsTotal)} of {applicationsTotal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplicationsPageChange(applicationsPage - 1)}
                  disabled={applicationsPage <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => onApplicationsPageChange(applicationsPage + 1)}
                  disabled={applicationsPage >= totalPages}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={() => onApprove(selectedApp.id, selectedApp.updated_at)}
          onReject={() => onReject(selectedApp.id, selectedApp.updated_at)}
          onWaitlist={() => onWaitlist(selectedApp.id, selectedApp.updated_at)}
          onSuspend={() => onSuspend(selectedApp.id, selectedApp.updated_at)}
          isLoading={actionLoading === selectedApp.id}
          canAct
        />
      )}
    </div>
  )
}

function ApplicationDetailModal({
  app,
  onClose,
  onApprove,
  onReject,
  onWaitlist,
  onSuspend,
  isLoading,
  canAct = true,
}: {
  app: Application
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onSuspend: () => void
  isLoading: boolean
  canAct?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = useModalFocusTrap(dialogRef, onClose)
  const statusDisplay = getStatusDisplay(app.status)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-zinc-900 rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-white/10 overflow-hidden"
        style={{ maxHeight: 'min(90vh, 700px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <Avatar
              url={app.profile_image_url}
              name={app.name || app.username || app.email || ''}
              size={56}
            />
            <div>
              <h2 id="app-detail-title" className="text-lg font-semibold text-white">
                {app.name || app.username || app.email || 'Unknown'}
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {[app.username && `@${app.username}`, app.email].filter(Boolean).join(' · ') || '—'}
              </p>
              <span className={`inline-flex mt-2 px-2.5 py-1 text-xs font-medium rounded-full border ${statusDisplay.className}`}>
                {statusDisplay.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Email</p>
              <p className="text-white mt-0.5 truncate">{app.email || '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Phone</p>
              <p className="text-white mt-0.5">{app.phone || '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Instagram</p>
              <p className="text-white mt-0.5">{app.instagram_username ? `@${app.instagram_username}` : '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Followers</p>
              <p className="text-white mt-0.5">{app.follower_count != null ? app.follower_count.toLocaleString() : '—'}</p>
            </div>
            {app.niche && (
              <div>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Niche</p>
                <p className="text-violet-300 mt-0.5">{app.niche}</p>
              </div>
            )}
            {app.referrer_username && (
              <div>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Referred by</p>
                <p className="text-white mt-0.5">@{app.referrer_username}</p>
              </div>
            )}
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Applied</p>
              <p className="text-white mt-0.5">
                {app.application_date ? new Date(app.application_date).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          {app.bio && (
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Bio</h3>
              <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5">{app.bio}</p>
            </div>
          )}
          {app.why_join && (
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Why join?</h3>
              <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5">{app.why_join}</p>
            </div>
          )}
          {app.what_to_offer && (
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">What to offer</h3>
              <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5">{app.what_to_offer}</p>
            </div>
          )}
          {app.collaboration_goals && (
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Collaboration goals</h3>
              <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5">{app.collaboration_goals}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 bg-white/5 flex gap-3">
          <button
            type="button"
            onClick={onApprove}
            disabled={!canAct || isLoading || ['APPROVED', 'ACTIVE'].includes((app.status || '').toUpperCase())}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onWaitlist}
            disabled={!canAct || isLoading || ['WAITLISTED', 'WAITLIST'].includes((app.status || '').toUpperCase())}
            className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Waitlist
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canAct || isLoading || (app.status || '').toUpperCase() === 'REJECTED'}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
