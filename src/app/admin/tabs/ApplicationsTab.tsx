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
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps
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
}

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
  applicationsCountsError: _applicationsCountsError,
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
  const totalPages = Math.max(1, Math.ceil(applicationsTotal / applicationsPageSize))
  const statusLabel = (s: string) => {
    const u = (s || '').toUpperCase()
    if (u === 'ACTIVE' || u === 'APPROVED') return 'Approved'
    if (u === 'REJECTED') return 'Rejected'
    if (u === 'WAITLISTED' || u === 'WAITLIST') return 'Waitlisted'
    if (u === 'SUSPENDED') return 'Suspended'
    return 'Pending'
  }
  const isPending = (s: string) =>
    ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes((s || '').toUpperCase())
  const filters: { key: AppFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'waitlisted', label: 'Waitlisted' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'suspended', label: 'Suspended' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-[var(--text)]">Applications</h2>
        <button
          type="button"
          onClick={onExportCsv}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Export CSV
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name, email, or username..."
        value={appSearch}
        onChange={(e) => setAppSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)]"
      />

      <div className="flex flex-wrap gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => (onStatusFilterChange ?? setFilter)(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              filter === key
                ? 'bg-[var(--accent-purple)] text-white'
                : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--separator)]'
            }`}
          >
            {label} ({getFilterCount(key)})
          </button>
        ))}
      </div>

      {applicationsLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!applicationsLoading && applications.length === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)]">No applications found</div>
      )}

      {!applicationsLoading && applications.length > 0 && (
        <>
          <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-xl divide-y divide-[var(--separator)]">
            {applications.map((app) => (
              <div
                key={app.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedApp(app)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedApp(app)}
                className="p-4 hover:bg-[var(--surface-hover)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] focus:ring-inset"
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    url={app.profile_image_url}
                    name={app.name || app.username || app.email || ''}
                    size={48}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-[var(--text)]">
                        {app.name ||
                          app.username ||
                          app.email ||
                          (app.user_id ? `User ${String(app.user_id).slice(0, 8)}` : 'Unknown')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          (app.status?.toUpperCase() ?? '') === 'ACTIVE' ||
                          app.status?.toUpperCase() === 'APPROVED'
                            ? 'bg-green-500/20 text-green-400'
                            : app.status?.toUpperCase() === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400'
                              : app.status?.toUpperCase() === 'WAITLISTED' ||
                                  app.status?.toUpperCase() === 'WAITLIST'
                                ? 'bg-purple-500/20 text-purple-400'
                                : app.status?.toUpperCase() === 'SUSPENDED'
                                  ? 'bg-gray-500/20 text-gray-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {statusLabel(app.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {[app.username && `@${app.username}`, app.email, app.niche]
                        .filter(Boolean)
                        .join(' · ') ||
                        (app.user_id ? `ID: ${String(app.user_id).slice(0, 8)}` : '—')}
                    </p>
                    {(app.instagram_username ||
                      app.referrer_username ||
                      (app.follower_count != null && app.follower_count > 0)) && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {[
                          app.instagram_username && `Instagram @${app.instagram_username}`,
                          app.referrer_username && `Referred by @${app.referrer_username}`,
                          app.follower_count != null &&
                            app.follower_count > 0 &&
                            `${Number(app.follower_count).toLocaleString()} followers`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  {isPending(app.status) && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {onClaim &&
                        (app.assigned_to == null ||
                          (app.assignment_expires_at &&
                            new Date(app.assignment_expires_at) < new Date())) && (
                          <button
                            type="button"
                            onClick={() => onClaim(app.id)}
                            disabled={actionLoading === app.id}
                            className="px-3 py-1.5 text-sm font-medium bg-blue-500/15 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-50"
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
                            className="px-3 py-1.5 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-[var(--separator)] disabled:opacity-50"
                          >
                            Release
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => onApprove(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onWaitlist(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-[var(--separator)] disabled:opacity-50"
                      >
                        Waitlist
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-red-400 bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {app.application_date
                      ? new Date(app.application_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onApplicationsPageChange(applicationsPage - 1)}
                disabled={applicationsPage <= 1}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--text-muted)]">
                Page {applicationsPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onApplicationsPageChange(applicationsPage + 1)}
                disabled={applicationsPage >= totalPages}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
              >
                Next
              </button>
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
  onSuspend: _onSuspend,
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
  const status = (app.status || '').toUpperCase()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const statusLabel =
    status === 'ACTIVE' || status === 'APPROVED'
      ? 'Approved'
      : status === 'REJECTED'
        ? 'Rejected'
        : status === 'WAITLISTED' || status === 'WAITLIST'
          ? 'Waitlisted'
          : status === 'SUSPENDED'
            ? 'Suspended'
            : 'Pending'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--background)] rounded-2xl max-w-lg w-full flex flex-col shadow-xl border border-[var(--separator)] overflow-hidden"
        style={{ maxHeight: 'min(90vh, 700px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--separator)]">
          <div className="flex items-center gap-3">
            <Avatar
              url={app.profile_image_url}
              name={app.name || app.username || app.email || ''}
              size={48}
            />
            <div>
              <h2 id="app-detail-title" className="font-semibold text-[var(--text)]">
                {app.name || app.username || app.email || 'Unknown'}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {[app.username && `@${app.username}`, app.email]
                  .filter(Boolean)
                  .join(' · ') ||
                  (app.user_id ? `ID: ${String(app.user_id).slice(0, 8)}` : '—')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                status === 'ACTIVE' || status === 'APPROVED'
                  ? 'bg-green-500/20 text-green-400'
                  : status === 'REJECTED'
                    ? 'bg-red-500/20 text-red-400'
                    : status === 'WAITLISTED' || status === 'WAITLIST'
                      ? 'bg-purple-500/20 text-purple-400'
                      : status === 'SUSPENDED'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Email</span>
              <p className="text-[var(--text)] truncate">{app.email || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Phone</span>
              <p className="text-[var(--text)]">{app.phone || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Instagram</span>
              <p className="text-[var(--text)]">
                {app.instagram_username ? `@${app.instagram_username}` : '-'}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Followers</span>
              <p className="text-[var(--text)]">
                {app.follower_count?.toLocaleString() ?? '-'}
              </p>
            </div>
            {app.niche && (
              <div>
                <span className="text-[var(--text-muted)]">Niche</span>
                <p className="text-[var(--accent-purple)]">{app.niche}</p>
              </div>
            )}
            {app.referrer_username && (
              <div>
                <span className="text-[var(--text-muted)]">Referred by</span>
                <p className="text-[var(--text)]">@{app.referrer_username}</p>
              </div>
            )}
            <div>
              <span className="text-[var(--text-muted)]">Applied</span>
              <p className="text-[var(--text)]">
                {app.application_date
                  ? new Date(app.application_date).toLocaleDateString()
                  : '-'}
              </p>
            </div>
          </div>
          {app.bio && (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Bio</h3>
              <p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">
                {app.bio}
              </p>
            </div>
          )}
          {app.why_join && (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">
                Why join?
              </h3>
              <p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">
                {app.why_join}
              </p>
            </div>
          )}
          {app.what_to_offer && (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">
                What to offer
              </h3>
              <p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">
                {app.what_to_offer}
              </p>
            </div>
          )}
          {app.collaboration_goals && (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">
                Collaboration goals
              </h3>
              <p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">
                {app.collaboration_goals}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--separator)] bg-[var(--surface)] flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={!canAct || isLoading || status === 'APPROVED' || status === 'ACTIVE'}
            className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onWaitlist}
            disabled={
              !canAct || isLoading || status === 'WAITLISTED' || status === 'WAITLIST'
            }
            className="flex-1 py-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm font-medium text-[var(--text)] hover:bg-[var(--separator)] disabled:opacity-40"
          >
            Waitlist
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canAct || isLoading || status === 'REJECTED'}
            className="flex-1 py-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
