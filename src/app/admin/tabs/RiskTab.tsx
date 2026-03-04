'use client'

import { useState } from 'react'
import type { Tab } from '../types'

export interface RiskTabData {
  pending_applications: number
  pending_reports: number
  overdue_data_requests: number
  open_escalations: Array<Record<string, unknown>>
  last_escalation_time: string | null
}

export interface RiskTabProps {
  data: RiskTabData | null
  loading: boolean
  onRefresh: () => void
  onResolve: (escalationId: string, notes?: string) => Promise<void>
  canResolve: boolean
  onNavigateToTab: (tab: Tab) => void
}

export function RiskTab({ data, loading, onRefresh, onResolve, canResolve, onNavigateToTab }: RiskTabProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const pendingApps = data?.pending_applications ?? 0
  const pendingReports = data?.pending_reports ?? 0
  const overdueData = data?.overdue_data_requests ?? 0
  const openEscalations = data?.open_escalations ?? []
  const hasRed = openEscalations.some((e: Record<string, unknown>) => e.threshold_level === 'red')
  const metricLabel = (name: string) => {
    if (name === 'pending_applications') return 'Pending applications'
    if (name === 'pending_reports') return 'Pending reports'
    if (name === 'overdue_data_requests') return 'Overdue data requests'
    return name
  }
  const queueTab = (name: string): Tab | null => {
    if (name === 'pending_applications') return 'applications'
    if (name === 'pending_reports') return 'reports'
    if (name === 'overdue_data_requests') return 'data-requests'
    return null
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Operational risk</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {data?.last_escalation_time && (
        <p className="text-xs text-[var(--text-muted)]">
          Last escalation: {new Date(data.last_escalation_time).toLocaleString()}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateToTab('applications')}
          className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors"
        >
          <p className="text-2xl font-bold text-[var(--text)]">{pendingApps}</p>
          <p className="text-sm text-[var(--text-secondary)]">Pending applications</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('reports')}
          className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors"
        >
          <p className="text-2xl font-bold text-[var(--text)]">{pendingReports}</p>
          <p className="text-sm text-[var(--text-secondary)]">Pending reports</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('data-requests')}
          className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors"
        >
          <p className="text-2xl font-bold text-[var(--text)]">{overdueData}</p>
          <p className="text-sm text-[var(--text-secondary)]">Overdue data requests</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
      </div>
      <div>
        <h3 className="text-base font-medium text-[var(--text)] mb-3">
          Open escalations
          {hasRed && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
              Red
            </span>
          )}
        </h3>
        {loading && openEscalations.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
                <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
                <div className="h-4 w-1/3 bg-[var(--surface-hover)] rounded" />
              </div>
            ))}
          </div>
        ) : openEscalations.length === 0 ? (
          <div className="py-8 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-center text-[var(--text-muted)] text-sm">
            No open escalations
          </div>
        ) : (
          <div className="space-y-3">
            {openEscalations.map((e: Record<string, unknown>) => {
              const id = String(e.id)
              const tab = queueTab(e.metric_name as string)
              const isRed = e.threshold_level === 'red'
              return (
                <div
                  key={id}
                  className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">{metricLabel(e.metric_name as string)}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Value: {String(e.metric_value)} · {new Date(String(e.created_at)).toLocaleString()}
                    </p>
                    <span
                      className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${isRed ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}
                    >
                      {isRed ? 'Red' : 'Yellow'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab(tab)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm"
                      >
                        View queue
                      </button>
                    )}
                    {canResolve && (
                      <button
                        type="button"
                        disabled={resolvingId === id}
                        onClick={async () => {
                          setResolvingId(id)
                          await onResolve(id)
                          setResolvingId(null)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
