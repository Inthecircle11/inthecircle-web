'use client'

import { useState } from 'react'
import type { Stats, RecentActivity, LocationByCountry, Tab } from '../types'
import { StatCard } from '../components/StatCard'
import { formatTimeAgo } from '../utils'

function MetricPill({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] px-4 py-3 rounded-xl">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function FunnelRow({
  label,
  value,
  pct,
  color,
}: {
  label: string
  value: number
  pct: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--text)]">{label}</span>
      <div className="flex items-center gap-3 flex-1 max-w-[200px]">
        <div className="flex-1 h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-sm font-semibold w-12 text-right" style={{ color }}>
          {value} ({pct}%)
        </span>
      </div>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-4 bg-[var(--surface)] border border-[var(--separator)] rounded-xl shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:bg-[var(--surface-hover)] transition-all duration-200 text-center text-[var(--text)]"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm">{label}</div>
    </button>
  )
}

export interface DashboardTabProps {
  stats: Stats
  totalUsers: number
  verifiedUsersCount: number
  newUsersThisWeek: number
  newUsersLast24h: number
  newUsersLast30d: number
  activeUsersToday: number
  pendingVerifications: number
  recentActivity: RecentActivity[]
  bannedUsersCount: number
  totalThreads: number
  totalMessages: number
  approvalRate: number
  rejectionRate: number
  verificationRate: number
  topNiches: [string, number][]
  signupsByDay: { label: string; count: number }[]
  maxSignupsInWeek: number
  appsSubmittedThisWeek: number
  avgMessagesPerThread: string
  engagementFromExactCounts: boolean
  locationsByCountry: LocationByCountry[]
  citiesList: { label: string; count: number }[]
  locationSetPct: number
  usersWithLocationSet: number
  topNichesByUser: [string, number][]
  nicheSetPct: number
  topReferrers: [string, number][]
  setActiveTab?: (tab: Tab) => void
  onRefreshData?: () => Promise<void>
}

