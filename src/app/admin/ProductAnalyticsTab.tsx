'use client'

import { useEffect, useState } from 'react'

interface Overview {
  dau: number
  wau: number
  mau: number
  stickiness: number
  avgSessionDurationSeconds: number
  sessionsPerUser: number
  inactiveUsers7d: number
  churn: { period1_active: number; period2_active: number; churned: number }
}

interface FunnelStep {
  step_index: number
  step_event_name: string
  unique_users: number
  conversion_rate_from_previous_step?: number | null
}

interface FeatureUsageRow {
  feature_name: string
  event_name: string
  unique_users: number
  total_events: number
}

interface AdminTabRow {
  feature_name: string
  event_count: number
  unique_admins: number
}

interface AdminProductivityRow {
  admin_user_id: string
  event_count: number
  session_count: number
  unique_days: number
}

interface AnalyticsData {
  overview: Overview
  dauWauMau: Array<{ date: string; dau: number; wau: number; mau: number }>
  featureUsage: FeatureUsageRow[]
  adminProductivity: AdminProductivityRow[]
  adminTabUsage: AdminTabRow[]
  funnelApp: FunnelStep[]
  funnelAdmin: FunnelStep[]
  dailyAggregates: Array<{ date: string; user_type: string; metric_name: string; metric_value: number }>
  insights?: Insight[]
  topInsights?: Insight[]
  _meta: { days: number; cachedAt: string }
}

interface Insight {
  type: 'funnel' | 'feature' | 'retention' | 'churn' | 'admin'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  metric_value: number
  comparison_value: number | null
  recommendation: string
  priority_score?: number
}

