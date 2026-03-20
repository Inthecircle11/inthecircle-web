'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Tab } from '../types'

export interface AdminSessionRow {
  id: string
  session_id: string
  ip_address: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  created_at: string
  last_seen_at: string
  is_current?: boolean
}

export interface SettingsTabProps {
  appConfig?: Record<string, string>
  loading?: boolean
  onRefresh?: () => void
  onSaveConfig?: (updates: Record<string, string>) => Promise<void>
  configSaveSuccess?: string
  clearConfigSaveSuccess?: () => void
  blockedUsers?: Array<Record<string, unknown>>
  blockedLoading?: boolean
  onLoadBlocked?: () => void
  setActiveTab?: (tab: Tab) => void
  adminRoles?: string[]
  currentUserId?: string | null
  onAnnounce?: (title: string, body: string, segment: string) => Promise<void>
  announceSuccess?: string
  clearAnnounceSuccess?: () => void
  showToast?: (message: string, type?: 'success' | 'error') => void
  on403?: () => void
}

export function SettingsTab({
  appConfig = {},
  loading = false,
  onRefresh,
  onSaveConfig,
  configSaveSuccess = '',
  clearConfigSaveSuccess,
  blockedUsers = [],
  blockedLoading = false,
  onLoadBlocked,
  setActiveTab,
  adminRoles = [],
  currentUserId = null,
  onAnnounce,
  announceSuccess = '',
  clearAnnounceSuccess,
  showToast,
  on403,
}: SettingsTabProps) {
  const [configDraft, setConfigDraft] = useState<Record<string, string>>(appConfig)
  const [saving, setSaving] = useState(false)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceSegment, setAnnounceSegment] = useState('all')
  const [adminUsers, setAdminUsers] = useState<
    Array<{ admin_user_id: string; email: string | null; name: string | null; roles: string[] }>
  >([])
  const [rolesList, setRolesList] = useState<
    Array<{ id: string; name: string; description: string | null }>
  >([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [roleActionLoading, setRoleActionLoading] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [adminSessions, setAdminSessions] = useState<AdminSessionRow[]>([])
  const [adminSessionsLoading, setAdminSessionsLoading] = useState(false)
  const [adminSessionsError, setAdminSessionsError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const isSuperAdmin = adminRoles.includes('super_admin')
  const canManageRoles = adminRoles.includes('super_admin')

  const loadAdminUsersAndRoles = useCallback(async () => {
    if (!isSuperAdmin) return
    setAdminUsersLoading(true)
    setRoleError(null)
    try {
      const [ur, rr] = await Promise.all([
        fetch('/api/admin/admin-users', { credentials: 'include' }),
        fetch('/api/admin/roles', { credentials: 'include' }),
      ])
      const userData = await ur.json().catch(() => ({}))
      const roleData = await rr.json().catch(() => ({}))
      if (ur.ok && userData.admin_users) setAdminUsers(userData.admin_users)
      else if (!ur.ok) setRoleError((userData?.error as string) || 'Failed to load admin users')
      if (rr.ok && roleData.roles) setRolesList(roleData.roles)
      else if (!rr.ok) setRoleError((roleData?.error as string) || 'Failed to load roles')
    } catch {
      setRoleError('Failed to load admin users and roles')
    }
    setAdminUsersLoading(false)
  }, [isSuperAdmin])

  useEffect(() => {
    if (isSuperAdmin) void loadAdminUsersAndRoles()
  }, [isSuperAdmin, loadAdminUsersAndRoles])

  const loadAdminSessions = useCallback(async () => {
    setAdminSessionsError(null)
    setAdminSessionsLoading(true)
    try {
      const res = await fetch('/api/admin/sessions', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.sessions)) {
        setAdminSessions(data.sessions)
      } else if (res.status === 403) {
        setAdminSessionsError('You don't have permission to view active sessions.')
        setAdminSessions([])
        on403?.()
      } else {
        setAdminSessionsError(data.error || 'Failed to load sessions')
        setAdminSessions([])
      }
    } catch {
      setAdminSessionsError('Failed to load sessions')
      setAdminSessions([])
    }
    setAdminSessionsLoading(false)
  }, [on403])

  useEffect(() => {
    void loadAdminSessions()
  }, [loadAdminSessions])

  useEffect(() => {
    setConfigDraft(appConfig)
  }, [appConfig])
  useEffect(() => {
    if (!configSaveSuccess || !clearConfigSaveSuccess) return
    const t = setTimeout(clearConfigSaveSuccess, 3000)
    return () => clearTimeout(t)
  }, [configSaveSuccess, clearConfigSaveSuccess])

  const handleSaveConfig = async () => {
    if (!onSaveConfig) return
    setSaving(true)
    await onSaveConfig(configDraft)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] p-6 rounded-2xl">
        <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication (2FA)</h3>
        <p className="text-[var(--text-secondary)] mb-4">
          Admin access requires 2FA. Enable or manage it in the main app Settings.
        </p>
        <a
          href="/settings/security"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-[var(--accent-purple)] text-white hover:opacity-90 transition-opacity"
        >
          Open app Settings → 2FA
        </a>
      </div>

      {/* Active Sessions (Phase 6) */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl">
        <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Admin sessions for this account. Revoke any session you don't recognize.
        </p>
        <button
          type="button"
          onClick={loadAdminSessions}
          disabled={adminSessionsLoading}
          className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-3 disabled:opacity-50"
        >
          {adminSessionsLoading ? 'Loading…' : 'Refresh'}
        </button>
        {adminSessionsError && (
          <p className="text-sm text-[var(--error)] mb-3">{adminSessionsError}</p>
        )}
        {!adminSessionsError && adminSessions.length === 0 && !adminSessionsLoading && (
          <p className="text-sm text-[var(--text-muted)]">
            No active sessions, or run migration for admin_sessions.
          </p>
        )}
        {!adminSessionsError && adminSessions.length > 0 && (
          <div className="space-y-3">
            {adminSessions.map((s) => (
              <div
                key={s.id}
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                  s.is_current
                    ? 'border-[var(--accent-purple)]/50 bg-[var(--accent-purple)]/5'
                    : 'border-[var(--separator)] bg-[var(--surface-hover)]/30'
                }`}
              >
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {s.ip_address ?? 'Unknown IP'}
                    {s.is_current && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Last activity: {new Date(s.last_seen_at).toLocaleString()}
                    {s.country && ` · ${s.city ? `${s.city}, ` : ''}${s.country}`}
                  </p>
                  {s.user_agent && (
                    <p
                      className="text-xs text-[var(--text-muted)] truncate max-w-md"
                      title={s.user_agent}
                    >
                      {s.user_agent}
                    </p>
                  )}
                </div>
                {canManageRoles && !s.is_current && (
                  <button
                    type="button"
                    disabled={revokingId === s.id}
                    onClick={async () => {
                      setRevokingId(s.id)
                      try {
                        const res = await fetch(`/api/admin/sessions/${s.id}/revoke`, {
                          method: 'POST',
                          credentials: 'include',
                        })
                        const data = await res.json().catch(() => ({}))
                        if (res.ok) void loadAdminSessions()
                        else if (res.status === 403 && showToast)
                          showToast("You don't have permission to revoke sessions.", 'error')
                        else if (showToast)
                          showToast((data?.error as string) || 'Failed to revoke session', 'error')
                      } finally {
                        setRevokingId(null)
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium disabled:opacity-50"
                  >
                    {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feature flags & maintenance */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl">
        <h3 className="text-lg font-semibold mb-4">Feature flags & maintenance</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3" htmlFor="admin-config-signups-open">
            <input
              id="admin-config-signups-open"
              name="signups_open"
              type="checkbox"
              checked={configDraft.signups_open !== 'false'}
              onChange={(e) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  signups_open: e.target.checked ? 'true' : 'false',
                }))
              }
              className="rounded"
            />
            <span>Signups open</span>
          </label>
          <label className="flex items-center gap-3" htmlFor="admin-config-verification-open">
            <input
              id="admin-config-verification-open"
              name="verification_requests_open"
              type="checkbox"
              checked={configDraft.verification_requests_open !== 'false'}
              onChange={(e) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  verification_requests_open: e.target.checked ? 'true' : 'false',
                }))
              }
              className="rounded"
            />
            <span>Verification requests open</span>
          </label>
          <label className="flex items-center gap-3" htmlFor="admin-config-maintenance-mode">
            <input
              id="admin-config-maintenance-mode"
              name="maintenance_mode"
              type="checkbox"
              checked={configDraft.maintenance_mode === 'true'}
              onChange={(e) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  maintenance_mode: e.target.checked ? 'true' : 'false',
                }))
              }
              className="rounded"
            />
            <span>Maintenance mode</span>
          </label>
          <div>
            <label
              className="block text-sm text-[var(--text-muted)] mb-1"
              htmlFor="admin-maintenance-banner"
            >
              Maintenance banner (shown to all users)
            </label>
            <input
              id="admin-maintenance-banner"
              name="maintenance_banner"
              type="text"
              value={configDraft.maintenance_banner ?? ''}
              onChange={(e) =>
                setConfigDraft((prev) => ({ ...prev, maintenance_banner: e.target.value }))
              }
              placeholder="Optional message"
              className="input-field w-full"
            />
          </div>
          {configSaveSuccess && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/40 text-[var(--success)] text-sm flex items-center justify-between gap-2">
              <span>{configSaveSuccess}</span>
              {clearConfigSaveSuccess && (
                <button
                  type="button"
                  onClick={clearConfigSaveSuccess}
                  className="font-medium hover:underline"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving || !onSaveConfig}
              className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save config'}
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm disabled:opacity-50"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Announcements */}
      {onAnnounce && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Send announcement</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Queue a push/email to users. Wire your provider in api/admin/announce/route.ts.
          </p>
          {announceSuccess && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/40 text-[var(--success)] text-sm flex items-center justify-between gap-2">
              <span>{announceSuccess}</span>
              <button
                type="button"
                onClick={clearAnnounceSuccess}
                className="font-medium hover:underline"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
          <label className="block text-sm text-[var(--text-muted)] mb-1" htmlFor="admin-announce-title">
            Title
          </label>
          <input
            id="admin-announce-title"
            name="announce_title"
            type="text"
            value={announceTitle}
            onChange={(e) => setAnnounceTitle(e.target.value)}
            placeholder="Title"
            className="input-field w-full mb-2"
          />
          <label
            className="block text-sm text-[var(--text-muted)] mb-1"
            htmlFor="admin-announce-message"
          >
            Message
          </label>
          <textarea
            id="admin-announce-message"
            name="announce_body"
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
            placeholder="Message"
            className="input-field w-full mb-2 min-h-[80px]"
          />
          <label
            className="block text-sm text-[var(--text-muted)] mb-1"
            htmlFor="admin-announce-segment"
          >
            Audience
          </label>
          <select
            id="admin-announce-segment"
            name="announce_segment"
            value={announceSegment}
            onChange={(e) => setAnnounceSegment(e.target.value)}
            className="input-field w-full mb-3"
            aria-label="Announcement audience"
          >
            <option value="all">All users</option>
            <option value="verified">Verified only</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              await onAnnounce(announceTitle, announceBody, announceSegment)
              setAnnounceTitle('')
              setAnnounceBody('')
            }}
            className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium"
          >
            Send announcement
          </button>
        </div>
      )}

      {/* Blocked users overview */}
      {onLoadBlocked && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Blocked users (platform)</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">Who blocked whom. Load to refresh.</p>
          <button
            type="button"
            onClick={onLoadBlocked}
            disabled={blockedLoading}
            className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-3 disabled:opacity-50"
          >
            {blockedLoading ? 'Loading…' : 'Load blocked list'}
          </button>
          {blockedUsers.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {blockedUsers.slice(0, 50).map((b: Record<string, unknown>) => (
                <div
                  key={String(b.id)}
                  className="text-sm py-1 border-b border-[var(--separator)]"
                >
                  @{String(b.blocker_username ?? b.blocker_id)} blocked @
                  {String(b.blocked_username ?? b.blocked_id)}
                </div>
              ))}
              {blockedUsers.length > 50 && (
                <p className="text-xs text-[var(--text-muted)]">
                  … and {blockedUsers.length - 50} more
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin users & roles - super_admin only */}
      {isSuperAdmin && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Admin users & roles</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Assign or remove roles. Only super_admin can manage.
          </p>
          {roleError && (
            <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-sm flex items-center justify-between gap-2">
              <span>{roleError}</span>
              <button
                type="button"
                onClick={() => setRoleError(null)}
                className="font-medium hover:underline"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={loadAdminUsersAndRoles}
            disabled={adminUsersLoading}
            className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-4 disabled:opacity-50"
          >
            {adminUsersLoading ? 'Loading…' : 'Refresh list'}
          </button>
          {adminUsers.length === 0 && !adminUsersLoading ? (
            <p className="text-sm text-[var(--text-muted)]">
              No admin users with roles yet. Allowlisted admins get super_admin on first login.
            </p>
          ) : (
            <div className="space-y-4">
              {adminUsers.map((au) => (
                <div
                  key={au.admin_user_id}
                  className="p-4 rounded-xl border border-[var(--separator)] bg-[var(--surface-hover)]/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-medium">
                      {au.name || au.email || au.admin_user_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {au.admin_user_id.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {au.roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] text-sm"
                      >
                        {r}
                        <button
                          type="button"
                          disabled={
                            roleActionLoading !== null ||
                            (r === 'super_admin' && au.admin_user_id === currentUserId)
                          }
                          onClick={async () => {
                            setRoleActionLoading(au.admin_user_id + r)
                            try {
                              const res = await fetch(
                                `/api/admin/admin-users/${encodeURIComponent(au.admin_user_id)}/remove-role?role_name=${encodeURIComponent(r)}`,
                                { method: 'DELETE', credentials: 'include' }
                              )
                              const data = await res.json().catch(() => ({}))
                              if (res.ok) await loadAdminUsersAndRoles()
                              else
                                setRoleError(
                                  typeof data?.error === 'string' ? data.error : 'Failed to remove role'
                                )
                            } finally {
                              setRoleActionLoading(null)
                            }
                          }}
                          className="ml-0.5 hover:opacity-80 disabled:opacity-40"
                          aria-label={`Remove ${r}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <select
                      className="input-field text-sm w-auto max-w-[140px]"
                      defaultValue=""
                      onChange={async (e) => {
                        const roleName = e.target.value
                        if (!roleName) return
                        e.target.value = ''
                        setRoleActionLoading(au.admin_user_id + roleName)
                        try {
                          const res = await fetch(
                            `/api/admin/admin-users/${encodeURIComponent(au.admin_user_id)}/assign-role`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ role_name: roleName }),
                            }
                          )
                          const data = await res.json().catch(() => ({}))
                          if (res.ok) await loadAdminUsersAndRoles()
                          else
                            setRoleError(
                              typeof data?.error === 'string' ? data.error : 'Failed to assign role'
                            )
                        } finally {
                          setRoleActionLoading(null)
                        }
                      }}
                      aria-label="Assign role"
                    >
                      <option value="">+ Assign role</option>
                      {rolesList
                        .filter((ro) => !au.roles.includes(ro.name))
                        .map((ro) => (
                          <option key={ro.id} value={ro.name}>
                            {ro.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-[var(--surface)] p-6 rounded-2xl">
        <div className="space-y-4 text-[var(--text-secondary)]">
          <p>• Real-time sync: Enabled (Applications, Users, Verifications, Inbox)</p>
          <p>• Version: Web Admin v2.0</p>
          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="text-[var(--accent-purple)] hover:underline"
            >
              View audit log →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
