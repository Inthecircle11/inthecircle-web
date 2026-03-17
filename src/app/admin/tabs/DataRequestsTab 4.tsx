'use client'

import { useState } from 'react'

export interface DataRequestsTabProps {
  requests: Array<Record<string, unknown>>
  loading: boolean
  onRefresh: () => void
  onStatusChange: (requestId: string, status: string, updated_at?: string) => Promise<void>
}

export function DataRequestsTab({
  requests,
  loading,
  onRefresh,
  onStatusChange,
}: DataRequestsTabProps) {
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const getStatus = (r: Record<string, unknown>) => draftStatus[String(r.id)] ?? String(r.status)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{requests.length} requests</p>
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
              <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/3 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">📥</div>
          <p className="text-[var(--text-secondary)] font-medium">No data requests yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Export or deletion requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: Record<string, unknown>) => {
            const id = r.id != null ? String(r.id) : null
            const current = id ? getStatus(r) : String(r.status)
            const unchanged = id ? current === String(r.status) : true
            return (
              <div
                key={id ?? `req-${r.user_id}-${r.created_at}`}
                className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {String(r.name ?? r.username ?? r.user_id)} · {String(r.request_type)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(String(r.created_at)).toLocaleString()}</p>
                  <span
                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--surface-hover)]'}`}
                  >
                    {String(r.status)}
                  </span>
                  {id == null && (
                    <p className="text-xs text-amber-400 mt-1">No id — add primary key to data_requests to update status.</p>
                  )}
                </div>
                {id != null && (
                  <div className="flex items-center gap-2">
                    <select
                      id={`data-request-status-${id}`}
                      name="data_request_status"
                      value={current}
                      onChange={(e) => setDraftStatus((prev) => ({ ...prev, [id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm"
                      aria-label="Status"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <button
                      type="button"
                      disabled={unchanged || updatingId === id}
                      onClick={async () => {
                        setUpdatingId(id)
                        const updatedAt = (r as { updated_at?: string }).updated_at
                        await onStatusChange(id, current, updatedAt)
                        setDraftStatus((prev) => {
                          const next = { ...prev }
                          delete next[id]
                          return next
                        })
                        setUpdatingId(null)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingId === id ? 'Updating…' : 'Update'}
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
