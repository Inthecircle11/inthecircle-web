'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { parseAdminResponse } from '@/lib/admin-client'
import { getAdminBase } from '@/lib/admin'
import './admin-v3.css'

type PanelId =
  | 'overview'
  | 'dashboard'
  | 'analytics'
  | 'applications'
  | 'users'
  | 'verifications'
  | 'inbox'
  | 'reports'
  | 'data-requests'
  | 'risk'
  | 'approvals'
  | 'audit-log'
  | 'compliance'
  | 'invite'
  | 'settings'

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
}

const PANEL_LABELS: Record<PanelId, string> = {
  overview: 'Overview',
  dashboard: 'Dashboard',
  analytics: 'Product Analytics',
  applications: 'Applications',
  users: 'Users',
  verifications: 'Verifications',
  inbox: 'Inbox',
  reports: 'Reports',
  'data-requests': 'Data Requests',
  risk: 'Risk',
  approvals: 'Approvals',
  'audit-log': 'Audit Log',
  compliance: 'Compliance',
  invite: 'Invite Creator',
  settings: 'Settings',
}

function fmt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString()
}

function relT(s: string | null | undefined): string {
  if (!s) return '-'
  const diff = (Date.now() - new Date(s).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

export default function AdminV3Page() {
  const router = useRouter()
  const [gateUnlocked, setGateUnlocked] = useState<boolean | null>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState('')
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [error, setError] = useState<string | null>(null)
  const [lastUpd, setLastUpd] = useState<Date | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' | 'info' }[]>([])
  const toastIdRef = useRef(0)

  // Data
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeToday, setActiveToday] = useState<number | null>(null)
  const [overviewCounts, setOverviewCounts] = useState<{
    totalUsers?: number
    verifiedCount?: number
    totalThreadCount?: number
    totalMessageCount?: number
    newUsersLast7d?: number
    newUsersLast30d?: number
  } | null>(null)
  const [reportsCount, setReportsCount] = useState(0)
  const [recentActivity, setRecentActivity] = useState<Array<{ title: string; subtitle: string; timestamp: string; color: string }>>([])
  const [adminRoles, setAdminRoles] = useState<string[]>([])
  const [adminEmail, setAdminEmail] = useState('')
  const [governanceScore, setGovernanceScore] = useState<number | null>(null)

  const _showToast = useCallback((msg: string, type: 'ok' | 'err' | 'info' = 'info') => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  // Gate check on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/gate', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.data?.unlocked === true) setGateUnlocked(true)
        else if (!cancelled) setGateUnlocked(false)
      })
      .catch(() => {
        if (!cancelled) setGateUnlocked(false)
      })
    return () => { cancelled = true }
  }, [])

  const doGate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setGateError('')
      if (!gatePassword.trim()) return
      setGateSubmitting(true)
      try {
        const res = await fetch('/api/admin/gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password: gatePassword }),
        })
        const json = await res.json()
        const { data, error: err } = parseAdminResponse<{ ok?: boolean }>(res, json)
        if (err) {
          setGateError(err)
        } else if (data?.ok) {
          setGateUnlocked(true)
          setGatePassword('')
        } else {
          setGateError('Invalid password')
        }
      } catch {
        setGateError('Something went wrong')
      }
      setGateSubmitting(false)
    },
    [gatePassword]
  )

  const checkAuth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/check', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ authorized?: boolean; roles?: string[] }>(res, json)
      if (res.status === 401) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      if (data?.authorized) {
        setAuthorized(true)
        setAdminRoles(Array.isArray(data.roles) ? data.roles : [])
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setAdminEmail(user.email)
        void loadOverview()
      } else {
        setAuthorized(false)
      }
    } catch {
      setError('Failed to verify session')
    }
    setLoading(false)
  }, [loadOverview])

  useEffect(() => {
    if (gateUnlocked !== true) return
    checkAuth()
  }, [gateUnlocked, checkAuth])

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview-stats', { credentials: 'include' })
      const json = await res.json()
      const { data } = parseAdminResponse<{
        stats?: Stats
        activeToday?: number
        overviewCounts?: {
          totalUsers?: number
          verifiedCount?: number
          totalThreadCount?: number
          totalMessageCount?: number
          newUsersLast7d?: number
          newUsersLast30d?: number
        }
      }>(res, json)
      if (data?.stats) setStats(data.stats)
      if (typeof data?.activeToday === 'number') setActiveToday(data.activeToday)
      if (data?.overviewCounts) setOverviewCounts(data.overviewCounts)
      setLastUpd(new Date())
    } catch {
      setError('Failed to load overview')
    }
  }, [])

  const loadRecentActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verification-activity', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      setRecentActivity(
        arr.map((a: { title?: string; subtitle?: string; timestamp?: string; color?: string }) => ({
          title: a.title ?? '',
          subtitle: a.subtitle ?? '',
          timestamp: a.timestamp ?? '',
          color: a.color ?? '#6B7280',
        }))
      )
    } catch {
      // non-blocking
    }
  }, [])

  const loadReportsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports', { credentials: 'include' })
      const json = await res.json()
      const list = json?.reports ?? []
      setReportsCount(list.filter((r: { status?: string }) => r.status === 'pending').length)
    } catch {
      // non-blocking
    }
  }, [])

  const loadGovernanceScore = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/compliance/health', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (typeof data?.overall_score === 'number') setGovernanceScore(data.overall_score)
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    loadRecentActivity()
    loadReportsCount()
    loadGovernanceScore()
  }, [authorized, loadRecentActivity, loadReportsCount, loadGovernanceScore])

  const doLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoginError('')
      const email = loginEmail.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setLoginError('Please enter a valid email address')
        return
      }
      setLoginLoading(true)
      try {
        const res = await fetch('/api/admin/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password: loginPassword }),
        })
        const json = await res.json().catch(() => ({}))
        const { data: _data, error: err } = parseAdminResponse(res, json)
        if (err) {
          setLoginError(err)
        } else if (res.ok) {
          setAuthorized(true)
          setAdminEmail(email) // show immediately; checkAuth uses getUser() on reload
          void loadOverview()
        } else {
          setLoginError(json?.error ?? 'Sign in failed')
        }
      } catch {
        setLoginError('Something went wrong')
      }
      setLoginLoading(false)
    },
    [loginEmail, loginPassword, loadOverview]
  )

  const doLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(getAdminBase())
    router.refresh()
  }, [router])

  const refreshCurrent = useCallback(() => {
    setError(null)
    if (activePanel === 'overview') void loadOverview()
    setLastUpd(new Date())
  }, [activePanel, loadOverview])

  const nav = useCallback((panel: PanelId) => {
    setActivePanel(panel)
  }, [])

  // Loading state before gate resolved
  if (gateUnlocked === null) {
    return (
      <div className="admin-v3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '2px solid #6366f1',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: 12, color: '#8892aa', fontSize: 13 }}>Loading…</p>
        </div>
      </div>
    )
  }

  // Gate screen — full viewport so the card is centered and background fills the screen
  if (gateUnlocked === false) {
    return (
      <div className="admin-v3" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div id="gate" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="aw">
            <div className="aorb">⛔</div>
            <div className="atit">Admin Access</div>
            <div className="asub">Enter gate password to continue</div>
            <form onSubmit={doGate}>
              <input
                className="ainp"
                type="password"
                value={gatePassword}
                onChange={(e) => {
                  setGatePassword(e.target.value)
                  setGateError('')
                }}
                placeholder="Gate password"
                autoComplete="off"
              />
              <button type="submit" className="abtn" disabled={gateSubmitting}>
                {gateSubmitting ? 'Checking…' : 'Continue'}
              </button>
              <div className="aerr">{gateError}</div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Login screen — full viewport so the card is centered and background fills the screen
  if (!authorized && !loading) {
    return (
      <div className="admin-v3" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div id="login" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="aw">
            <div className="aorb">⚪</div>
            <div className="atit">Admin Sign In</div>
            <div className="asub">Inthecircle Operations</div>
            <form onSubmit={doLogin}>
              <input
                className="ainp"
                type="email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value)
                  setLoginError('')
                }}
                placeholder="admin@inthecircle.co"
                autoComplete="email"
              />
              <div className="pww">
                <input
                  className="ainp"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  style={{ paddingRight: 36 }}
                />
                <button type="button" className="pwt" onClick={() => setShowPassword((s) => !s)} aria-label="Toggle password">
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              <button type="submit" className="abtn" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
              <div className="aerr">{loginError}</div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !authorized) {
    return (
      <div className="admin-v3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '2px solid #6366f1',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: 12, color: '#8892aa', fontSize: 13 }}>Loading admin panel…</p>
        </div>
      </div>
    )
  }

  const totalApps = stats ? stats.total : 0
  const pendingCount = stats?.pending ?? 0

  return (
    <div className="admin-v3">
      <div id="shell">
        <nav id="sb">
          <div className="sb-brand">
            <div className="sb-orb" />
            <div>
              <div className="sb-bt">Inthecircle</div>
              <div className="sb-bs">Admin v3</div>
            </div>
          </div>
          <div className="sb-sec">Operations</div>
          <button type="button" className={`ni ${activePanel === 'overview' ? 'active' : ''}`} onClick={() => nav('overview')}>
            <span className="nico">🏠</span>Overview
          </button>
          <button type="button" className={`ni ${activePanel === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')}>
            <span className="nico">📊</span>Dashboard
          </button>
          <button type="button" className={`ni ${activePanel === 'analytics' ? 'active' : ''}`} onClick={() => nav('analytics')}>
            <span className="nico">📈</span>Product Analytics
          </button>
          <div className="sb-sec">Community</div>
          <button type="button" className={`ni ${activePanel === 'applications' ? 'active' : ''}`} onClick={() => nav('applications')}>
            <span className="nico">📋</span>Applications
            {pendingCount > 0 && <span className="nbdg w">{pendingCount > 99 ? '99+' : pendingCount}</span>}
          </button>
          <button type="button" className={`ni ${activePanel === 'users' ? 'active' : ''}`} onClick={() => nav('users')}>
            <span className="nico">👥</span>Users
          </button>
          <button type="button" className={`ni ${activePanel === 'verifications' ? 'active' : ''}`} onClick={() => nav('verifications')}>
            <span className="nico">✅</span>Verifications
          </button>
          <div className="sb-sec">Moderation</div>
          <button type="button" className={`ni ${activePanel === 'inbox' ? 'active' : ''}`} onClick={() => nav('inbox')}>
            <span className="nico">📬</span>Inbox
          </button>
          <button type="button" className={`ni ${activePanel === 'reports' ? 'active' : ''}`} onClick={() => nav('reports')}>
            <span className="nico">🚩</span>Reports
            {reportsCount > 0 && <span className="nbdg">{reportsCount > 99 ? '99+' : reportsCount}</span>}
          </button>
          <button type="button" className={`ni ${activePanel === 'data-requests' ? 'active' : ''}`} onClick={() => nav('data-requests')}>
            <span className="nico">📂</span>Data Requests
          </button>
          <button type="button" className={`ni ${activePanel === 'risk' ? 'active' : ''}`} onClick={() => nav('risk')}>
            <span className="nico">⚠</span>Risk
          </button>
          <button type="button" className={`ni ${activePanel === 'approvals' ? 'active' : ''}`} onClick={() => nav('approvals')}>
            <span className="nico">✔</span>Approvals
          </button>
          <div className="sb-sec">System</div>
          <button type="button" className={`ni ${activePanel === 'audit-log' ? 'active' : ''}`} onClick={() => nav('audit-log')}>
            <span className="nico">📝</span>Audit Log
          </button>
          <button type="button" className={`ni ${activePanel === 'compliance' ? 'active' : ''}`} onClick={() => nav('compliance')}>
            <span className="nico">🛡</span>Compliance
          </button>
          <button type="button" className={`ni ${activePanel === 'invite' ? 'active' : ''}`} onClick={() => nav('invite')}>
            <span className="nico">✉</span>Invite Creator
          </button>
          <button type="button" className={`ni ${activePanel === 'settings' ? 'active' : ''}`} onClick={() => nav('settings')}>
            <span className="nico">⚙</span>Settings
          </button>
          <div className="sh">
            <div className="sh-tit">Governance Health</div>
            <div className="sh-r">
              <span style={{ color: 'var(--t2)', fontSize: '11.5px' }}>Score</span>
              <span className={`dot ${governanceScore != null && governanceScore >= 70 ? 'ok' : governanceScore != null ? 'warn' : ''}`} />
            </div>
            <div className="sh-r" style={{ marginBottom: 0 }}>
              <span style={{ color: 'var(--t2)', fontSize: '11.5px' }}>
                {governanceScore != null ? `${governanceScore} / 100` : '—'}
              </span>
            </div>
          </div>
          <div className="sb-bot">
            <div className="sb-user">
              <div className="sav">{adminEmail?.[0]?.toUpperCase() ?? 'A'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sb-un">{adminEmail?.split('@')[0] ?? 'Admin'}</div>
                <div className="sb-ur">{adminRoles[0] ?? ''}</div>
              </div>
              <button type="button" className="sb-lo" onClick={doLogout} title="Sign out">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2H12a1 1 0 011 1v8a1 1 0 01-1 1H9M6 10l3-3-3-3M9 7H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </nav>
        <div id="mn">
          <div id="hdr">
            <div className="hbc">
              <span className="hbr">Admin</span>
              <span className="hbs">/</span>
              <span className="hbc-cur">{PANEL_LABELS[activePanel]}</span>
            </div>
            <div className="hdr-r">
              <span className="hlive">
                <span className="hldot" />
                Live
              </span>
              <span className="hupd">{lastUpd ? `Updated ${relT(lastUpd.toISOString())}` : 'Not synced'}</span>
              {adminRoles[0] && <span className="hrole">{adminRoles[0]}</span>}
              <button type="button" className="href" onClick={refreshCurrent}>
                ↻ Refresh
              </button>
            </div>
          </div>
          <div id="estrip" className={error ? 'on' : ''}>
            <span>⚠</span>
            <span id="emsg">{error}</span>
            <button type="button" className="btn bsm btn-gh" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
              Dismiss
            </button>
          </div>
          <div id="ct">
            {/* Overview panel */}
            <div id="panel-overview" className={`panel ${activePanel === 'overview' ? 'active' : ''}`}>
              <div className="ptit">Overview</div>
              <div className="pdesc">Real-time health snapshot and key metrics</div>
              <div className="sg sg4">
                <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                  <div className="sc-lbl">Total Applications</div>
                  <div className="sc-val">{stats ? fmt(totalApps) : '—'}</div>
                  <div className="sc-meta">All time</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                  <div className="sc-lbl">Approved Members</div>
                  <div className="sc-val">{stats ? fmt(stats.approved) : '—'}</div>
                  <div className="sc-meta">Active</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                  <div className="sc-lbl">Pending Review</div>
                  <div className="sc-val">{stats ? fmt(stats.pending) : '—'}</div>
                  <div className="sc-meta">Awaiting action</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Active Today</div>
                  <div className="sc-val">{activeToday != null ? fmt(activeToday) : '—'}</div>
                  <div className="sc-meta">Last 24h</div>
                </div>
              </div>
              <div className="sg sg4">
                <div className="sc" style={{ ['--c' as string]: 'var(--err)' }}>
                  <div className="sc-lbl">Rejected</div>
                  <div className="sc-val">{stats ? fmt(stats.rejected) : '—'}</div>
                  <div className="sc-meta" />
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap2)' }}>
                  <div className="sc-lbl">Waitlisted</div>
                  <div className="sc-val">{stats ? fmt(stats.waitlisted) : '—'}</div>
                  <div className="sc-meta" />
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Verified Members</div>
                  <div className="sc-val">{overviewCounts ? fmt(overviewCounts.verifiedCount) : '—'}</div>
                  <div className="sc-meta" />
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                  <div className="sc-lbl">Open Reports</div>
                  <div className="sc-val">{fmt(reportsCount)}</div>
                  <div className="sc-meta" />
                </div>
              </div>
              <div className="g2">
                <div className="tc">
                  <div className="tch">
                    <div className="tct">Recent Activity</div>
                  </div>
                  <div className="alist">
                    {recentActivity.length === 0 ? (
                      <div className="te">No recent activity.</div>
                    ) : (
                      recentActivity.slice(0, 10).map((a, i) => (
                        <div key={i} className="aitem">
                          <div className="aico p">📌</div>
                          <div className="abody">
                            <div className="atxt">
                              <strong>{a.title}</strong> {a.subtitle}
                            </div>
                            <div className="atime">{relT(a.timestamp)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="ct">Status Breakdown</div>
                  <div className="cs">All-time distribution</div>
                  <div className="cb cb160" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {stats && (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Approved: {fmt(stats.approved)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Pending: {fmt(stats.pending)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Rejected: {fmt(stats.rejected)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Waitlisted: {fmt(stats.waitlisted)}</span>
                      </>
                    )}
                    {!stats && <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard panel */}
            <div id="panel-dashboard" className={`panel ${activePanel === 'dashboard' ? 'active' : ''}`}>
              <div className="ptit">Dashboard</div>
              <div className="pdesc">Operational metrics</div>
              <div className="sg sg4">
                <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                  <div className="sc-lbl">7-Day Signups</div>
                  <div className="sc-val">{overviewCounts ? fmt(overviewCounts.newUsersLast7d) : '—'}</div>
                  <div className="sc-meta">New users</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                  <div className="sc-lbl">30-Day Signups</div>
                  <div className="sc-val">{overviewCounts ? fmt(overviewCounts.newUsersLast30d) : '—'}</div>
                  <div className="sc-meta">New users</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Approval Rate</div>
                  <div className="sc-val">
                    {stats && totalApps > 0 ? `${Math.round((stats.approved / totalApps) * 100)}%` : '—'}
                  </div>
                  <div className="sc-meta">All time</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                  <div className="sc-lbl">Pending Verifications</div>
                  <div className="sc-val">{fmt(recentActivity.length)}</div>
                  <div className="sc-meta">Recent activity</div>
                </div>
              </div>
              <div className="g2">
                <div className="card">
                  <div className="ct">Status Distribution</div>
                  <div className="cs">Applications by status</div>
                  <div className="cb cb160" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {stats && (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Approved: {fmt(stats.approved)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Pending: {fmt(stats.pending)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Rejected: {fmt(stats.rejected)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Waitlisted: {fmt(stats.waitlisted)}</span>
                      </>
                    )}
                    {!stats && <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>}
                  </div>
                </div>
                <div className="card">
                  <div className="ct">Threads & Messages</div>
                  <div className="cs">From overview counts</div>
                  <div className="cb cb160" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>Threads: {overviewCounts ? fmt(overviewCounts.totalThreadCount) : '—'}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>Messages: {overviewCounts ? fmt(overviewCounts.totalMessageCount) : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholder panels - Applications, Users, etc. wired in follow-up */}
            {activePanel !== 'overview' && activePanel !== 'dashboard' && (
              <div id={`panel-${activePanel}`} className="panel active">
                <div className="ptit">{PANEL_LABELS[activePanel]}</div>
                <div className="pdesc">Uses existing backend APIs; full table and actions can be wired next.</div>
                <div className="te">
                  <div className="tei">📋</div>
                  Panel &quot;{PANEL_LABELS[activePanel]}&quot; — data loading and actions (e.g. approve/reject, claim, resolve) will use the same API routes as the current admin.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="tw">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'ok' ? 'ok' : t.type === 'err' ? 'err' : ''}`}>
            {t.type === 'ok' ? '✅ ' : t.type === 'err' ? '⚠ ' : 'ℹ '}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