export default function AdminProductAnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/analytics/overview?days=30', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'No permission' : 'Failed to load')
        return res.json()
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  const o = data.overview
  const formatDuration = (s: number) => (s < 60 ? `${s}s` : `${Math.round(s / 60)}m ${s % 60}s`)
  const hasOverviewData = o.dau > 0 || o.wau > 0 || o.mau > 0
  const formatMetric = (value: number) => {
    if (value === 0 && !hasOverviewData) return '—'
    return value.toLocaleString()
  }
  const formatStickiness = (v: number) => (v === 0 && !hasOverviewData ? '—' : `${(v * 100).toFixed(2)}%`)
  const formatDurationOrDash = (s: number) => (s === 0 && !hasOverviewData ? '—' : formatDuration(s))

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-[var(--text)]">Product Analytics</h2>
        {data._meta?.cachedAt && (
          <span className="text-xs text-[var(--text-muted)]">
            Cached {new Date(data._meta.cachedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Automated Insights — severity order (high first), 60s cache */}
      {(data.insights?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Automated Insights</h3>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
            {([...(data.insights ?? [])]
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 }
                return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
              })
              .map((insight, i) => (
                <div key={i} className="p-4 flex gap-3">
                  <span className="flex-shrink-0 text-lg" aria-hidden>
                    {insight.type === 'funnel' && '📊'}
                    {insight.type === 'feature' && '🔧'}
                    {insight.type === 'retention' && '📈'}
                    {insight.type === 'churn' && '⚠️'}
                    {insight.type === 'admin' && '👤'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--text)]">{insight.title}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          insight.severity === 'high'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : insight.severity === 'medium'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                        }`}
                      >
                        {insight.severity}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1">{insight.description}</p>
                    <p className="text-xs text-[var(--accent-purple)] mt-2">
                      <strong>Suggested action:</strong> {insight.recommendation}
                    </p>
                  </div>
                </div>
              )))}
          </div>
          {data.topInsights && data.topInsights.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Top 3 by impact: {data.topInsights.map((t) => t.title).join(' • ')}
            </p>
          )}
        </section>
      )}

      {/* Overview cards */}
      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Overview</h3>
        {!hasOverviewData && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            No activity in the last 30 days. Data will appear as users and admins are tracked.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.dau)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">DAU</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.wau)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">WAU</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.mau)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">MAU</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatStickiness(o.stickiness)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Stickiness (DAU/MAU)</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatDurationOrDash(o.avgSessionDurationSeconds)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Avg session duration</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.sessionsPerUser)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Sessions per user (7d)</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.inactiveUsers7d)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Inactive 7+ days</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] hover:border-[var(--accent-purple)]/20 transition-colors">
            <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{formatMetric(o.churn.churned)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Churn (prev 7d → this 7d)</div>
          </div>
        </div>
      </section>

      {/* Feature usage */}
      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Feature usage (app)</h3>
        {data.featureUsage.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-6 text-center">
            <p className="text-[var(--text-muted)] text-sm mb-2">No app events yet</p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Use <code className="px-1.5 py-0.5 rounded bg-[var(--bg-muted)] font-mono text-[var(--accent-purple)]">trackAppEvent()</code> in the app to record feature usage. Data will appear here once events are sent.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-3">Feature</th>
                  <th className="text-left p-3">Event</th>
                  <th className="text-right p-3">Unique users</th>
                  <th className="text-right p-3">Total events</th>
                </tr>
              </thead>
              <tbody>
                {data.featureUsage.slice(0, 15).map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]/50">
                    <td className="p-3">{row.feature_name}</td>
                    <td className="p-3 font-mono text-xs">{row.event_name}</td>
                    <td className="p-3 text-right tabular-nums">{row.unique_users}</td>
                    <td className="p-3 text-right tabular-nums">{row.total_events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Funnels */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Funnel: App Activation</h3>
          {data.funnelApp.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No funnel data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.funnelApp.map((step) => {
                const maxUsers = Math.max(...data.funnelApp.map((s) => s.unique_users), 1)
                const pct = maxUsers > 0 ? (step.unique_users / maxUsers) * 100 : 0
                return (
                  <div key={step.step_index} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] flex items-center justify-center text-xs font-semibold">
                      {step.step_index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm">{step.step_event_name}</span>
                        <span className="text-[var(--accent-purple)] text-sm tabular-nums">{step.unique_users} users</span>
                        {step.conversion_rate_from_previous_step != null && (
                          <span className="text-xs text-[var(--text-muted)]">
                            ({(Number(step.conversion_rate_from_previous_step) * 100).toFixed(1)}% from prev)
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-purple)]/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Funnel: Admin Review</h3>
          {data.funnelAdmin.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No funnel data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.funnelAdmin.map((step) => {
                const maxUsers = Math.max(...data.funnelAdmin.map((s) => s.unique_users), 1)
                const pct = maxUsers > 0 ? (step.unique_users / maxUsers) * 100 : 0
                return (
                  <div key={step.step_index} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] flex items-center justify-center text-xs font-semibold">
                      {step.step_index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm">{step.step_event_name}</span>
                        <span className="text-[var(--accent-purple)] text-sm tabular-nums">{step.unique_users} users</span>
                        {step.conversion_rate_from_previous_step != null && (
                          <span className="text-xs text-[var(--text-muted)]">
                            ({(Number(step.conversion_rate_from_previous_step) * 100).toFixed(1)}% from prev)
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-purple)]/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Admin behavior */}
      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Admin tab usage</h3>
        {data.adminTabUsage.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No admin events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-3">Tab / feature</th>
                  <th className="text-right p-3">Events</th>
                  <th className="text-right p-3">Unique admins</th>
                </tr>
              </thead>
              <tbody>
                {data.adminTabUsage.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]/50">
                    <td className="p-3">{row.feature_name}</td>
                    <td className="p-3 text-right tabular-nums">{row.event_count}</td>
                    <td className="p-3 text-right tabular-nums">{row.unique_admins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Admin productivity (events per admin)</h3>
        {data.adminProductivity.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No admin events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-3">Admin user ID</th>
                  <th className="text-right p-3">Events</th>
                  <th className="text-right p-3">Sessions</th>
                  <th className="text-right p-3">Active days</th>
                </tr>
              </thead>
              <tbody>
                {data.adminProductivity.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]/50">
                    <td className="p-3">
                      <span
                        className="font-mono text-xs cursor-help"
                        title={row.admin_user_id}
                      >
                        {row.admin_user_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.event_count}</td>
                    <td className="p-3 text-right tabular-nums">{row.session_count}</td>
                    <td className="p-3 text-right tabular-nums">{row.unique_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
        Data from analytics_events. Cached 60s. Run analytics_aggregate_daily() daily for pre-aggregates.
      </p>
    </div>
  )
}
