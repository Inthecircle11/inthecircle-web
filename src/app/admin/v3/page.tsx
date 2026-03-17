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
  if (!s) return 'just now'
  const t = new Date(s).getTime()
  if (Number.isNaN(t)) return 'just now'
  const diff = (Date.now() - t) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ApplicationRow {
  id: string
  user_id: string
  name: string
  username: string
  email: string
  niche: string | null
  status: string
  application_date: string | null
  referrer_username: string | null
  updated_at?: string | null
  profile_image_url?: string | null
  account_type?: string | null
}

const APPLICATIONS_PAGE_SIZE = 20
const USERS_PAGE_SIZE = 20
const APP_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'waitlisted', label: 'Waitlisted' },
] as const

interface UserRow {
  id: string
  name: string | null
  username: string | null
  email: string | null
  profile_image_url: string | null
  is_verified: boolean
  is_banned: boolean
  created_at: string | null
  niche?: string | null
}

interface VerificationRequestRow {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  requested_at: string
}

interface ReportRow {
  id: string
  status: string
  created_at: string
  reporter_username?: string | null
  reported_username?: string | null
  assigned_to?: string | null
  updated_at?: string | null
  [k: string]: unknown
}

interface DataRequestRow {
  id: string
  user_id: string
  status: string
  request_type?: string
  created_at: string
  username?: string | null
  name?: string | null
  updated_at?: string | null
  [k: string]: unknown
}

interface EscalationRow {
  id: string
  metric_name: string
  metric_value: number
  threshold_level: string
  status: string
  created_at: string
  [k: string]: unknown
}

interface ApprovalRequestRow {
  id: string
  status: string
  requested_at: string
  [k: string]: unknown
}

interface AuditEntryRow {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  admin_email: string | null
  created_at: string
  details?: unknown
  [k: string]: unknown
}

interface ComplianceControlRow {
  control_code: string
  status: string
  score: number
  last_checked_at: string
  notes: string | null
}

interface AnalyticsOverview {
  overview?: { dau?: number; wau?: number; mau?: number; stickiness?: number; avgSessionDurationSeconds?: number; sessionsPerUser?: number; inactiveUsers7d?: number }
  insights?: Array<{ type?: string; severity?: string; title?: string; description?: string; recommendation?: string }>
  _meta?: { days?: number }
  [k: string]: unknown
}

interface InboxThreadRow {
  id: string
  user1_id: string | null
  user2_id: string | null
  updated_at: string
  [k: string]: unknown
}

interface InboxMessageRow {
  id: string
  thread_id: string
  sender_id: string
  content: string | null
  created_at: string
  [k: string]: unknown
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

