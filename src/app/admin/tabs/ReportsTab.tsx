'use client'

import { useState, useRef, useEffect } from 'react'

type ReportFilter = 'all' | 'pending' | 'resolved' | 'dismissed'
type ReportAssignmentFilter = 'all' | 'unassigned' | 'assigned_to_me'
type ReportSort = 'overdue' | 'oldest' | 'assigned_to_me'

export interface ReportsTabProps {
  reports: Array<Record<string, unknown>>
  loading: boolean
  currentUserId?: string | null
  onRefresh: (opts?: { sort?: string; filter?: string; status?: string }) => void
  onClaim?: (reportId: string) => Promise<void>
  onRelease?: (reportId: string) => Promise<void>
  onResolve: (
    reportId: string,
    status: 'resolved' | 'dismissed',
    notes?: string,
    updated_at?: string
  ) => Promise<void>
}

export function ReportsTab({
  reports,
  loading,
  currentUserId = null,
  onRefresh,
  onClaim,
  onRelease,
  onResolve,
}: ReportsTabProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<ReportAssignmentFilter>('all')
  const [sort, setSort] = useState<ReportSort>('overdue')
  const pending = reports.filter((r) => r.status === 'pending')
  let filtered =
    reportFilter === 'all' ? reports : reports.filter((r) => String(r.status) === reportFilter)
  const now = new Date()
  const isClaimedByOther = (r: Record<string, unknown>): boolean => {
    const assignedTo = r.assigned_to as string | null | undefined
    const expiresAt = r.assignment_expires_at as string | null | undefined
    if (!assignedTo) return false
    if (expiresAt && new Date(expiresAt) < now) return false
    return assignedTo !== currentUserId
  }
  const isClaimedByMe = (r: Record<string, unknown>): boolean => {
    const assignedTo = r.assigned_to as string | null | undefined
    const expiresAt = r.assignment_expires_at as string | null | undefined
    return !!(assignedTo === currentUserId && expiresAt && new Date(expiresAt) >= now)
  }
  if (assignmentFilter === 'unassigned')
    filtered = filtered.filter(
      (r) => !r.assigned_to || (r.assignment_expires_at && new Date(r.assignment_expires_at as string) < now)
    )
  else if (assignmentFilter === 'assigned_to_me' && currentUserId)
    filtered = filtered.filter(isClaimedByMe)
  const handleRefresh = () =>
    onRefresh({ sort, filter: assignmentFilter, status: reportFilter === 'all' ? undefined : reportFilter })
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    onRefresh({
      sort,
      filter: assignmentFilter,
      status: reportFilter === 'all' ? undefined : reportFilter,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, assignmentFilter, reportFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {reports.length} reports · {pending.length} pending
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[var(--text-muted)]">Status:</span>
          {(['all', 'pending', 'resolved', 'dismissed'] as ReportFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReportFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${reportFilter === f ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)] text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
            >
              {f}
            </button>
          ))}
          <span className="text-xs text-[var(--text-muted)] ml-2">Assignment:</span>
          {(['all', 'unassigned', 'assigned_to_me'] as ReportAssignmentFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAssignmentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${assignmentFilter === f ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)] text-[var(--text-secondary)]'}`}
            >
              {f === 'assigned_to_me' ? 'Assigned to me' : f}
            </button>
          ))}
          <span className="text-xs text-[var(--text-muted)]">Sort:</span>
          {(['overdue', 'oldest', 'assigned_to_me'] as ReportSort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-sm ${sort === s ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)]'}`}
            >
              {s === 'assigned_to_me' ? 'My items first' : s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {loading && reports.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse"
            >
              <div className="h-5 w-3/4 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/2 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">⚠️</div>
          <p className="text-[var(--text-secondary)] font-medium">
            {reports.length === 0 ? 'No reports yet' : `No ${reportFilter} reports`}
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {reports.length === 0
              ? 'When users report content, they will appear here.'
              : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: Record<string, unknown>) => {
            const claimedByOther = r.status === 'pending' && isClaimedByOther(r)
            const claimedByMe = isClaimedByMe(r)
            const canAct = r.status === 'pending' && !claimedByOther
            return (
              <div
                key={String(r.id)}
                className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)]"
              >
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      Report by @{String(r.reporter_username ?? r.reporter_id ?? '?')} → reported @
                      {String(r.reported_username ?? r.reported_user_id ?? '?')}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {String(r.reason ?? 'No reason')}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {new Date(String(r.created_at)).toLocaleString()}
                    </p>
                    {(claimedByMe ||
                      !!(r.assigned_to && r.assignment_expires_at && new Date(r.assignment_expires_at as string) >= now)) && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        {claimedByMe ? 'Claimed by you' : 'Claimed by another moderator'}
                      </span>
                    )}
                    <span
                      className={`inline-block mt-2 ml-1 text-xs px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--surface-hover)]'}`}
                    >
                      {String(r.status)}
                    </span>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap">
                      {!claimedByMe && !claimedByOther && onClaim && (
                        <button
                          type="button"
                          disabled={claimingId === r.id}
                          onClick={async () => {
                            setClaimingId(String(r.id))
                            await onClaim(String(r.id))
                            setClaimingId(null)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm"
                        >
                          Claim
                        </button>
                      )}
                      {claimedByMe && onRelease && (
                        <button
                          type="button"
                          disabled={claimingId === r.id}
                          onClick={async () => {
                            setClaimingId(String(r.id))
                            await onRelease(String(r.id))
                            setClaimingId(null)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm"
                        >
                          Release
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canAct || resolvingId === r.id}
                        onClick={async () => {
                          setResolvingId(String(r.id))
                          await onResolve(
                            String(r.id),
                            'dismissed',
                            undefined,
                            r.updated_at as string
                          )
                          setResolvingId(null)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        disabled={!canAct || resolvingId === r.id}
                        onClick={async () => {
                          setResolvingId(String(r.id))
                          await onResolve(
                            String(r.id),
                            'resolved',
                            undefined,
                            r.updated_at as string
                          )
                          setResolvingId(null)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
