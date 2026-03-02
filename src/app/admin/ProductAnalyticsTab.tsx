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

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-xl font-semibold text-[var(--text)]">Product Analytics</h2>

      {/* Automated Insights — severity order (high first), 60s cache */}
      {(data.insights?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Automated Insights</h3>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.dau}</div>
            <div className="text-xs text-[var(--text-muted)]">DAU</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.wau}</div>
            <div className="text-xs text-[var(--text-muted)]">WAU</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.mau}</div>
            <div className="text-xs text-[var(--text-muted)]">MAU</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{(o.stickiness * 100).toFixed(2)}%</div>
            <div className="text-xs text-[var(--text-muted)]">Stickiness (DAU/MAU)</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{formatDuration(o.avgSessionDurationSeconds)}</div>
            <div className="text-xs text-[var(--text-muted)]">Avg session duration</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.sessionsPerUser}</div>
            <div className="text-xs text-[var(--text-muted)]">Sessions per user (7d)</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.inactiveUsers7d}</div>
            <div className="text-xs text-[var(--text-muted)]">Inactive 7+ days</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg)]">
            <div className="text-2xl font-bold text-[var(--text)]">{o.churn.churned}</div>
            <div className="text-xs text-[var(--text-muted)]">Churn (prev 7d → this 7d)</div>
          </div>
        </div>
      </section>

      {/* Feature usage */}
      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Feature usage (app)</h3>
        {data.featureUsage.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No events yet. Track with trackAppEvent().</p>
        ) : (
          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-2">Feature</th>
                  <th className="text-left p-2">Event</th>
                  <th className="text-right p-2">Unique users</th>
                  <th className="text-right p-2">Total events</th>
                </tr>
              </thead>
              <tbody>
                {data.featureUsage.slice(0, 15).map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="p-2">{row.feature_name}</td>
                    <td className="p-2">{row.event_name}</td>
                    <td className="p-2 text-right">{row.unique_users}</td>
                    <td className="p-2 text-right">{row.total_events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Funnels */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Funnel: App Activation</h3>
          {data.funnelApp.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No funnel data yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.funnelApp.map((step) => (
                <li key={step.step_index} className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-muted)]">{step.step_index}.</span>
                  <span className="font-mono">{step.step_event_name}</span>
                  <span className="text-[var(--accent-purple)]">{step.unique_users} users</span>
                  {step.conversion_rate_from_previous_step != null && (
                    <span className="text-[var(--text-muted)]">({(Number(step.conversion_rate_from_previous_step) * 100).toFixed(1)}% from prev)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Funnel: Admin Review</h3>
          {data.funnelAdmin.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No funnel data yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.funnelAdmin.map((step) => (
                <li key={step.step_index} className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-muted)]">{step.step_index}.</span>
                  <span className="font-mono">{step.step_event_name}</span>
                  <span className="text-[var(--accent-purple)]">{step.unique_users} users</span>
                  {step.conversion_rate_from_previous_step != null && (
                    <span className="text-[var(--text-muted)]">({(Number(step.conversion_rate_from_previous_step) * 100).toFixed(1)}% from prev)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Admin behavior */}
      <section>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Admin tab usage</h3>
        {data.adminTabUsage.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No admin events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-2">Tab / feature</th>
                  <th className="text-right p-2">Events</th>
                  <th className="text-right p-2">Unique admins</th>
                </tr>
              </thead>
              <tbody>
                {data.adminTabUsage.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="p-2">{row.feature_name}</td>
                    <td className="p-2 text-right">{row.event_count}</td>
                    <td className="p-2 text-right">{row.unique_admins}</td>
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
          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="text-left p-2">Admin user ID</th>
                  <th className="text-right p-2">Events</th>
                  <th className="text-right p-2">Sessions</th>
                  <th className="text-right p-2">Active days</th>
                </tr>
              </thead>
              <tbody>
                {data.adminProductivity.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="p-2 font-mono text-xs">{row.admin_user_id.slice(0, 8)}…</td>
                    <td className="p-2 text-right">{row.event_count}</td>
                    <td className="p-2 text-right">{row.session_count}</td>
                    <td className="p-2 text-right">{row.unique_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--text-muted)]">
        Data from analytics_events. Cached 60s. Run analytics_aggregate_daily() daily for pre-aggregates.
      </p>
    </div>
  )
}
