'use client'

import { useState } from 'react'

export interface ApprovalsTabProps {
  requests: Array<Record<string, unknown>>
  loading: boolean
  onRefresh: () => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  canApprove: boolean
}

export function ApprovalsTab({
  requests,
  loading,
  onRefresh,
  onApprove,
  onReject,
  canApprove,
}: ApprovalsTabProps) {
  const [actingId, setActingId] = useState<string | null>(null)
  const now = new Date()
  const formatRemaining = (expiresAt: string) => {
    const exp = new Date(expiresAt)
    if (exp <= now) return 'Expired'
    const min = Math.floor((exp.getTime() - now.getTime()) / 60000)
    if (min < 60) return `${min} min left`
    const h = Math.floor(min / 60)
    return `${h}h ${min % 60}m left`
  }
  const actionLabel = (action: string) => {
    if (action === 'user_delete') return 'Delete user'
    if (action === 'user_anonymize') return 'Anonymize user'
    if (action === 'bulk_reject') return 'Bulk reject applications'
    if (action === 'bulk_suspend') return 'Bulk suspend applications'
    return action
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Pending approvals</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
              <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/2 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-center text-[var(--text-muted)] text-sm">
          No pending approvals
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: Record<string, unknown>) => {
            const id = String(r.id)
            const expiresAt = String(r.expires_at ?? '')
            const isExpired = expiresAt && new Date(expiresAt) <= now
            return (
              <div
                key={id}
                className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">{actionLabel(String(r.action ?? ''))}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Target: {String(r.target_type)} · {String(r.target_id)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Reason: {String(r.reason ?? '—')}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Requested at: {new Date(String(r.requested_at)).toLocaleString()} · {formatRemaining(expiresAt)}
                  </p>
                </div>
                {canApprove && !isExpired && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === id}
                      onClick={async () => {
                        setActingId(id)
                        await onReject(id)
                        setActingId(null)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={actingId === id}
                      onClick={async () => {
                        setActingId(id)
                        await onApprove(id)
                        setActingId(null)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
