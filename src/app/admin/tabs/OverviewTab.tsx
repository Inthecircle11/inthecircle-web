'use client'

import type { Application, LocationByCountry, Stats, User } from '../types'
import { StatCard } from '../components/StatCard'
import { downloadCSV } from '../utils'

export interface OverviewTabProps {
  totalUsers: number
  newUsersLast24h: number
  newUsersThisWeek: number
  newUsersLast30d: number
  growthRateWoW: number
  activeUsersToday: number
  activeSessions: {
    count: number
    users: Array<{ user_id: string; email: string | null; username: string | null; name: string | null; last_active_at: string }>
    minutes: number
  } | null
  totalThreads: number
  totalMessages: number
  avgMessagesPerUser: string
  verifiedUsersCount: number
  verificationRate: number
  stats: Stats
  approvalRate: number
  applicationsSubmittedLast7d: number
  applicationsApprovedLast7d: number
  signupsByWeek: { label: string; count: number; weekStart: Date }[]
  cumulativeUsersByWeek: { label: string; count: number; weekStart: Date; cumulative: number }[]
  locationsByCountry: LocationByCountry[]
  citiesList: { label: string; count: number }[]
  topNiches: [string, number][]
  snapshotDate: Date
  users: User[]
  applications: Application[]
}

export function OverviewTab({
  totalUsers,
  newUsersLast24h,
  newUsersThisWeek,
  newUsersLast30d,
  growthRateWoW,
  activeUsersToday,
  activeSessions,
  totalThreads,
  totalMessages,
  avgMessagesPerUser,
  verifiedUsersCount,
  verificationRate,
  stats,
  approvalRate,
  applicationsSubmittedLast7d,
  applicationsApprovedLast7d,
  signupsByWeek,
  cumulativeUsersByWeek,
  locationsByCountry,
  citiesList,
  topNiches,
  snapshotDate,
  users,
  applications,
}: OverviewTabProps) {
  const maxWeekly = Math.max(1, ...signupsByWeek.map((w) => w.count))

  const onExportUsers = () => {
    const headers = ['id', 'email', 'name', 'username', 'is_verified', 'is_banned', 'created_at']
    const rows = (users ?? []).map((u) => [
      u.id,
      u.email ?? '',
      u.name ?? '',
      u.username ?? '',
      u.is_verified ? 'true' : 'false',
      u.is_banned ? 'true' : 'false',
      u.created_at ?? '',
    ])
    downloadCSV(`users_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const onExportApplications = () => {
    const headers = [
      'id',
      'user_id',
      'name',
      'username',
      'email',
      'niche',
      'status',
      'application_date',
      'referrer_username',
      'instagram_username',
      'follower_count',
    ]
    const rows = (applications ?? []).map((a) => [
      a.id,
      a.user_id,
      a.name ?? '',
      a.username ?? '',
      a.email ?? '',
      a.niche ?? '',
      (a.status ?? '').toUpperCase(),
      a.application_date ?? '',
      a.referrer_username ?? '',
      a.instagram_username ?? '',
      a.follower_count ?? '',
    ])
    downloadCSV(`applications_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)] tracking-tight">Platform overview</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Data as of{' '}
            {snapshotDate instanceof Date ? snapshotDate.toLocaleString() : new Date(snapshotDate).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportUsers}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-[var(--text)] text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            Export users (CSV)
          </button>
          <button
            type="button"
            onClick={onExportApplications}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-[var(--text)] text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            Export applications (CSV)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total users" value={totalUsers} icon="👥" color="#A855F7" trend={`+${newUsersLast30d} last 30d`} />
        <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3 bg-[#3B82F6]/20 text-[#2563EB]">📈</div>
          <p className="text-3xl font-bold min-h-[1.25em] tabular-nums text-[#3B82F6]">{typeof activeUsersToday === 'number' ? activeUsersToday : 0}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Active today</p>
          <p className="text-xs mt-2 text-[var(--text-muted)]">Logged in last 24h</p>
        </div>
        <StatCard title="Conversations" value={totalThreads} icon="💬" color="#8B5CF6" trend={`${totalMessages} messages · ${avgMessagesPerUser} avg/user`} />
        <StatCard title="Verified" value={typeof verifiedUsersCount === 'number' ? verifiedUsersCount : 0} icon="✓" color="#10B981" trend={`${verificationRate}% of users`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="New (24h)" value={newUsersLast24h} icon="🆕" color="#06B6D4" trend="Signups" />
        <StatCard title="New (7d)" value={newUsersThisWeek} icon="📅" color="#F59E0B" trend={growthRateWoW !== 0 ? `${growthRateWoW > 0 ? '+' : ''}${growthRateWoW}% WoW` : 'This week'} />
        <StatCard title="Applications (7d)" value={applicationsSubmittedLast7d} icon="📋" color="#EC4899" trend={`${applicationsApprovedLast7d} approved · ${approvalRate}% rate`} />
        <StatCard title="Pending review" value={stats.pending} icon="⏳" color="#F59E0B" trend={`${stats.approved} approved · ${stats.rejected} rejected`} />
      </div>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Concurrent active users</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Users with an active session in the last {activeSessions?.minutes ?? 15} minutes (who they are right now).
        </p>
        {activeSessions === null ? (
          <p className="text-sm text-[var(--text-muted)]">
            Loading… or run migration <code className="text-xs bg-[var(--surface-hover)] px-1 rounded">20260225000001_get_active_sessions.sql</code>
          </p>
        ) : activeSessions.count === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No one active in the last {activeSessions.minutes} minutes.</p>
        ) : (
          <>
            <p className="text-2xl font-bold text-[var(--accent-purple)] mb-4">{activeSessions.count} active now</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--separator)] text-left text-[var(--text-muted)]">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions?.users?.map((u) => (
                    <tr key={u.user_id} className="border-b border-[var(--separator)]/50">
                      <td className="py-2 pr-4 text-[var(--text)]">
                        {u.name || u.username ? `${u.name || ''} ${u.username ? `@${u.username}` : ''}`.trim() || '—' : '—'}
                      </td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">{u.email ?? '—'}</td>
                      <td className="py-2 text-[var(--text-muted)]">{u.last_active_at ? new Date(u.last_active_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">12-week signup growth</h3>
        <div className="h-64 flex items-end gap-1">
          {signupsByWeek.map((w) => (
            <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[var(--accent-purple)]/80 hover:bg-[var(--accent-purple)] transition-colors min-h-[4px]"
                style={{ height: `${(w.count / maxWeekly) * 100}%` }}
                title={`${w.label}: ${w.count}`}
              />
              <span className="text-[10px] text-[var(--text-muted)] truncate w-full text-center">{w.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--separator)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Cumulative users (last 12 weeks): <strong className="text-[var(--text)]">{cumulativeUsersByWeek[cumulativeUsersByWeek.length - 1]?.cumulative ?? 0}</strong>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-3">Top niches (applications)</h3>
          <ul className="space-y-2">
            {topNiches.slice(0, 8).map(([name, count]) => (
              <li key={name} className="flex justify-between text-sm">
                <span className="text-[var(--text)] truncate mr-2">{name || '—'}</span>
                <span className="text-[var(--text-muted)]">{count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-3">Countries</h3>
          {locationsByCountry.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No country data yet</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {locationsByCountry.slice(0, 8).map((row) => (
                <li key={row.country} className="flex items-center justify-between py-1.5">
                  <span className="text-base" aria-hidden>
                    {row.flag}
                  </span>
                  <span className="font-medium text-[var(--text)] flex-1 ml-2 truncate">{row.country}</span>
                  <span className="text-sm text-[var(--text-muted)]">{row.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-3">Cities</h3>
          {citiesList.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No city data yet</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {citiesList.slice(0, 8).map(({ label, count }) => (
                <li key={label} className="flex justify-between py-1.5">
                  <span className="text-[var(--text)] truncate flex-1 mr-2">{label}</span>
                  <span className="text-sm text-[var(--text-muted)]">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        For detailed metrics, recent activity, and full dashboard use the <strong>Dashboard</strong> tab.
      </p>
    </div>
  )
}
