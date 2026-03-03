'use client'

import { useState } from 'react'
import { AdminSkeletonTable } from '../components/AdminSkeletonTable'

export interface AuditFilters {
  admin_user_id?: string
  action?: string
  target_type?: string
  target_id?: string
  date_from?: string
  date_to?: string
  limit?: number
}

export type AuditSortKey = 'created_at' | 'admin_email' | 'action' | 'target'

export interface AuditLogEntry {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  admin_email: string | null
  created_at: string
  details?: unknown
  reason?: unknown
}

export interface AuditLogTabProps {
  entries: AuditLogEntry[]
  loading: boolean
  onRefresh: (filters?: AuditFilters) => void
  onExportCsv?: (filters?: AuditFilters) => void
  onVerifyChain?: () => Promise<{
    chain_valid: boolean
    snapshot_valid?: boolean
    first_corrupted_id?: string
    rows_checked?: number
  } | null>
  verifyResult?: {
    chain_valid: boolean
    snapshot_valid?: boolean
    first_corrupted_id?: string
    snapshot_date?: string
    rows_checked?: number
  } | null
  verifyLoading?: boolean
  onCreateSnapshot?: () => Promise<boolean>
  snapshotLoading?: boolean
}

export function AuditLogTab({
  entries,
  loading,
  onRefresh,
  onExportCsv,
  onVerifyChain,
  verifyResult,
  verifyLoading,
  onCreateSnapshot,
  snapshotLoading,
}: AuditLogTabProps) {
  const [sortKey, setSortKey] = useState<AuditSortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterAction, setFilterAction] = useState('')
  const [filterTargetType, setFilterTargetType] = useState('')
  const [filterTargetId, setFilterTargetId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const getFilters = (): AuditFilters => {
    const f: AuditFilters = { limit: 100 }
    if (filterAction.trim()) f.action = filterAction.trim()
    if (filterTargetType.trim()) f.target_type = filterTargetType.trim()
    if (filterTargetId.trim()) f.target_id = filterTargetId.trim()
    if (filterDateFrom.trim()) f.date_from = filterDateFrom.trim()
    if (filterDateTo.trim()) f.date_to = filterDateTo.trim()
    return f
  }
  const toggleSort = (key: AuditSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'created_at' ? 'desc' : 'asc')
    }
  }
  const sorted = [...entries].sort((a, b) => {
    let av: string | number = '',
      bv: string | number = ''
    if (sortKey === 'created_at') {
      av = new Date(a.created_at).getTime()
      bv = new Date(b.created_at).getTime()
    } else if (sortKey === 'admin_email') {
      av = a.admin_email ?? ''
      bv = b.admin_email ?? ''
    } else if (sortKey === 'action') {
      av = a.action
      bv = b.action
    } else {
      av = a.target_type && a.target_id ? `${a.target_type}:${a.target_id}` : ''
      bv = b.target_type && b.target_id ? `${b.target_type}:${b.target_id}` : ''
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">Who did what and when</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onRefresh(getFilters())}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {onExportCsv && (
            <button
              type="button"
              onClick={() => onExportCsv(getFilters())}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              Export CSV
            </button>
          )}
          {onVerifyChain && (
            <button
              type="button"
              onClick={onVerifyChain}
              disabled={verifyLoading}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors"
            >
              {verifyLoading ? 'Verifying…' : 'Verify audit chain'}
            </button>
          )}
          {onCreateSnapshot && (
            <button
              type="button"
              onClick={onCreateSnapshot}
              disabled={snapshotLoading}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors"
            >
              {snapshotLoading ? 'Creating…' : 'Create daily snapshot'}
            </button>
          )}
        </div>
      </div>
      {verifyResult != null && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--separator)]">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${verifyResult.chain_valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            Chain: {verifyResult.chain_valid ? 'Valid' : 'Invalid'}
          </span>
          {verifyResult.snapshot_valid !== undefined && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${verifyResult.snapshot_valid ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}
            >
              Snapshot: {verifyResult.snapshot_valid ? 'Valid' : 'Missing or mismatch'}
            </span>
          )}
          {verifyResult.first_corrupted_id && (
            <span className="text-sm text-[var(--text-muted)]">
              First corrupted: {verifyResult.first_corrupted_id}
            </span>
          )}
          {verifyResult.rows_checked != null && (
            <span className="text-xs text-[var(--text-muted)]">Rows checked: {verifyResult.rows_checked}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input
          type="text"
          placeholder="Action (partial)"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="input-field text-sm"
          aria-label="Filter by action"
        />
        <input
          type="text"
          placeholder="Target type"
          value={filterTargetType}
          onChange={(e) => setFilterTargetType(e.target.value)}
          className="input-field text-sm"
          aria-label="Filter by target type"
        />
        <input
          type="text"
          placeholder="Target ID"
          value={filterTargetId}
          onChange={(e) => setFilterTargetId(e.target.value)}
          className="input-field text-sm"
          aria-label="Filter by target ID"
        />
        <input
          type="date"
          placeholder="From"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="input-field text-sm"
          aria-label="Date from"
        />
        <input
          type="date"
          placeholder="To"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="input-field text-sm"
          aria-label="Date to"
        />
      </div>
      {loading && entries.length === 0 ? (
        <AdminSkeletonTable rows={8} />
      ) : entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">📋</div>
          <p className="text-[var(--text-secondary)] font-medium">No audit entries yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Admin actions will be logged here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--separator)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--separator)]">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('created_at')}
                    className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Time {sortKey === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('admin_email')}
                    className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Admin {sortKey === 'admin_email' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('action')}
                    className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Action {sortKey === 'action' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('target')}
                    className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors"
                  >
                    Target {sortKey === 'target' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3 font-medium text-[var(--text-muted)]">Reason</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr
                  key={e.id}
                  className={`border-b border-[var(--separator)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors ${i % 2 === 1 ? 'bg-[var(--surface)]/30' : ''}`}
                >
                  <td className="p-3 text-[var(--text-muted)]">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">{e.admin_email ?? '—'}</td>
                  <td className="p-3 font-medium">{e.action}</td>
                  <td className="p-3">
                    {e.target_type && e.target_id
                      ? `${e.target_type}: ${e.target_id.slice(0, 8)}…`
                      : '—'}
                  </td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">
                    {e.reason != null ? String(e.reason) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