export function DashboardTab({
  stats,
  totalUsers,
  verifiedUsersCount,
  newUsersThisWeek,
  newUsersLast24h,
  newUsersLast30d,
  activeUsersToday,
  pendingVerifications,
  recentActivity,
  bannedUsersCount,
  totalThreads,
  totalMessages,
  approvalRate,
  rejectionRate,
  verificationRate,
  topNiches,
  signupsByDay,
  maxSignupsInWeek,
  appsSubmittedThisWeek,
  avgMessagesPerThread,
  engagementFromExactCounts,
  locationsByCountry,
  citiesList,
  locationSetPct,
  usersWithLocationSet,
  topNichesByUser,
  nicheSetPct,
  topReferrers,
  setActiveTab,
  onRefreshData,
}: DashboardTabProps) {
  const [cacheRefreshed, setCacheRefreshed] = useState(false)
  const handleClearCache = async () => {
    if (onRefreshData) {
      await onRefreshData()
      setCacheRefreshed(true)
      setTimeout(() => setCacheRefreshed(false), 2500)
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon="👥"
          color="#A855F7"
          trend={`+${newUsersThisWeek} this week · +${newUsersLast30d} last 30d`}
        />
        <StatCard
          title="Pending Apps"
          value={stats.pending}
          icon="⏳"
          color="#F59E0B"
          trend="Needs review"
        />
        <StatCard
          title="Verified Users"
          value={typeof verifiedUsersCount === 'number' ? verifiedUsersCount : 0}
          icon="✓"
          color="#10B981"
          trend={`${verificationRate}% of total · ${pendingVerifications} pending`}
        />
        <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3 bg-[#3B82F6]/20 text-[#2563EB]">
            📈
          </div>
          <p className="text-3xl font-bold min-h-[1.25em] tabular-nums text-[#3B82F6]">
            {typeof activeUsersToday === 'number' ? activeUsersToday : 0}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Active Today</p>
          <p className="text-xs mt-2 text-[var(--text-muted)]">Last 24h</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricPill label="New (24h)" value={newUsersLast24h} color="#8B5CF6" />
        <MetricPill label="Banned" value={bannedUsersCount} color="#EF4444" />
        <MetricPill label="Approval rate" value={`${approvalRate}%`} color="#10B981" />
        <MetricPill label="Conversations" value={totalThreads} color="#3B82F6" />
        <MetricPill label="Messages" value={totalMessages} color="#0EA5E9" />
        <MetricPill label="Apps this week" value={appsSubmittedThisWeek} color="#F59E0B" />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          <span className="w-8 h-8 rounded-lg bg-[#A855F7]/20 flex items-center justify-center text-[#A855F7]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
          </span>
          User signups · Last 7 days
        </h3>
        <div className="flex items-end gap-2 h-24">
          {signupsByDay.map((day) => (
            <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md min-h-[4px] transition-all duration-300"
                style={{
                  height: `${(day.count / maxSignupsInWeek) * 80}px`,
                  backgroundColor: 'var(--accent-purple)',
                  opacity: 0.6 + (day.count / maxSignupsInWeek) * 0.4,
                }}
              />
              <span className="text-xs font-medium text-[var(--text)]">{day.count}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </span>
            Application funnel
          </h3>
          <div className="space-y-3">
            <FunnelRow label="Approved" value={stats.approved} pct={approvalRate} color="#10B981" />
            <FunnelRow label="Rejected" value={stats.rejected} pct={rejectionRate} color="#EF4444" />
            <FunnelRow
              label="Waitlisted"
              value={stats.waitlisted}
              pct={stats.total ? Math.round((stats.waitlisted / stats.total) * 100) : 0}
              color="#A855F7"
            />
            <FunnelRow
              label="Suspended"
              value={stats.suspended}
              pct={stats.total ? Math.round((stats.suspended / stats.total) * 100) : 0}
              color="#F97316"
            />
            <FunnelRow
              label="Pending"
              value={stats.pending}
              pct={stats.total ? Math.round((stats.pending / stats.total) * 100) : 0}
              color="#F59E0B"
            />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.51 0 .955.198 1.377.481L12 3l.623.481A3 3 0 0114.99 3H17v14a2 2 0 01-2 2H9a2 2 0 01-2-2V3z"
                />
              </svg>
            </span>
            Top niches (applications)
          </h3>
          {topNiches.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No applications yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topNiches.map(([niche, count]) => (
                <span
                  key={niche}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm text-[var(--text)]"
                >
                  {niche} <span className="font-semibold text-[var(--accent-purple)]">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-[var(--text-secondary)]">
          {usersWithLocationSet} of {totalUsers} users ({locationSetPct}%) have location set
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center text-[#10B981]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 0010.5-4.065M12 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            Countries
          </h3>
          {locationsByCountry.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No country data yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {locationsByCountry.map((row) => (
                <div
                  key={row.country}
                  className="flex items-center justify-between py-2 border-b border-[var(--separator)] last:border-0"
                >
                  <span className="text-base" aria-hidden>
                    {row.flag}
                  </span>
                  <span className="text-sm text-[var(--text)] flex-1 ml-2 truncate">
                    {row.country}
                  </span>
                  <span className="text-sm font-semibold text-[var(--accent-purple)]">
                    {row.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center text-[#0EA5E9]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </span>
            Cities
          </h3>
          {citiesList.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No city data yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {citiesList.map(({ label, count }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 border-b border-[var(--separator)] last:border-0"
                >
                  <span className="text-sm text-[var(--text)] truncate flex-1">{label}</span>
                  <span className="text-sm font-semibold text-[var(--accent-purple)] ml-2">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6">
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </span>
            User demographics (niche)
          </h3>
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <span className="text-sm text-[var(--text-secondary)]">
              {nicheSetPct}% of users have a niche set in profile
            </span>
          </div>
          {topNichesByUser.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No niche data yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topNichesByUser.map(([niche, count]) => (
                <span
                  key={niche}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm text-[var(--text)]"
                >
                  {niche} <span className="font-semibold text-[var(--accent-purple)]">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {topReferrers.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </span>
            Top referrers (applications)
          </h3>
          <div className="flex flex-wrap gap-3">
            {topReferrers.map(([username, count]) => (
              <span
                key={username}
                className="px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm"
              >
                @{username}{' '}
                <span className="font-semibold text-[var(--accent-purple)]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          <span className="w-8 h-8 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center text-[#0EA5E9]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </span>
          Engagement
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Conversations
            </p>
            <p className="text-2xl font-bold text-[var(--text)]">{totalThreads}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Total messages
            </p>
            <p className="text-2xl font-bold text-[var(--text)]">{totalMessages}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Avg per thread
            </p>
            <p className="text-2xl font-bold text-[var(--text)]">{avgMessagesPerThread}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Verification rate
            </p>
            <p className="text-2xl font-bold text-[var(--text)]">{verificationRate}%</p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)]/50 border border-[var(--separator)] rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-[var(--text-muted)] mt-0.5" aria-hidden>
          ℹ️
        </span>
        <div className="text-sm text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text)]">Data accuracy</p>
          <p className="mt-1">
            User counts, applications, verifications, locations and niches come from your live
            database and are exact.
            {engagementFromExactCounts
              ? ' Conversation and message totals are exact platform-wide counts.'
              : ' Conversation and message totals are from the most recent threads until full counts load.'}
            Signups by day are grouped by your browser&apos;s local date.
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          🕐 Recent Activity
        </h3>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <div className="text-4xl mb-2">📭</div>
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--separator)]"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${activity.color}20`,
                    color: activity.color,
                  }}
                >
                  {activity.type.includes('approved') ? '✓' : '✗'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--text)]">{activity.title}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{activity.subtitle}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          ⚡ Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            icon="🔔"
            label="Send Notification"
            onClick={() => setActiveTab?.('settings')}
          />
          <QuickAction icon="📤" label="Export Data" onClick={() => setActiveTab?.('overview')} />
          <QuickAction icon="📋" label="View Logs" onClick={() => setActiveTab?.('audit')} />
          <QuickAction
            icon="🔄"
            label={cacheRefreshed ? 'Refreshed' : 'Refresh data'}
            onClick={handleClearCache}
          />
        </div>
        {cacheRefreshed && (
          <p className="text-sm text-[var(--success)] mt-2">Data refreshed.</p>
        )}
      </div>
    </div>
  )
}