  // Applications tab
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsPage, setApplicationsPage] = useState(1)
  const [applicationsTotal, setApplicationsTotal] = useState(0)
  const [appFilter, setAppFilter] = useState('')
  const [appSearch, setAppSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [userActionId, setUserActionId] = useState<string | null>(null)

  // Verifications, Reports, Data Requests, Risk, Approvals
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRow[]>([])
  const [verificationsLoading, setVerificationsLoading] = useState(false)
  const [verificationActionId, setVerificationActionId] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [dataRequests, setDataRequests] = useState<DataRequestRow[]>([])
  const [dataRequestsLoading, setDataRequestsLoading] = useState(false)
  const [dataRequestActionId, setDataRequestActionId] = useState<string | null>(null)
  const [riskData, setRiskData] = useState<{
    pending_applications?: number
    pending_reports?: number
    overdue_data_requests?: number
    open_escalations?: EscalationRow[]
    last_escalation_time?: string | null
  } | null>(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [escalationActionId, setEscalationActionId] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequestRow[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)

  // Audit Log
  const [auditEntries, setAuditEntries] = useState<AuditEntryRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditAction, setAuditAction] = useState('')
  const [auditTargetType, setAuditTargetType] = useState('')
  const [auditOffset, setAuditOffset] = useState(0)
  const AUDIT_PAGE_SIZE = 50

  // Compliance
  const [complianceHealth, setComplianceHealth] = useState<{ overall_score: number | null; controls: ComplianceControlRow[]; last_checked_at: string | null } | null>(null)
  const [complianceControls, setComplianceControls] = useState<Array<{ id: string; framework: string; control_code: string; control_description: string | null; evidence_source: string | null }>>([])
  const [complianceLoading, setComplianceLoading] = useState(false)

  // Product Analytics
  const [analyticsData, setAnalyticsData] = useState<AnalyticsOverview | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Settings (config)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  // Inbox
  const [inboxThreads, setInboxThreads] = useState<Array<{ id: string; user1: string; user2: string; lastMessage: string; lastAt: string }>>([])
  const [inboxLoading, setInboxLoading] = useState(false)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' | 'info' = 'info') => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  // Debug: surface unhandled promise rejections (RPC/auth/fetch errors)
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const reason = e?.reason
      const msg = reason?.message ?? (typeof reason === 'string' ? reason : JSON.stringify(reason ?? ''))
      console.error('[Admin] Unhandled promise rejection:', reason)
      if (msg && (msg.includes('rpc') || msg.includes('auth') || msg.includes('fetch') || msg.includes('Failed'))) {
        showToast(`Error: ${String(msg).slice(0, 80)}`, 'err')
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [showToast])

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
    // loadOverview is defined below; omit to avoid "used before declaration"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ overall_score?: number | null }>(res, json)
      if (typeof data?.overall_score === 'number') setGovernanceScore(data.overall_score)
      else setGovernanceScore(null)
    } catch {
      setGovernanceScore(null)
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    loadRecentActivity()
    loadReportsCount()
    loadGovernanceScore()
  }, [authorized, loadRecentActivity, loadReportsCount, loadGovernanceScore])

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(applicationsPage))
      params.set('limit', String(APPLICATIONS_PAGE_SIZE))
      if (appFilter) params.set('status', appFilter)
      if (appSearch.trim()) params.set('search', appSearch.trim())
      const res = await fetch(`/api/admin/applications?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ applications?: ApplicationRow[]; total?: number; counts?: Stats }>(res, json)
      if (data?.applications) {
        setApplications(data.applications)
        setApplicationsTotal(typeof data.total === 'number' ? data.total : data.applications.length)
        if (data.counts) setStats(data.counts)
      } else {
        setApplications([])
        setApplicationsTotal(0)
      }
      if (!res.ok && res.status === 403) setError('You do not have permission to view applications.')
    } catch {
      setApplications([])
      setError('Failed to load applications.')
    }
    setApplicationsLoading(false)
  }, [applicationsPage, appFilter, appSearch])

  useEffect(() => {
    if (!authorized || activePanel !== 'applications') return
    loadApplications()
  }, [authorized, activePanel, loadApplications])

  const doAppAction = useCallback(
    async (applicationId: string, action: 'approve' | 'reject' | 'waitlist', updated_at?: string | null) => {
      setActionLoadingId(applicationId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/applications/${applicationId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, updated_at: updated_at ?? undefined }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) {
          setError(err)
          showToast(err, 'err')
        } else if (res.ok) {
          showToast(action === 'approve' ? 'Application approved' : action === 'reject' ? 'Application rejected' : 'Application waitlisted', 'ok')
          void loadApplications()
          void loadOverview()
        } else if (res.status === 409) {
          const msg = 'Record changed by another moderator. Refresh and try again.'
          setError(msg)
          showToast(msg, 'err')
        }
      } catch {
        setError('Request failed')
        showToast('Request failed', 'err')
      }
      setActionLoadingId(null)
    },
    [loadApplications, loadOverview, showToast]
  )

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users?page=${usersPage}&limit=${USERS_PAGE_SIZE}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ users?: UserRow[]; total?: number }>(res, json)
      if (data?.users) {
        setUsers(data.users)
        setUsersTotal(typeof data.total === 'number' ? data.total : data.users.length)
      } else {
        setUsers([])
        setUsersTotal(0)
      }
      if (!res.ok && res.status === 403) setError('You do not have permission to view users.')
    } catch {
      setUsers([])
      setError('Failed to load users.')
    }
    setUsersLoading(false)
  }, [usersPage])

  useEffect(() => {
    if (!authorized || activePanel !== 'users') return
    loadUsers()
  }, [authorized, activePanel, loadUsers])

  const doUserVerification = useCallback(
    async (userId: string, isVerified: boolean) => {
      setUserActionId(userId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ is_verified: !isVerified }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) {
          setError(err)
          showToast(err, 'err')
        } else if (res.ok) {
          showToast(isVerified ? 'User unverified' : 'User verified', 'ok')
          void loadUsers()
          void loadOverview()
        }
      } catch {
        setError('Request failed')
        showToast('Request failed', 'err')
      }
      setUserActionId(null)
    },
    [loadUsers, loadOverview, showToast]
  )

  const doUserBan = useCallback(
    async (userId: string, isBanned: boolean) => {
      setUserActionId(userId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ banned: !isBanned }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) {
          setError(err)
          showToast(err, 'err')
        } else if (res.ok) {
          showToast(isBanned ? 'User unbanned' : 'User banned', isBanned ? 'ok' : 'err')
          void loadUsers()
        }
      } catch {
        setError('Request failed')
        showToast('Request failed', 'err')
      }
      setUserActionId(null)
    },
    [loadUsers, showToast]
  )

  const loadVerifications = useCallback(async () => {
    setVerificationsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/verification-requests?status=pending', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ requests?: VerificationRequestRow[] }>(res, json)
      setVerificationRequests(data?.requests ?? [])
    } catch {
      setVerificationRequests([])
    }
    setVerificationsLoading(false)
  }, [])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reports?status=pending&sort=overdue&filter=all', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ reports?: ReportRow[] }>(res, json)
      setReports(data?.reports ?? [])
    } catch {
      setReports([])
    }
    setReportsLoading(false)
  }, [])

  const loadDataRequests = useCallback(async () => {
    setDataRequestsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/data-requests', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ requests?: DataRequestRow[] }>(res, json)
      setDataRequests(data?.requests ?? [])
    } catch {
      setDataRequests([])
    }
    setDataRequestsLoading(false)
  }, [])

  const loadRisk = useCallback(async () => {
    setRiskLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/risk', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{
        pending_applications?: number
        pending_reports?: number
        overdue_data_requests?: number
        open_escalations?: EscalationRow[]
        last_escalation_time?: string | null
      }>(res, json)
      setRiskData(data ?? null)
    } catch {
      setRiskData(null)
    }
    setRiskLoading(false)
  }, [])

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/approvals?status=pending', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ requests?: ApprovalRequestRow[] }>(res, json)
      setApprovals(data?.requests ?? [])
    } catch {
      setApprovals([])
    }
    setApprovalsLoading(false)
  }, [])

  useEffect(() => {
    if (!authorized || activePanel !== 'verifications') return
    loadVerifications()
  }, [authorized, activePanel, loadVerifications])

  useEffect(() => {
    if (!authorized || activePanel !== 'reports') return
    loadReports()
  }, [authorized, activePanel, loadReports])

  useEffect(() => {
    if (!authorized || activePanel !== 'data-requests') return
    loadDataRequests()
  }, [authorized, activePanel, loadDataRequests])

  const doDataRequestStatus = useCallback(
    async (requestId: string, status: 'pending' | 'completed' | 'failed', updated_at?: string | null) => {
      setDataRequestActionId(requestId)
      setError(null)
      try {
        const res = await fetch('/api/admin/data-requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ request_id: requestId, status, updated_at: updated_at ?? undefined }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast(`Status set to ${status}`, 'ok')
          void loadDataRequests()
        } else if (res.status === 409) setError('Record changed. Refresh and try again.')
      } catch {
        setError('Request failed')
      }
      setDataRequestActionId(null)
    },
    [loadDataRequests, showToast]
  )

  useEffect(() => {
    if (!authorized || activePanel !== 'risk') return
    loadRisk()
  }, [authorized, activePanel, loadRisk])

  useEffect(() => {
    if (!authorized || activePanel !== 'approvals') return
    loadApprovals()
  }, [authorized, activePanel, loadApprovals])

  const doVerificationApprove = useCallback(
    async (userId: string) => {
      setVerificationActionId(userId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ is_verified: true }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('User verified', 'ok')
          void loadVerifications()
          void loadOverview()
        }
      } catch {
        setError('Request failed')
      }
      setVerificationActionId(null)
    },
    [loadVerifications, loadOverview, showToast]
  )

  const doVerificationReject = useCallback(
    async (requestId: string) => {
      setVerificationActionId(requestId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/verification-requests/${encodeURIComponent(requestId)}/reject`, {
          method: 'POST',
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Verification rejected', 'ok')
          void loadVerifications()
        }
      } catch {
        setError('Request failed')
      }
      setVerificationActionId(null)
    },
    [loadVerifications, showToast]
  )

  const doReportClaim = useCallback(
    async (reportId: string) => {
      setError(null)
      try {
        const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/claim`, { method: 'POST', credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Report claimed', 'ok')
          void loadReports()
        }
      } catch {
        setError('Request failed')
      }
    },
    [loadReports, showToast]
  )

  const doReportRelease = useCallback(
    async (reportId: string) => {
      setError(null)
      try {
        const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/release`, { method: 'POST', credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Report released', 'ok')
          void loadReports()
        }
      } catch {
        setError('Request failed')
      }
    },
    [loadReports, showToast]
  )

  const doReportResolve = useCallback(
    async (reportId: string, status: 'resolved' | 'dismissed', updated_at: string | null | undefined) => {
      if (!updated_at) {
        setError('Cannot resolve: missing updated_at. Refresh and try again.')
        return
      }
      setError(null)
      try {
        const res = await fetch('/api/admin/reports', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ report_id: reportId, status, updated_at }),
        })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast(status === 'resolved' ? 'Report resolved' : 'Report dismissed', 'ok')
          void loadReports()
        } else if (res.status === 409) setError('Record changed. Refresh and try again.')
      } catch {
        setError('Request failed')
      }
    },
    [loadReports, showToast]
  )

  const doEscalationResolve = useCallback(
    async (escalationId: string) => {
      setEscalationActionId(escalationId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/escalations/${encodeURIComponent(escalationId)}/resolve`, { method: 'POST', credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Escalation resolved', 'ok')
          void loadRisk()
        }
      } catch {
        setError('Request failed')
      }
      setEscalationActionId(null)
    },
    [loadRisk, showToast]
  )

  const doApprovalApprove = useCallback(
    async (requestId: string) => {
      setApprovalActionId(requestId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/approvals/${encodeURIComponent(requestId)}/approve`, { method: 'POST', credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Approval granted', 'ok')
          void loadApprovals()
        }
      } catch {
        setError('Request failed')
      }
      setApprovalActionId(null)
    },
    [loadApprovals, showToast]
  )

  const doApprovalReject = useCallback(
    async (requestId: string) => {
      setApprovalActionId(requestId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/approvals/${encodeURIComponent(requestId)}/reject`, { method: 'POST', credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { error: err } = parseAdminResponse(res, json)
        if (err) setError(err)
        else if (res.ok) {
          showToast('Approval rejected', 'ok')
          void loadApprovals()
        }
      } catch {
        setError('Request failed')
      }
      setApprovalActionId(null)
    },
    [loadApprovals, showToast]
  )

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(AUDIT_PAGE_SIZE))
      params.set('offset', String(auditOffset))
      if (auditAction) params.set('action', auditAction)
      if (auditTargetType) params.set('target_type', auditTargetType)
      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ entries?: AuditEntryRow[] }>(res, json)
      setAuditEntries(data?.entries ?? [])
    } catch {
      setAuditEntries([])
    }
    setAuditLoading(false)
  }, [auditOffset, auditAction, auditTargetType])

  const loadCompliance = useCallback(async () => {
    setComplianceLoading(true)
    setError(null)
    try {
      const [healthRes, controlsRes] = await Promise.all([
        fetch('/api/admin/compliance/health', { credentials: 'include' }),
        fetch('/api/admin/compliance/controls', { credentials: 'include' }),
      ])
      const healthJson = await healthRes.json().catch(() => ({}))
      const controlsJson = await controlsRes.json().catch(() => ({}))
      const { data: healthData } = parseAdminResponse<{ overall_score?: number | null; controls?: ComplianceControlRow[]; last_checked_at?: string | null }>(healthRes, healthJson)
      const { data: controlsData } = parseAdminResponse<{ controls?: Array<{ id: string; framework: string; control_code: string; control_description: string | null; evidence_source: string | null }> }>(controlsRes, controlsJson)
      setComplianceHealth(healthData ? { overall_score: healthData.overall_score ?? null, controls: healthData.controls ?? [], last_checked_at: healthData.last_checked_at ?? null } : null)
      setComplianceControls(controlsData?.controls ?? [])
    } catch {
      setComplianceHealth(null)
      setComplianceControls([])
    }
    setComplianceLoading(false)
  }, [])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/analytics/overview?days=30', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<AnalyticsOverview>(res, json)
      setAnalyticsData(data ?? null)
    } catch {
      setAnalyticsData(null)
    }
    setAnalyticsLoading(false)
  }, [])

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<Record<string, string>>(res, json)
      setConfig(data ?? {})
    } catch {
      setConfig({})
    }
    setConfigLoading(false)
  }, [])

  const saveConfig = useCallback(async (updates: Record<string, string>) => {
    setConfigSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      const json = await res.json().catch(() => ({}))
      const { error: err } = parseAdminResponse(res, json)
      if (err) setError(err)
      else if (res.ok) {
        showToast('Settings saved', 'ok')
        setConfig((c) => ({ ...c, ...updates }))
      }
    } catch {
      setError('Request failed')
    }
    setConfigSaving(false)
  }, [showToast])

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select('id, user1_id, user2_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (threadsError) throw threadsError
      if (!threads?.length) {
        setInboxThreads([])
        setInboxLoading(false)
        return
      }
      const threadIds = (threads as InboxThreadRow[]).map((t) => t.id)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, thread_id, sender_id, content, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
      if (messagesError) throw messagesError
      const messagesList = (messages ?? []) as InboxMessageRow[]
      const userIds = new Set<string>()
      ;(threads as InboxThreadRow[]).forEach((t) => {
        if (t.user1_id) userIds.add(t.user1_id)
        if (t.user2_id) userIds.add(t.user2_id)
      })
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, name')
        .in('id', Array.from(userIds))
      const profileMap: Record<string, { name: string; username: string }> = {}
      ;(profiles ?? []).forEach((p: { id: string; name: string | null; username: string | null }) => {
        profileMap[p.id] = { name: p.name ?? p.username ?? '?', username: p.username ?? '?' }
      })
      const messagesByThread: Record<string, InboxMessageRow[]> = {}
      messagesList.forEach((m) => {
        if (!messagesByThread[m.thread_id]) messagesByThread[m.thread_id] = []
        messagesByThread[m.thread_id].push(m)
      })
      const list = (threads as InboxThreadRow[]).map((t) => {
        const u1 = t.user1_id ? profileMap[t.user1_id] : null
        const u2 = t.user2_id ? profileMap[t.user2_id] : null
        const last = messagesByThread[t.id]?.[0]
        return {
          id: t.id,
          user1: u1 ? `${u1.name} (@${u1.username})` : '?',
          user2: u2 ? `${u2.name} (@${u2.username})` : '?',
          lastMessage: last?.content?.slice(0, 80) ?? (last ? '📷' : '—'),
          lastAt: last?.created_at ?? t.updated_at,
        }
      })
      setInboxThreads(list)
    } catch {
      setInboxThreads([])
    }
    setInboxLoading(false)
  }, [])

  useEffect(() => {
    if (!authorized || activePanel !== 'audit-log') return
    loadAudit()
  }, [authorized, activePanel, loadAudit])

  useEffect(() => {
    if (!authorized || activePanel !== 'compliance') return
    loadCompliance()
  }, [authorized, activePanel, loadCompliance])

  useEffect(() => {
    if (!authorized || activePanel !== 'analytics') return
    loadAnalytics()
  }, [authorized, activePanel, loadAnalytics])

  useEffect(() => {
    if (!authorized || activePanel !== 'settings') return
    loadConfig()
  }, [authorized, activePanel, loadConfig])

  useEffect(() => {
    if (!authorized || activePanel !== 'inbox') return
    loadInbox()
  }, [authorized, activePanel, loadInbox])

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
    if (activePanel === 'applications') void loadApplications()
    if (activePanel === 'users') void loadUsers()
    if (activePanel === 'verifications') void loadVerifications()
    if (activePanel === 'reports') void loadReports()
    if (activePanel === 'data-requests') void loadDataRequests()
    if (activePanel === 'risk') void loadRisk()
    if (activePanel === 'approvals') void loadApprovals()
    if (activePanel === 'audit-log') void loadAudit()
    if (activePanel === 'compliance') void loadCompliance()
    if (activePanel === 'analytics') void loadAnalytics()
    if (activePanel === 'settings') void loadConfig()
    if (activePanel === 'inbox') void loadInbox()
    setLastUpd(new Date())
  }, [activePanel, loadOverview, loadApplications, loadUsers, loadVerifications, loadReports, loadDataRequests, loadRisk, loadApprovals, loadAudit, loadCompliance, loadAnalytics, loadConfig, loadInbox])

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
              <span style={{ color: 'var(--t2)', fontSize: '11.5px' }}>Governance</span>
              <span className={`dot ${governanceScore != null && governanceScore >= 70 ? 'ok' : governanceScore != null ? 'warn' : ''}`} />
            </div>
            {governanceScore != null && (
              <div className="sh-r" style={{ marginBottom: 0 }}>
                <span style={{ color: 'var(--t2)', fontSize: '11.5px' }}>{governanceScore} / 100</span>
              </div>
            )}
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
              <span className="hupd" id="hupd">{lastUpd ? `Updated ${relT(lastUpd.toISOString())}` : 'Not synced'}</span>
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

            {/* Applications panel */}
            <div id="panel-applications" className={`panel ${activePanel === 'applications' ? 'active' : ''}`}>
              <div className="ptit">Applications</div>
              <div className="pdesc">Review, approve, reject or waitlist applicants</div>
              <div className="tc">
                <div className="tch">
                  <div className="tct">All Applications</div>
                  <div className="tca">
                    <input
                      className="inp"
                      style={{ width: 200 }}
                      type="text"
                      placeholder="Search name or email…"
                      value={appSearch}
                      onChange={(e) => { setAppSearch(e.target.value); setApplicationsPage(1) }}
                      onBlur={() => authorized && activePanel === 'applications' && loadApplications()}
                    />
                    <select
                      className="sel"
                      value={appFilter}
                      onChange={(e) => { setAppFilter(e.target.value); setApplicationsPage(1) }}
                    >
                      {APP_FILTER_OPTIONS.map((o) => (
                        <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-gh bsm" onClick={() => loadApplications()} disabled={applicationsLoading}>
                      {applicationsLoading ? '…' : '↻'} Apply
                    </button>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Type</th>
                      <th>Niche</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th>Referrer</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicationsLoading && applications.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="te">Loading…</div>
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="te"><div className="tei">📋</div>No applications found.</div>
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => {
                        const rawStatus = (app.status || 'pending').toLowerCase()
                        const st = rawStatus === 'active' ? 'approved' : rawStatus
                        const isPending = ['pending', 'submitted', 'pending_review', 'draft'].includes(rawStatus)
                        const isApproved = st === 'approved'
                        const isRejected = st === 'rejected'
                        const isWaitlisted = st === 'waitlisted'
                        const name = app.name || app.username || '?'
                        const accountType = (app.account_type || (app as { type?: string }).type || '').toLowerCase()
                        return (
                          <tr key={app.id}>
                            <td>
                              <div className="tdp">
                                {app.profile_image_url ? (
                                  <>
                                    <img
                                      src={app.profile_image_url}
                                      alt={name[0]}
                                      style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                      onError={(e) => {
                                        const t = e.currentTarget
                                        t.style.display = 'none'
                                        const next = t.nextElementSibling as HTMLElement
                                        if (next) next.style.display = 'flex'
                                      }}
                                    />
                                    <div className="av" style={{ display: 'none' }}>{name[0]?.toUpperCase() || '?'}</div>
                                  </>
                                ) : (
                                  <div className="av">{name[0]?.toUpperCase() || '?'}</div>
                                )}
                                <div>
                                  <div className="tdn">{app.name || app.username || '—'}</div>
                                  <div className="tds">{app.email || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--t3)' }}>
                              {accountType ? (
                                <span className={`badge ${accountType === 'brand' ? 'ba' : 'bp'}`}>{accountType === 'brand' ? 'brand' : 'creator'}</span>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--t3)' }}>{app.niche || '—'}</td>
                            <td>
                              <span className={`badge ${isApproved ? 'ba' : isRejected ? 'br' : isWaitlisted ? 'bw' : 'bp'}`}>
                                {st}
                              </span>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(app.application_date)}</td>
                            <td style={{ fontSize: 11, color: 'var(--t3)' }}>{app.referrer_username ? `@${app.referrer_username}` : '—'}</td>
                            <td>
                              <div className="ag">
                                {!isApproved && (
                                  <button
                                    type="button"
                                    className="btn btn-ok bsm bic"
                                    title="Approve"
                                    disabled={actionLoadingId !== null}
                                    onClick={() => doAppAction(app.id, 'approve', app.updated_at)}
                                  >
                                    ✓
                                  </button>
                                )}
                                {!isRejected && (
                                  <button
                                    type="button"
                                    className="btn btn-er bsm bic"
                                    title="Reject"
                                    disabled={actionLoadingId !== null}
                                    onClick={() => doAppAction(app.id, 'reject', app.updated_at)}
                                  >
                                    ✕
                                  </button>
                                )}
                                {!isWaitlisted && (
                                  <button
                                    type="button"
                                    className="btn btn-wa bsm bic"
                                    title="Waitlist"
                                    disabled={actionLoadingId !== null}
                                    onClick={() => doAppAction(app.id, 'waitlist', app.updated_at)}
                                  >
                                    ⏳
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                <div className="tpg">
                  <div className="tpgi">
                    {applicationsTotal > 0
                      ? `${applications.length} of ${fmt(applicationsTotal)} · page ${applicationsPage}`
                      : '—'}
                  </div>
                  <div className="tpgb">
                    <button
                      type="button"
                      className="btn btn-gh bsm"
                      onClick={() => setApplicationsPage((p) => Math.max(1, p - 1))}
                      disabled={applicationsPage <= 1 || applicationsLoading}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className="btn btn-gh bsm"
                      onClick={() => setApplicationsPage((p) => p + 1)}
                      disabled={applications.length < APPLICATIONS_PAGE_SIZE || applicationsLoading}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Users panel */}
            {activePanel === 'users' && (
              <div id="panel-users" className="panel active">
                <div className="ptit">Users</div>
                <div className="pdesc">Manage members: verify, ban, view.</div>
                {usersLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading users…</div>
                ) : (
                  <>
                    <div className="admin-v3-table-wrap">
                      <table className="admin-v3-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Verified</th>
                            <th>Banned</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="admin-v3-muted">No users found.</td>
                            </tr>
                          ) : (
                            users.map((u) => {
                              const uName = u.name ?? u.username ?? u.email ?? u.id
                              const initial = (typeof uName === 'string' ? uName[0] : '?')?.toUpperCase() || '?'
                              return (
                              <tr key={u.id}>
                                <td>
                                  <div className="tdp">
                                    {u.profile_image_url ? (
                                      <>
                                        <img
                                          src={u.profile_image_url}
                                          alt={initial}
                                          style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                          onError={(e) => {
                                            const t = e.currentTarget
                                            t.style.display = 'none'
                                            const next = t.nextElementSibling as HTMLElement
                                            if (next) next.style.display = 'flex'
                                          }}
                                        />
                                        <div className="av" style={{ display: 'none' }}>{initial}</div>
                                      </>
                                    ) : (
                                      <div className="av">{initial}</div>
                                    )}
                                    <div>
                                      <div className="tdn">{u.name ?? u.username ?? '—'}</div>
                                      <div className="tds">{u.email ?? '—'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>{u.username ?? '—'}</td>
                                <td>{u.email ?? '—'}</td>
                                <td>{u.is_verified ? 'Yes' : 'No'}</td>
                                <td>{u.is_banned ? 'Yes' : 'No'}</td>
                                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="admin-v3-btn admin-v3-btn-sm"
                                    disabled={!!userActionId}
                                    onClick={() => doUserVerification(u.id, u.is_verified)}
                                    title={u.is_verified ? 'Unverify' : 'Verify'}
                                  >
                                    {userActionId === u.id ? '…' : u.is_verified ? 'Unverify' : 'Verify'}
                                  </button>
                                  {' '}
                                  <button
                                    type="button"
                                    className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger"
                                    disabled={!!userActionId}
                                    onClick={() => doUserBan(u.id, u.is_banned)}
                                    title={u.is_banned ? 'Unban' : 'Ban'}
                                  >
                                    {userActionId === u.id ? '…' : u.is_banned ? 'Unban' : 'Ban'}
                                  </button>
                                </td>
                              </tr>
                            )})
                          )}
                        </tbody>
                        </table>
                    </div>
                    {usersTotal > USERS_PAGE_SIZE && (
                      <div className="admin-v3-pagination">
                        <button
                          type="button"
                          className="admin-v3-btn admin-v3-btn-sm"
                          disabled={usersPage <= 1 || usersLoading}
                          onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </button>
                        <span className="admin-v3-muted">
                          Page {usersPage} of {Math.ceil(usersTotal / USERS_PAGE_SIZE) || 1}
                        </span>
                        <button
                          type="button"
                          className="admin-v3-btn admin-v3-btn-sm"
                          disabled={usersPage >= Math.ceil(usersTotal / USERS_PAGE_SIZE) || usersLoading}
                          onClick={() => setUsersPage((p) => p + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Verifications panel */}
            {activePanel === 'verifications' && (
              <div id="panel-verifications" className="panel active">
                <div className="ptit">Verifications</div>
                <div className="pdesc">Pending verification requests — approve or reject.</div>
                {verificationsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : verificationRequests.length === 0 ? (
                  <div className="te"><div className="tei">✅</div>No pending verification requests.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>User</th><th>Requested</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {verificationRequests.map((r) => (
                          <tr key={r.id}>
                            <td>{r.username || r.user_id}</td>
                            <td>{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={!!verificationActionId} onClick={() => doVerificationApprove(r.user_id)}>
                                {verificationActionId === r.user_id ? '…' : 'Approve'}
                              </button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger" disabled={!!verificationActionId} onClick={() => doVerificationReject(r.id)}>
                                {verificationActionId === r.id ? '…' : 'Reject'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Reports panel */}
            {activePanel === 'reports' && (
              <div id="panel-reports" className="panel active">
                <div className="ptit">Reports</div>
                <div className="pdesc">User reports — claim, release, or resolve.</div>
                {reportsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : reports.length === 0 ? (
                  <div className="te"><div className="tei">📬</div>No pending reports.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>Reporter</th><th>Reported</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {reports.map((r) => (
                          <tr key={r.id}>
                            <td>{r.reporter_username ?? '—'}</td>
                            <td>{r.reported_username ?? '—'}</td>
                            <td>{r.status}</td>
                            <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={reportsLoading} onClick={() => doReportClaim(r.id)}>Claim</button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={reportsLoading} onClick={() => doReportRelease(r.id)}>Release</button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={reportsLoading} onClick={() => doReportResolve(r.id, 'resolved', r.updated_at)}>Resolve</button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger" disabled={reportsLoading} onClick={() => doReportResolve(r.id, 'dismissed', r.updated_at)}>Dismiss</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Data Requests panel */}
            {activePanel === 'data-requests' && (
              <div id="panel-data-requests" className="panel active">
                <div className="ptit">Data Requests</div>
                <div className="pdesc">GDPR/data requests — view and update status.</div>
                {dataRequestsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : dataRequests.length === 0 ? (
                  <div className="te"><div className="tei">📋</div>No data requests.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>User</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {dataRequests.map((r) => (
                          <tr key={r.id}>
                            <td>{r.username ?? r.name ?? r.user_id}</td>
                            <td>{r.request_type ?? '—'}</td>
                            <td>{r.status}</td>
                            <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                            <td>
                              {r.status === 'pending' && (
                                <>
                                  <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={!!dataRequestActionId} onClick={() => doDataRequestStatus(r.id, 'completed', r.updated_at)}>
                                    {dataRequestActionId === r.id ? '…' : 'Complete'}
                                  </button>
                                  {' '}
                                  <button type="button" className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger" disabled={!!dataRequestActionId} onClick={() => doDataRequestStatus(r.id, 'failed', r.updated_at)}>
                                    {dataRequestActionId === r.id ? '…' : 'Fail'}
                                  </button>
                                </>
                              )}
                              {r.status !== 'pending' && '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Risk panel */}
            {activePanel === 'risk' && (
              <div id="panel-risk" className="panel active">
                <div className="ptit">Risk</div>
                <div className="pdesc">KPIs and open escalations.</div>
                {riskLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : !riskData ? (
                  <div className="te"><div className="tei">⚠</div>Failed to load risk data.</div>
                ) : (
                  <>
                    <div className="sg sg4">
                      <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                        <div className="sc-lbl">Pending Applications</div>
                        <div className="sc-val">{riskData.pending_applications ?? 0}</div>
                      </div>
                      <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                        <div className="sc-lbl">Pending Reports</div>
                        <div className="sc-val">{riskData.pending_reports ?? 0}</div>
                      </div>
                      <div className="sc" style={{ ['--c' as string]: 'var(--err)' }}>
                        <div className="sc-lbl">Overdue Data Requests</div>
                        <div className="sc-val">{riskData.overdue_data_requests ?? 0}</div>
                      </div>
                      <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                        <div className="sc-lbl">Last escalation</div>
                        <div className="sc-val">{riskData.last_escalation_time ? new Date(riskData.last_escalation_time).toLocaleDateString() : '—'}</div>
                      </div>
                    </div>
                    {(riskData.open_escalations?.length ?? 0) > 0 && (
                      <div className="admin-v3-table-wrap" style={{ marginTop: '1rem' }}>
                        <table className="admin-v3-table">
                          <thead>
                            <tr><th>Metric</th><th>Value</th><th>Level</th><th>Created</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {(riskData.open_escalations ?? []).map((e) => (
                              <tr key={e.id}>
                                <td>{e.metric_name}</td>
                                <td>{e.metric_value}</td>
                                <td>{e.threshold_level}</td>
                                <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                                <td>
                                  <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={!!escalationActionId} onClick={() => doEscalationResolve(e.id)}>
                                    {escalationActionId === e.id ? '…' : 'Resolve'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Approvals panel */}
            {activePanel === 'approvals' && (
              <div id="panel-approvals" className="panel active">
                <div className="ptit">Approvals</div>
                <div className="pdesc">Admin approval requests — approve or reject.</div>
                {approvalsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : approvals.length === 0 ? (
                  <div className="te"><div className="tei">✅</div>No pending approval requests.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>ID</th><th>Status</th><th>Requested</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {approvals.map((r) => (
                          <tr key={r.id}>
                            <td>{r.id}</td>
                            <td>{r.status}</td>
                            <td>{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={!!approvalActionId} onClick={() => doApprovalApprove(r.id)}>
                                {approvalActionId === r.id ? '…' : 'Approve'}
                              </button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger" disabled={!!approvalActionId} onClick={() => doApprovalReject(r.id)}>
                                {approvalActionId === r.id ? '…' : 'Reject'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Audit Log panel */}
            {activePanel === 'audit-log' && (
              <div id="panel-audit-log" className="panel active">
                <div className="ptit">Audit Log</div>
                <div className="pdesc">Admin actions — filter and export.</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Action filter"
                    className="admin-v3-input"
                    value={auditAction}
                    onChange={(e) => setAuditAction(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <input
                    type="text"
                    placeholder="Target type"
                    className="admin-v3-input"
                    value={auditTargetType}
                    onChange={(e) => setAuditTargetType(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                  <button type="button" className="admin-v3-btn admin-v3-btn-sm" onClick={() => { setAuditOffset(0); void loadAudit(); }}>Apply</button>
                  <a href={`/api/admin/audit?format=csv&limit=500${auditAction ? `&action=${encodeURIComponent(auditAction)}` : ''}${auditTargetType ? `&target_type=${encodeURIComponent(auditTargetType)}` : ''}`} className="admin-v3-btn admin-v3-btn-sm" style={{ marginLeft: 'auto' }} target="_blank" rel="noopener noreferrer">Export CSV</a>
                </div>
                {auditLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : auditEntries.length === 0 ? (
                  <div className="te"><div className="tei">📋</div>No audit entries.</div>
                ) : (
                  <>
                    <div className="admin-v3-table-wrap">
                      <table className="admin-v3-table">
                        <thead>
                          <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr>
                        </thead>
                        <tbody>
                          {auditEntries.map((e) => (
                            <tr key={e.id}>
                              <td style={{ fontSize: 11 }}>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                              <td>{e.admin_email ?? '—'}</td>
                              <td>{e.action}</td>
                              <td>{e.target_type && e.target_id ? `${e.target_type}: ${e.target_id}` : (e.target_type ?? '—')}</td>
                              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.details != null ? JSON.stringify(e.details).slice(0, 80) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="admin-v3-pagination">
                      <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={auditOffset <= 0 || auditLoading} onClick={() => setAuditOffset((o) => Math.max(0, o - AUDIT_PAGE_SIZE))}>Previous</button>
                      <span className="admin-v3-muted">Offset {auditOffset}</span>
                      <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={auditEntries.length < AUDIT_PAGE_SIZE || auditLoading} onClick={() => setAuditOffset((o) => o + AUDIT_PAGE_SIZE)}>Next</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Compliance panel */}
            {activePanel === 'compliance' && (
              <div id="panel-compliance" className="panel active">
                <div className="ptit">Compliance</div>
                <div className="pdesc">Control health and framework.</div>
                {complianceLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : (
                  <>
                    {complianceHealth && (
                      <div className="sg sg4" style={{ marginBottom: '1rem' }}>
                        <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                          <div className="sc-lbl">Overall score</div>
                          <div className="sc-val">{complianceHealth.overall_score ?? '—'}</div>
                        </div>
                        <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                          <div className="sc-lbl">Last checked</div>
                          <div className="sc-val">{complianceHealth.last_checked_at ? new Date(complianceHealth.last_checked_at).toLocaleString() : '—'}</div>
                        </div>
                      </div>
                    )}
                    <div className="admin-v3-table-wrap">
                      <table className="admin-v3-table">
                        <thead>
                          <tr><th>Control</th><th>Status</th><th>Score</th><th>Last checked</th></tr>
                        </thead>
                        <tbody>
                          {(complianceHealth?.controls ?? []).map((c) => (
                            <tr key={c.control_code}>
                              <td>{c.control_code}</td>
                              <td>{c.status}</td>
                              <td>{c.score}</td>
                              <td>{c.last_checked_at ? new Date(c.last_checked_at).toLocaleString() : '—'}</td>
                            </tr>
                          ))}
                          {(!complianceHealth?.controls?.length) && complianceControls.length > 0 && complianceControls.map((c) => (
                            <tr key={c.id}><td>{c.control_code}</td><td>—</td><td>—</td><td>—</td></tr>
                          ))}
                          {(!complianceHealth?.controls?.length) && !complianceControls.length && (
                            <tr><td colSpan={4} className="admin-v3-muted">No controls.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Product Analytics panel */}
            {activePanel === 'analytics' && (
              <div id="panel-analytics" className="panel active">
                <div className="ptit">Product Analytics</div>
                <div className="pdesc">DAU/WAU/MAU, stickiness, insights.</div>
                {analyticsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : !analyticsData ? (
                  <div className="te"><div className="tei">📊</div>Failed to load analytics.</div>
                ) : (
                  <>
                    {analyticsData.overview && (
                      <div className="sg sg4">
                        <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                          <div className="sc-lbl">DAU</div>
                          <div className="sc-val">{fmt(analyticsData.overview.dau)}</div>
                        </div>
                        <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                          <div className="sc-lbl">WAU</div>
                          <div className="sc-val">{fmt(analyticsData.overview.wau)}</div>
                        </div>
                        <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                          <div className="sc-lbl">MAU</div>
                          <div className="sc-val">{fmt(analyticsData.overview.mau)}</div>
                        </div>
                        <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                          <div className="sc-lbl">Stickiness</div>
                          <div className="sc-val">{analyticsData.overview.stickiness != null ? `${Number(analyticsData.overview.stickiness).toFixed(2)}` : '—'}</div>
                        </div>
                      </div>
                    )}
                    {(analyticsData.insights?.length ?? 0) > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div className="ptit" style={{ fontSize: 14 }}>Insights</div>
                        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                          {(analyticsData.insights ?? []).slice(0, 10).map((ins, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                              <strong>{ins.title ?? 'Insight'}</strong> — {ins.description ?? ''} {ins.recommendation ? `Recommendation: ${ins.recommendation}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Settings panel */}
            {activePanel === 'settings' && (
              <div id="panel-settings" className="panel active">
                <div className="ptit">Settings</div>
                <div className="pdesc">App config — signups, verification, maintenance.</div>
                {configLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : (
                  <div style={{ maxWidth: 400 }}>
                    {['signups_open', 'verification_requests_open', 'maintenance_mode', 'maintenance_banner'].map((key) => (
                      <div key={key} style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>{key.replace(/_/g, ' ')}</label>
                        {key === 'maintenance_banner' ? (
                          <input
                            type="text"
                            className="admin-v3-input"
                            value={config[key] ?? ''}
                            onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        ) : (
                          <select
                            className="admin-v3-input"
                            value={config[key] ?? 'false'}
                            onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                            style={{ minWidth: 120 }}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        )}
                      </div>
                    ))}
                    <button type="button" className="admin-v3-btn" disabled={configSaving} onClick={() => saveConfig({
                      signups_open: config.signups_open ?? 'false',
                      verification_requests_open: config.verification_requests_open ?? 'false',
                      maintenance_mode: config.maintenance_mode ?? 'false',
                      maintenance_banner: config.maintenance_banner ?? '',
                    })}>
                      {configSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inbox panel */}
            {activePanel === 'inbox' && (
              <div id="panel-inbox" className="panel active">
                <div className="ptit">Inbox</div>
                <div className="pdesc">Message threads across the platform.</div>
                {inboxLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : inboxThreads.length === 0 ? (
                  <div className="te"><div className="tei">📬</div>No conversations.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>Participants</th><th>Last message</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {inboxThreads.map((t) => (
                          <tr key={t.id}>
                            <td>{t.user1} ↔ {t.user2}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.lastMessage}</td>
                            <td style={{ fontSize: 11 }}>{t.lastAt ? new Date(t.lastAt).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Invite Creator panel - no API, informational */}
            {activePanel === 'invite' && (
              <div id="panel-invite" className="panel active">
                <div className="ptit">Invite Creator</div>
                <div className="pdesc">Share invite links or use the main app to onboard creators.</div>
                <div className="te">
                  <div className="tei">✉️</div>
                  Use the main app or waitlist flow to invite creators. Direct invite API can be added here if needed.
                </div>
              </div>
            )}

            {/* Fallback placeholder - should not hit if all panels above are covered */}
            {activePanel !== 'overview' && activePanel !== 'dashboard' && activePanel !== 'applications' && activePanel !== 'users' && activePanel !== 'verifications' && activePanel !== 'reports' && activePanel !== 'data-requests' && activePanel !== 'risk' && activePanel !== 'approvals' && activePanel !== 'audit-log' && activePanel !== 'compliance' && activePanel !== 'analytics' && activePanel !== 'settings' && activePanel !== 'inbox' && activePanel !== 'invite' && (
              <div id={`panel-${activePanel}`} className="panel active">
                <div className="ptit">{PANEL_LABELS[activePanel]}</div>
                <div className="pdesc">Panel not implemented.</div>
                <div className="te"><div className="tei">📋</div>Unknown panel.</div>
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
