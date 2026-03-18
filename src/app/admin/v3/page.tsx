'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { parseAdminResponse } from '@/lib/admin-client'
import { getAdminBase } from '@/lib/admin'
import './admin-v3.css'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList
} from 'recharts'

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

interface OverviewStats {
  total_applications: number
  approved: number
  pending: number
  rejected: number
  waitlisted: number
  suspended: number
  verified_members: number
  active_today: number
  concurrent_now: number
  open_reports: number
  signups_7d: number
  signups_30d: number
  approval_rate: number
  connections_total: number
  pending_approvals: number
  pending_verifications: number
}

interface TrendPoint {
  date: string
  total: number
  approved: number
  rejected: number
}

interface MonthlyPoint {
  month: string
  total: number
  approved: number
}

interface NichePoint {
  niche: string
  count: number
}

interface AccountTypePoint {
  type: string
  count: number
}

interface ActivityItem {
  id: string
  action: string
  target: string
  admin_email: string
  created_at: string
}

interface ActiveUsersData {
  concurrent_now: number
  active_this_hour: number
  active_today: number
  recent_users: Array<{ id: string; name: string | null; username: string | null; last_activity: string }>
  cached_at: string
}

interface ActiveUser {
  user_id: string
  last_seen: string
  full_name: string | null
  username: string | null
  profile_image_url: string | null
  niche: string | null
  account_type: string | null
  location: string | null
  minutes_ago: number
}

// Country flag utility functions
function getCountryFlag(location: string | null | undefined): string {
  if (!location) return ''

  const loc = location.toLowerCase()

  const countryMap: Record<string, string> = {
    // UAE variants
    'uae': 'AE', 'united arab emirates': 'AE', 'dubai': 'AE',
    'abu dhabi': 'AE', 'sharjah': 'AE', 'ajman': 'AE',
    // Saudi Arabia
    'saudi': 'SA', 'saudi arabia': 'SA', 'riyadh': 'SA',
    'jeddah': 'SA', 'mecca': 'SA', 'medina': 'SA',
    // Egypt
    'egypt': 'EG', 'cairo': 'EG', 'alexandria': 'EG',
    // UK
    'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB',
    'london': 'GB', 'manchester': 'GB', 'birmingham': 'GB',
    'scotland': 'GB', 'wales': 'GB',
    // USA
    'usa': 'US', 'united states': 'US', 'us': 'US',
    'new york': 'US', 'los angeles': 'US', 'california': 'US',
    'texas': 'US', 'florida': 'US', 'ca': 'US',
    // Qatar
    'qatar': 'QA', 'doha': 'QA',
    // Kuwait
    'kuwait': 'KW', 'kuwait city': 'KW',
    // Jordan
    'jordan': 'JO', 'amman': 'JO',
    // Lebanon
    'lebanon': 'LB', 'beirut': 'LB',
    // Bahrain
    'bahrain': 'BH', 'manama': 'BH',
    // Oman
    'oman': 'OM', 'muscat': 'OM',
    // Sri Lanka
    'sri lanka': 'LK', 'colombo': 'LK',
    // Poland
    'poland': 'PL', 'warsaw': 'PL',
    // Italy
    'italy': 'IT', 'italia': 'IT', 'milan': 'IT', 'milano': 'IT',
    'rome': 'IT', 'roma': 'IT',
    // Germany
    'germany': 'DE', 'berlin': 'DE', 'munich': 'DE',
    // France
    'france': 'FR', 'paris': 'FR',
    // Canada
    'canada': 'CA', 'toronto': 'CA', 'vancouver': 'CA',
    // Australia
    'australia': 'AU', 'sydney': 'AU', 'melbourne': 'AU',
    // India
    'india': 'IN', 'mumbai': 'IN', 'delhi': 'IN',
    'bangalore': 'IN', 'chennai': 'IN',
    // Pakistan
    'pakistan': 'PK', 'karachi': 'PK', 'lahore': 'PK',
    // Turkey
    'turkey': 'TR', 'istanbul': 'TR', 'ankara': 'TR',
    // Morocco
    'morocco': 'MA', 'casablanca': 'MA', 'rabat': 'MA',
    // Nigeria
    'nigeria': 'NG', 'lagos': 'NG', 'abuja': 'NG',
    // South Africa
    'south africa': 'ZA', 'cape town': 'ZA',
    'johannesburg': 'ZA',
  }

  // Try to match against each key in the map
  // Check from longest match to shortest to avoid 'us' matching 'australia'
  const sortedKeys = Object.keys(countryMap).sort((a, b) => b.length - a.length)
  
  for (const key of sortedKeys) {
    if (loc.includes(key)) {
      const isoCode = countryMap[key]
      return isoToFlag(isoCode)
    }
  }

  return ''
}

function isoToFlag(isoCode: string): string {
  // Convert ISO 3166-1 alpha-2 code to flag emoji
  // Each letter becomes a regional indicator symbol
  return isoCode
    .toUpperCase()
    .split('')
    .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('')
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
  location?: string | null
}

const APPLICATIONS_PAGE_SIZE = 20
const USERS_PAGE_SIZE = 20
const APP_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'waitlist', label: 'Waitlisted' },
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
  location?: string | null
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
  is_overdue?: boolean
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
  daily_signups?: Array<{ date: string; count: number }>
  dow_activity?: Array<{ day: string; count: number }>
  featureUsage?: Array<{ feature_name: string; event_name: string; unique_users: number; total_events: number }>
  funnelApp?: Array<{ step_index: number; step_event_name: string; unique_users: number; conversion_rate_from_previous_step?: number | null }>
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
  const [overviewDateRange, setOverviewDateRange] = useState('30')
  const [dashboardDateRange, setDashboardDateRange] = useState('30')

  // Applications tab
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsPage, setApplicationsPage] = useState(1)
  const [applicationsTotal, setApplicationsTotal] = useState(0)
  const [appFilter, setAppFilter] = useState('')
  const [appSearch, setAppSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [userActionId, setUserActionId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const userSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Verifications, Reports, Data Requests, Risk, Approvals
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRow[]>([])
  const [verificationsLoading, setVerificationsLoading] = useState(false)
  const [verificationActionId, setVerificationActionId] = useState<string | null>(null)
  const [verificationsSearch, setVerificationsSearch] = useState('')
  const [reports, setReports] = useState<ReportRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsSearch, setReportsSearch] = useState('')
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsTotal, setReportsTotal] = useState(0)
  const [reportsExportLoading, setReportsExportLoading] = useState(false)
  const reportsSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const REPORTS_PAGE_SIZE = 50
  const [dataRequests, setDataRequests] = useState<DataRequestRow[]>([])
  const [dataRequestsLoading, setDataRequestsLoading] = useState(false)
  const [dataRequestActionId, setDataRequestActionId] = useState<string | null>(null)
  const [dataRequestsStatusFilter, setDataRequestsStatusFilter] = useState('all')
  const [dataRequestsTypeFilter, setDataRequestsTypeFilter] = useState('all')
  const [dataRequestsPage, setDataRequestsPage] = useState(1)
  const [dataRequestsTotal, setDataRequestsTotal] = useState(0)
  const [dataRequestsExportLoading, setDataRequestsExportLoading] = useState(false)
  const DATA_REQUESTS_PAGE_SIZE = 50
  const [riskData, setRiskData] = useState<{
    pending_applications?: number
    pending_reports?: number
    overdue_data_requests?: number
    open_escalations?: EscalationRow[]
    last_escalation_time?: string | null
  } | null>(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [escalationActionId, setEscalationActionId] = useState<string | null>(null)
  const [riskLevelFilter, setRiskLevelFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [riskLastUpdated, setRiskLastUpdated] = useState<Date | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequestRow[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)
  const [approvalsFilter, setApprovalsFilter] = useState<'all' | 'active' | 'expired'>('all')

  // Audit Log
  const [auditEntries, setAuditEntries] = useState<AuditEntryRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditAction, setAuditAction] = useState('')
  const [auditTargetType, setAuditTargetType] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const AUDIT_PAGE_SIZE = 50

  // Compliance
  const [complianceHealth, setComplianceHealth] = useState<{ overall_score: number | null; controls: ComplianceControlRow[]; last_checked_at: string | null } | null>(null)
  const [complianceControls, setComplianceControls] = useState<Array<{ id: string; framework: string; control_code: string; control_description: string | null; evidence_source: string | null }>>([])
  const [complianceLoading, setComplianceLoading] = useState(false)

  // Product Analytics
  const [analyticsData, setAnalyticsData] = useState<AnalyticsOverview | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30')

  // Chart data states
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null)
  const [overviewStatsLoading, setOverviewStatsLoading] = useState(false)
  const [overviewStatsError, setOverviewStatsError] = useState<string | null>(null)
  const [overviewStatsCachedAt, setOverviewStatsCachedAt] = useState<string | null>(null)
  
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trendCachedAt, setTrendCachedAt] = useState<string | null>(null)
  
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyError, setMonthlyError] = useState<string | null>(null)
  const [monthlyCachedAt, setMonthlyCachedAt] = useState<string | null>(null)
  
  const [nicheData, setNicheData] = useState<NichePoint[]>([])
  const [nicheLoading, setNicheLoading] = useState(false)
  const [nicheError, setNicheError] = useState<string | null>(null)
  const [nicheCachedAt, setNicheCachedAt] = useState<string | null>(null)
  
  const [accountTypeData, setAccountTypeData] = useState<AccountTypePoint[]>([])
  const [accountTypeLoading, setAccountTypeLoading] = useState(false)
  const [accountTypeError, setAccountTypeError] = useState<string | null>(null)
  const [accountTypeCachedAt, setAccountTypeCachedAt] = useState<string | null>(null)
  
  const [geoData, setGeoData] = useState<Array<{ location: string; count: number }>>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [activityFeedLoading, setActivityFeedLoading] = useState(false)
  const [activityFeedError, setActivityFeedError] = useState<string | null>(null)

  // Active users
  const [activeUsersData, setActiveUsersData] = useState<{
    concurrent: number
    active_hour: number
    active_today: number
    users: ActiveUser[]
  } | null>(null)
  const [activeUsersLoading, setActiveUsersLoading] = useState(true)
  const [activeUsersWindow, setActiveUsersWindow] = useState(5)
  const [activeUsersFetchedAt, setActiveUsersFetchedAt] = useState<string | null>(null)

  // Settings (config)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  // Inbox
  const [inboxThreads, setInboxThreads] = useState<Array<{ id: string; user1: string; user2: string; lastMessage: string; lastAt: string }>>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxUnreadOnly, setInboxUnreadOnly] = useState(false)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' | 'info' = 'info') => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => {
      requestAnimationFrame(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      })
    }, 3800)
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
        setError('Session expired. Please sign in again.')
        try {
          await createClient().auth.signOut({ scope: 'local' })
        } catch {
          // ignore sign-out errors (e.g. already invalid session)
        }
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
          requestAnimationFrame(() => {
            void loadApplications()
            void loadOverview()
          })
        } else if (res.status === 409) {
          const msg = 'Record changed by another moderator. Refresh and try again.'
          setError(msg)
          showToast(msg, 'err')
        }
      } catch {
        setError('Request failed')
        showToast('Request failed', 'err')
      }
      requestAnimationFrame(() => setActionLoadingId(null))
    },
    [loadApplications, loadOverview, showToast]
  )

  const doBulkAction = useCallback(
    async (action: 'approve' | 'reject' | 'waitlist') => {
      if (selectedAppIds.size === 0) return
      const actionLabel = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'waitlist'
      if (!confirm(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} ${selectedAppIds.size} application(s)?`)) return
      
      setBulkActionLoading(true)
      setError(null)
      let successCount = 0
      let failCount = 0
      
      for (const appId of Array.from(selectedAppIds)) {
        try {
          const app = applications.find(a => a.id === appId)
          const res = await fetch(`/api/admin/applications/${appId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, updated_at: app?.updated_at ?? undefined }),
          })
          if (res.ok) successCount++
          else failCount++
        } catch {
          failCount++
        }
      }
      
      setBulkActionLoading(false)
      setSelectedAppIds(new Set())
      
      if (successCount > 0) {
        showToast(`${successCount} application(s) ${actionLabel}ed`, 'ok')
        void loadApplications()
        void loadOverview()
      }
      if (failCount > 0) {
        showToast(`${failCount} application(s) failed`, 'err')
      }
    },
    [selectedAppIds, applications, loadApplications, loadOverview, showToast]
  )

  const toggleSelectAll = useCallback(() => {
    const pendingApps = applications.filter(app => {
      const rawStatus = (app.status || 'pending').toLowerCase()
      return ['pending', 'submitted', 'pending_review', 'draft'].includes(rawStatus)
    })
    if (selectedAppIds.size === pendingApps.length) {
      setSelectedAppIds(new Set())
    } else {
      setSelectedAppIds(new Set(pendingApps.map(a => a.id)))
    }
  }, [applications, selectedAppIds.size])

  const toggleSelectApp = useCallback((appId: string) => {
    setSelectedAppIds(prev => {
      const next = new Set(prev)
      if (next.has(appId)) next.delete(appId)
      else next.add(appId)
      return next
    })
  }, [])

  const exportApplicationsPage = useCallback(() => {
    const rows = applications.map(app => ({
      id: app.id,
      full_name: app.name,
      email: app.email,
      account_type: app.account_type || '',
      niche: app.niche || '',
      status: app.status,
      created_at: app.application_date || '',
      referrer_username: app.referrer_username || '',
    }))
    const headers = ['id', 'full_name', 'email', 'account_type', 'niche', 'status', 'created_at', 'referrer_username']
    const csvRows = rows.map(r => headers.map(h => {
      const val = r[h as keyof typeof r]
      const s = String(val ?? '')
      const needsQuotes = /[",\n\r]/.test(s)
      return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s
    }))
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `applications-page-${applicationsPage}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    showToast('Page exported', 'ok')
  }, [applications, applicationsPage, showToast])

  const exportApplicationsFiltered = useCallback(async () => {
    setExportLoading(true)
    try {
      const params = new URLSearchParams()
      if (appFilter) params.set('status', appFilter)
      if (appSearch.trim()) params.set('search', appSearch.trim())
      const res = await fetch(`/api/admin/applications/export?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        showToast('Export failed', 'err')
        setExportLoading(false)
        return
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `applications-filtered-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      showToast('Export complete', 'ok')
    } catch {
      showToast('Export failed', 'err')
    }
    setExportLoading(false)
  }, [appFilter, appSearch, showToast])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(usersPage))
      params.set('limit', String(USERS_PAGE_SIZE))
      if (userSearch.trim()) params.set('search', userSearch.trim())
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include' })
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
  }, [usersPage, userSearch])

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
      const params = new URLSearchParams()
      params.set('status', 'pending')
      params.set('sort', 'overdue')
      params.set('filter', 'all')
      params.set('page', String(reportsPage))
      params.set('limit', String(REPORTS_PAGE_SIZE))
      if (reportsSearch.trim()) params.set('search', reportsSearch.trim())
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ reports?: ReportRow[]; total?: number }>(res, json)
      setReports(data?.reports ?? [])
      setReportsTotal(typeof data?.total === 'number' ? data.total : (data?.reports?.length ?? 0))
    } catch {
      setReports([])
      setReportsTotal(0)
    }
    setReportsLoading(false)
  }, [reportsPage, reportsSearch])

  const loadDataRequests = useCallback(async () => {
    setDataRequestsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(dataRequestsPage))
      params.set('limit', String(DATA_REQUESTS_PAGE_SIZE))
      if (dataRequestsStatusFilter !== 'all') params.set('status', dataRequestsStatusFilter)
      if (dataRequestsTypeFilter !== 'all') params.set('type', dataRequestsTypeFilter)
      const res = await fetch(`/api/admin/data-requests?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ requests?: DataRequestRow[]; total?: number }>(res, json)
      setDataRequests(data?.requests ?? [])
      setDataRequestsTotal(typeof data?.total === 'number' ? data.total : (data?.requests?.length ?? 0))
    } catch {
      setDataRequests([])
      setDataRequestsTotal(0)
    }
    setDataRequestsLoading(false)
  }, [dataRequestsPage, dataRequestsStatusFilter, dataRequestsTypeFilter])

  const exportDataRequests = useCallback(async () => {
    setDataRequestsExportLoading(true)
    try {
      const params = new URLSearchParams()
      if (dataRequestsStatusFilter !== 'all') params.set('status', dataRequestsStatusFilter)
      if (dataRequestsTypeFilter !== 'all') params.set('type', dataRequestsTypeFilter)
      const res = await fetch(`/api/admin/data-requests/export?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        showToast('Export failed', 'err')
        setDataRequestsExportLoading(false)
        return
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `data-requests-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      showToast('Export complete', 'ok')
    } catch {
      showToast('Export failed', 'err')
    }
    setDataRequestsExportLoading(false)
  }, [dataRequestsStatusFilter, dataRequestsTypeFilter, showToast])

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
      setRiskLastUpdated(new Date())
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
    const interval = setInterval(() => {
      if (activePanel === 'approvals') void loadApprovals()
    }, 60000)
    return () => clearInterval(interval)
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

  const exportReports = useCallback(async () => {
    setReportsExportLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'pending')
      if (reportsSearch.trim()) params.set('search', reportsSearch.trim())
      const res = await fetch(`/api/admin/reports/export?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        showToast('Export failed', 'err')
        setReportsExportLoading(false)
        return
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      showToast('Export complete', 'ok')
    } catch {
      showToast('Export failed', 'err')
    }
    setReportsExportLoading(false)
  }, [reportsSearch, showToast])

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
      params.set('page', String(auditPage))
      params.set('limit', String(AUDIT_PAGE_SIZE))
      if (auditAction) params.set('action', auditAction)
      if (auditTargetType) params.set('target_type', auditTargetType)
      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<{ entries?: AuditEntryRow[]; total?: number }>(res, json)
      setAuditEntries(data?.entries ?? [])
      setAuditTotal(typeof data?.total === 'number' ? data.total : (data?.entries?.length ?? 0))
    } catch {
      setAuditEntries([])
      setAuditTotal(0)
    }
    setAuditLoading(false)
  }, [auditPage, auditAction, auditTargetType])

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
      const days = analyticsDateRange === 'all' ? '365' : analyticsDateRange
      const res = await fetch(`/api/admin/analytics/overview?days=${days}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data } = parseAdminResponse<AnalyticsOverview>(res, json)
      setAnalyticsData(data ?? null)
    } catch {
      setAnalyticsData(null)
    }
    setAnalyticsLoading(false)
  }, [analyticsDateRange])

  const loadOverviewStats = useCallback(async () => {
    setOverviewStatsLoading(true)
    setOverviewStatsError(null)
    try {
      const res = await fetch('/api/admin/overview-stats', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setOverviewStats(json.data)
      setOverviewStatsCachedAt(json.cached_at || null)
    } catch (e: any) {
      setOverviewStatsError(e.message)
    } finally {
      setOverviewStatsLoading(false)
    }
  }, [])

  const loadTrendData = useCallback(async (days = 14) => {
    setTrendLoading(true)
    setTrendError(null)
    try {
      const res = await fetch(`/api/admin/stats/trend?days=${days}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setTrendData(json.data || [])
      setTrendCachedAt(json.cached_at || null)
    } catch (e: any) {
      setTrendError(e.message)
    } finally {
      setTrendLoading(false)
    }
  }, [])

  const loadMonthlyData = useCallback(async (months = 6) => {
    setMonthlyLoading(true)
    setMonthlyError(null)
    try {
      const res = await fetch(`/api/admin/stats/monthly?months=${months}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMonthlyData(json.data || [])
      setMonthlyCachedAt(json.cached_at || null)
    } catch (e: any) {
      setMonthlyError(e.message)
    } finally {
      setMonthlyLoading(false)
    }
  }, [])

  const loadNicheData = useCallback(async () => {
    setNicheLoading(true)
    setNicheError(null)
    try {
      const res = await fetch('/api/admin/stats/niches', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setNicheData(json.data || [])
      setNicheCachedAt(json.cached_at || null)
    } catch (e: any) {
      setNicheError(e.message)
    } finally {
      setNicheLoading(false)
    }
  }, [])

  const loadAccountTypeData = useCallback(async () => {
    setAccountTypeLoading(true)
    setAccountTypeError(null)
    try {
      const res = await fetch('/api/admin/stats/account-types', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setAccountTypeData(json.data || [])
      setAccountTypeCachedAt(json.cached_at || null)
    } catch (e: any) {
      setAccountTypeError(e.message)
    } finally {
      setAccountTypeLoading(false)
    }
  }, [])

  const loadGeoData = useCallback(async () => {
    setGeoLoading(true)
    setGeoError(null)
    try {
      const res = await fetch('/api/admin/stats/geo', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setGeoData(json.data || [])
    } catch (e: any) {
      setGeoError(e.message)
    } finally {
      setGeoLoading(false)
    }
  }, [])

  const loadActivityFeed = useCallback(async () => {
    setActivityFeedLoading(true)
    setActivityFeedError(null)
    try {
      const res = await fetch('/api/admin/audit?limit=10', { credentials: 'include' })
      const json = await res.json()
      const { data } = parseAdminResponse<{ entries?: any[] }>(res, json)
      const entries = data?.entries || []
      setActivityFeed(entries.map((e: any) => ({
        id: e.id,
        action: e.action,
        target: e.target_type,
        admin_email: e.admin_email || 'System',
        created_at: e.created_at,
      })))
    } catch (e: any) {
      setActivityFeedError(e.message)
    } finally {
      setActivityFeedLoading(false)
    }
  }, [])

  const loadActiveUsers = useCallback(async (window = 5) => {
    setActiveUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/active-users?window=${window}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setActiveUsersData(json.data)
      setActiveUsersFetchedAt(json.fetched_at)
    } catch (e: any) {
      console.error('Failed to load active users:', e.message)
    } finally {
      setActiveUsersLoading(false)
    }
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

  useEffect(() => {
    if (!authorized) return
    if (activePanel === 'overview') {
      loadOverviewStats()
      loadTrendData(14)
      loadActivityFeed()
      loadActiveUsers(activeUsersWindow)
    }
    if (activePanel === 'dashboard') {
      loadOverviewStats()
      loadTrendData(30)
      loadMonthlyData(6)
      loadAccountTypeData()
    }
    if (activePanel === 'analytics') {
      loadNicheData()
      loadGeoData()
    }
  }, [authorized, activePanel, loadOverviewStats, loadTrendData, loadMonthlyData, loadAccountTypeData, loadNicheData, loadGeoData, loadActivityFeed, loadActiveUsers, activeUsersWindow])

  // Auto-refresh active users every 30 seconds when on Overview panel
  useEffect(() => {
    if (!authorized || activePanel !== 'overview') return
    const interval = setInterval(() => loadActiveUsers(activeUsersWindow), 30000)
    return () => clearInterval(interval)
  }, [authorized, activePanel, activeUsersWindow, loadActiveUsers])

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
    if (activePanel === 'overview') {
      void loadOverview()
      void loadOverviewStats()
      void loadTrendData(14)
      void loadActivityFeed()
    }
    if (activePanel === 'dashboard') {
      void loadOverviewStats()
      void loadTrendData(30)
      void loadMonthlyData(6)
      void loadAccountTypeData()
    }
    if (activePanel === 'analytics') {
      void loadAnalytics()
      void loadNicheData()
    }
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
  }, [activePanel, loadOverview, loadOverviewStats, loadTrendData, loadMonthlyData, loadAccountTypeData, loadNicheData, loadActivityFeed, loadApplications, loadUsers, loadVerifications, loadReports, loadDataRequests, loadRisk, loadApprovals, loadAudit, loadCompliance, loadAnalytics, loadConfig, loadInbox])

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

  const isStale = lastUpd && (Date.now() - lastUpd.getTime() > 5 * 60 * 1000)

  function ChartCard({
    title,
    subtitle,
    children,
    loading,
    error,
    onRetry,
    cachedAt,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
    loading: boolean
    error: string | null
    onRetry: () => void
    cachedAt?: string | null
  }) {
    return (
      <div className="bg-[#13161D] border border-[#252A38] rounded-[18px] p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[13px] font-bold text-[#EEF0F8]">{title}</div>
            {subtitle && <div className="text-[11px] text-[#4A5270] mt-0.5">{subtitle}</div>}
          </div>
          {cachedAt && (
            <div className="text-[10px] text-[#4A5270]">
              Cached {relT(cachedAt)}
            </div>
          )}
        </div>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-[#1C2030] rounded w-3/4"></div>
            <div className="h-32 bg-[#1C2030] rounded"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="text-[12px] text-[#EF4444]">Failed to load</div>
            <button onClick={onRetry} className="text-[11px] text-[#6366F1] underline">
              Retry
            </button>
          </div>
        ) : children}
      </div>
    )
  }

  return (
    <div className="admin-v3">
      <a
        href="#ct"
        style={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 999,
          padding: '8px 16px',
          background: 'var(--ap)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 4,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px'
          e.currentTarget.style.top = '16px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px'
        }}
      >
        Skip to main content
      </a>
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
          {isStale && (
            <div style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '12px 16px',
              borderBottom: '1px solid #fbbf24',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>⚠️</span>
              <span>Data may be stale — click Refresh</span>
              <button type="button" className="btn btn-gh bsm" onClick={refreshCurrent} style={{ marginLeft: 'auto' }}>
                Refresh
              </button>
            </div>
          )}
          <div id="ct">
            {/* Overview panel */}
            <div id="panel-overview" className={`panel ${activePanel === 'overview' ? 'active' : ''}`}>
              <div className="ptit">Overview</div>
              <div className="pdesc">Real-time health snapshot and key metrics</div>
              
              {/* Row 1: KPI Cards */}
              <div className="sg sg4" style={{ marginBottom: 16 }}>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap)', cursor: 'pointer' }} onClick={() => nav('applications')}>
                  <div className="sc-lbl">Total Applications</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.total_applications) : '—'}</div>
                  <div className="sc-meta">View all →</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)', cursor: 'pointer' }} onClick={() => nav('users')}>
                  <div className="sc-lbl">Approved Members</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.approved) : '—'}</div>
                  <div className="sc-meta">View all →</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)', cursor: 'pointer' }} onClick={() => { nav('applications'); setAppFilter('pending'); }}>
                  <div className="sc-lbl">Pending Review</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.pending) : '—'}</div>
                  <div className="sc-meta">View pending →</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Active Today</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.active_today) : '—'}</div>
                  <div className="sc-meta">
                    <span className="text-[11px] text-[#10B981] font-600">
                      {overviewStats?.concurrent_now ?? 0} online now
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: KPI Cards */}
              <div className="sg sg4" style={{ marginBottom: 24 }}>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Verified Members</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.verified_members) : '—'}</div>
                  <div className="sc-meta" />
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)', cursor: 'pointer' }} onClick={() => nav('reports')}>
                  <div className="sc-lbl">Open Reports</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.open_reports) : '—'}</div>
                  <div className="sc-meta">View all →</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                  <div className="sc-lbl">7-Day Signups</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.signups_7d) : '—'}</div>
                  <div className="sc-meta">Applications</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                  <div className="sc-lbl">Approval Rate</div>
                  <div className="sc-val">{overviewStats ? `${overviewStats.approval_rate}%` : '—'}</div>
                  <div className="sc-meta">All time</div>
                </div>
              </div>

              {/* Live User Activity */}
              <div className="bg-[#13161D] border border-[#252A38] rounded-[18px] p-5 mb-6">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[13px] font-bold text-[#EEF0F8]">
                      Live User Activity
                    </div>
                    <div className="text-[11px] text-[#4A5270] mt-0.5">
                      Real-time presence from user_presence table
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Auto-refresh indicator */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                      <span className="text-[11px] text-[#4A5270]">Live</span>
                    </div>
                    {/* Window selector */}
                    <select
                      value={activeUsersWindow}
                      onChange={e => {
                        const w = parseInt(e.target.value)
                        setActiveUsersWindow(w)
                        loadActiveUsers(w)
                      }}
                      className="bg-[#1C2030] border border-[#2E3448] text-[#8892AA]
                        text-[11px] rounded-lg px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value={5}>Last 5 min</option>
                      <option value={60}>Last 1 hour</option>
                      <option value={1440}>Last 24 hours</option>
                    </select>
                  </div>
                </div>

                {/* 3 count stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#1C2030] rounded-xl p-3 text-center">
                    <div className="text-[22px] font-bold text-[#EEF0F8]">
                      {activeUsersData?.concurrent ?? '—'}
                    </div>
                    <div className="text-[10px] text-[#4A5270] mt-1">Concurrent Now</div>
                    <div className="text-[10px] text-[#10B981] mt-0.5">last 5 min</div>
                  </div>
                  <div className="bg-[#1C2030] rounded-xl p-3 text-center">
                    <div className="text-[22px] font-bold text-[#EEF0F8]">
                      {activeUsersData?.active_hour ?? '—'}
                    </div>
                    <div className="text-[10px] text-[#4A5270] mt-1">Active This Hour</div>
                    <div className="text-[10px] text-[#8892AA] mt-0.5">last 60 min</div>
                  </div>
                  <div className="bg-[#1C2030] rounded-xl p-3 text-center">
                    <div className="text-[22px] font-bold text-[#EEF0F8]">
                      {activeUsersData?.active_today ?? '—'}
                    </div>
                    <div className="text-[10px] text-[#4A5270] mt-1">Active Today</div>
                    <div className="text-[10px] text-[#8892AA] mt-0.5">last 24 hours</div>
                  </div>
                </div>

                {/* User list */}
                {activeUsersLoading ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C2030]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-[#1C2030] rounded w-1/3" />
                          <div className="h-2.5 bg-[#1C2030] rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !activeUsersData?.users?.length ? (
                  <div className="text-center py-6 text-[#4A5270] text-[12px]">
                    No users active in this time window
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {activeUsersData.users.map(user => (
                      <div key={user.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg
                          hover:bg-[#1C2030] transition-colors">
                        
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.full_name || ''}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={e => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br
                              from-[#6366F1] to-[#A78BFA] flex items-center
                              justify-center text-[11px] font-bold text-white">
                              {(user.full_name || user.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          {/* Online dot — only for last 5 min */}
                          {user.minutes_ago < 5 && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5
                              rounded-full bg-[#10B981] border-2 border-[#13161D]" />
                          )}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12.5px] font-600 text-[#EEF0F8] truncate">
                              {user.full_name || user.username || 'Unknown'}
                            </span>
                            {user.location && (
                              <span className="text-[12px]">
                                {getCountryFlag(user.location)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#4A5270] truncate">
                            @{user.username || '—'}
                            {user.niche && ` · ${user.niche}`}
                          </div>
                        </div>

                        {/* Last seen */}
                        <div className="flex-shrink-0 text-right">
                          <div className={`text-[11px] font-600 ${
                            user.minutes_ago < 5 ? 'text-[#10B981]' :
                            user.minutes_ago < 60 ? 'text-[#F59E0B]' :
                            'text-[#4A5270]'
                          }`}>
                            {user.minutes_ago < 1 ? 'Just now' :
                             user.minutes_ago < 60 ? `${user.minutes_ago}m ago` :
                             `${Math.floor(user.minutes_ago / 60)}h ago`}
                          </div>
                          <div className="text-[10px] text-[#4A5270]">
                            {user.account_type || 'user'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                {activeUsersFetchedAt && (
                  <div className="mt-3 pt-3 border-t border-[#252A38] text-[10px]
                    text-[#4A5270] flex items-center justify-between">
                    <span>Auto-refreshes every 30 seconds</span>
                    <span>Updated {new Date(activeUsersFetchedAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              {/* Row 3: Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                <ChartCard
                  title="Application Trend"
                  subtitle="Last 14 days"
                  loading={trendLoading}
                  error={trendError}
                  onRetry={() => loadTrendData(14)}
                  cachedAt={trendCachedAt}
                >
                  {trendData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data available</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252A38" />
                        <XAxis dataKey="date" tick={{ fill: '#8892AA', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#8892AA', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }}
                          labelStyle={{ color: '#EEF0F8' }}
                        />
                        <Line type="monotone" dataKey="total" stroke="#6366F1" strokeWidth={2} dot={false} name="Applications" />
                        <Line type="monotone" dataKey="approved" stroke="#10B981" strokeWidth={2} dot={false} name="Approved" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Application Funnel"
                  subtitle="Current status"
                  loading={overviewStatsLoading}
                  error={overviewStatsError}
                  onRetry={loadOverviewStats}
                  cachedAt={overviewStatsCachedAt}
                >
                  {overviewStats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                      {[
                        { label: 'Total', value: overviewStats.total_applications, color: '#6366F1' },
                        { label: 'Pending', value: overviewStats.pending, color: '#F59E0B' },
                        { label: 'Approved', value: overviewStats.approved, color: '#10B981' },
                        { label: 'Waitlisted', value: overviewStats.waitlisted, color: '#8B5CF6' },
                        { label: 'Rejected', value: overviewStats.rejected, color: '#EF4444' },
                      ].map((item) => {
                        const pct = overviewStats.total_applications > 0 ? (item.value / overviewStats.total_applications) * 100 : 0
                        return (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--t2)', width: 70 }}>{item.label}</div>
                            <div style={{ flex: 1, height: 8, background: '#1C2030', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: item.color, transition: 'width 0.3s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--t2)', width: 50, textAlign: 'right' }}>{fmt(item.value)}</div>
                            <div style={{ fontSize: 10, color: 'var(--t3)', width: 40, textAlign: 'right' }}>{pct.toFixed(0)}%</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ChartCard>
              </div>

              {/* Row 4: Status Donut and Activity Feed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard
                  title="Status Breakdown"
                  subtitle="All-time distribution"
                  loading={overviewStatsLoading}
                  error={overviewStatsError}
                  onRetry={loadOverviewStats}
                  cachedAt={overviewStatsCachedAt}
                >
                  {overviewStats && (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Approved', value: overviewStats.approved, color: '#10B981' },
                            { name: 'Pending', value: overviewStats.pending, color: '#F59E0B' },
                            { name: 'Rejected', value: overviewStats.rejected, color: '#EF4444' },
                            { name: 'Waitlisted', value: overviewStats.waitlisted, color: '#8B5CF6' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {[
                            { name: 'Approved', value: overviewStats.approved, color: '#10B981' },
                            { name: 'Pending', value: overviewStats.pending, color: '#F59E0B' },
                            { name: 'Rejected', value: overviewStats.rejected, color: '#EF4444' },
                            { name: 'Waitlisted', value: overviewStats.waitlisted, color: '#8B5CF6' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Recent Activity"
                  subtitle="Last 10 actions"
                  loading={activityFeedLoading}
                  error={activityFeedError}
                  onRetry={loadActivityFeed}
                >
                  {activityFeed.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No recent activity</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                      {activityFeed.map((item) => {
                        const icon = item.action.includes('approve') ? '✅' : item.action.includes('reject') ? '❌' : item.action.includes('waitlist') ? '⏳' : item.action.includes('ban') ? '🚫' : item.action.includes('verif') ? '🔵' : '📌'
                        return (
                          <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                            <div style={{ fontSize: 14 }}>{icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.action} {item.target}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--t3)' }}>{relT(item.created_at)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ChartCard>
              </div>
            </div>

            {/* Dashboard panel */}
            <div id="panel-dashboard" className={`panel ${activePanel === 'dashboard' ? 'active' : ''}`}>
              <div className="ptit">Dashboard</div>
              <div className="pdesc">Operational metrics and trends</div>
              
              {/* Row 1: Stat cards */}
              <div className="sg sg4" style={{ marginBottom: 16 }}>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                  <div className="sc-lbl">Total</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.total_applications) : '—'}</div>
                  <div className="sc-meta">Applications</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                  <div className="sc-lbl">Approved</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.approved) : '—'}</div>
                  <div className="sc-meta">Members</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                  <div className="sc-lbl">Pending</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.pending) : '—'}</div>
                  <div className="sc-meta">Review</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Active Today</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.active_today) : '—'}</div>
                  <div className="sc-meta">Last 24h</div>
                </div>
              </div>

              <div className="sg sg4" style={{ marginBottom: 24 }}>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap2)' }}>
                  <div className="sc-lbl">Signups 7d</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.signups_7d) : '—'}</div>
                  <div className="sc-meta">Applications</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ap2)' }}>
                  <div className="sc-lbl">Signups 30d</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.signups_30d) : '—'}</div>
                  <div className="sc-meta">Applications</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                  <div className="sc-lbl">Approval Rate</div>
                  <div className="sc-val">{overviewStats ? `${overviewStats.approval_rate}%` : '—'}</div>
                  <div className="sc-meta">All time</div>
                </div>
                <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                  <div className="sc-lbl">Connections</div>
                  <div className="sc-val">{overviewStats ? fmt(overviewStats.connections_total) : '—'}</div>
                  <div className="sc-meta">Total</div>
                </div>
              </div>

              {/* Row 2: Three charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                <ChartCard
                  title="30-Day Signups"
                  subtitle="Daily applications"
                  loading={trendLoading}
                  error={trendError}
                  onRetry={() => loadTrendData(30)}
                  cachedAt={trendCachedAt}
                >
                  {trendData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252A38" />
                        <XAxis dataKey="date" tick={{ fill: '#8892AA', fontSize: 10 }} interval={4} />
                        <YAxis tick={{ fill: '#8892AA', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Bar dataKey="total" fill="#6366F1" radius={[3, 3, 0, 0]} name="Signups" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Status Distribution"
                  subtitle="All applications"
                  loading={overviewStatsLoading}
                  error={overviewStatsError}
                  onRetry={loadOverviewStats}
                  cachedAt={overviewStatsCachedAt}
                >
                  {overviewStats && (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Approved', value: overviewStats.approved, color: '#10B981' },
                            { name: 'Pending', value: overviewStats.pending, color: '#F59E0B' },
                            { name: 'Rejected', value: overviewStats.rejected, color: '#EF4444' },
                            { name: 'Waitlisted', value: overviewStats.waitlisted, color: '#8B5CF6' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {[
                            { name: 'Approved', value: overviewStats.approved, color: '#10B981' },
                            { name: 'Pending', value: overviewStats.pending, color: '#F59E0B' },
                            { name: 'Rejected', value: overviewStats.rejected, color: '#EF4444' },
                            { name: 'Waitlisted', value: overviewStats.waitlisted, color: '#8B5CF6' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Creator vs Brand"
                  subtitle="Account types"
                  loading={accountTypeLoading}
                  error={accountTypeError}
                  onRetry={loadAccountTypeData}
                  cachedAt={accountTypeCachedAt}
                >
                  {accountTypeData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={accountTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="count"
                        >
                          {accountTypeData.map((entry, index) => {
                            const colors: Record<string, string> = { creator: '#6366F1', brand: '#10B981', unknown: '#8892AA' }
                            return <Cell key={`cell-${index}`} fill={colors[entry.type] || '#8892AA'} />
                          })}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* Row 3: Monthly volume and weekly activity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard
                  title="Monthly Volume"
                  subtitle="Last 6 months"
                  loading={monthlyLoading}
                  error={monthlyError}
                  onRetry={() => loadMonthlyData(6)}
                  cachedAt={monthlyCachedAt}
                >
                  {monthlyData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252A38" />
                        <XAxis dataKey="month" tick={{ fill: '#8892AA', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#8892AA', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="total" fill="rgba(99,102,241,0.4)" name="Total" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="approved" fill="#10B981" name="Approved" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Weekly Activity Pattern"
                  subtitle="Day of week distribution"
                  loading={analyticsLoading}
                  error={analyticsData ? null : 'No data'}
                  onRetry={loadAnalytics}
                >
                  {analyticsData?.dow_activity && analyticsData.dow_activity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analyticsData.dow_activity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252A38" />
                        <XAxis dataKey="day" tick={{ fill: '#8892AA', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#8892AA', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Bar dataKey="count" fill="#6366F1" radius={[3, 3, 0, 0]} name="Activity" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No activity data</div>
                  )}
                </ChartCard>
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
                    <button type="button" className="btn btn-gh bsm" onClick={exportApplicationsPage} disabled={applications.length === 0}>
                      Export this page
                    </button>
                    <button type="button" className="btn btn-gh bsm" onClick={exportApplicationsFiltered} disabled={exportLoading}>
                      {exportLoading ? 'Exporting…' : 'Export all filtered'}
                    </button>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedAppIds.size > 0 && selectedAppIds.size === applications.filter(app => {
                            const rawStatus = (app.status || 'pending').toLowerCase()
                            return ['pending', 'submitted', 'pending_review', 'draft'].includes(rawStatus)
                          }).length}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer' }}
                          aria-label="Select all pending applications"
                        />
                      </th>
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
                        <td colSpan={8}>
                          <div className="te">Loading…</div>
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="te"><div className="tei">📋</div>No applications found.</div>
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => {
                        const rawStatus = (app.status || 'pending').toLowerCase()
                        const st = rawStatus
                        const isPending = ['pending', 'submitted', 'pending_review', 'draft'].includes(rawStatus)
                        const isApproved = st === 'approved'
                        const isRejected = st === 'rejected'
                        const isWaitlisted = st === 'waitlist'
                        const name = app.name || app.username || '?'
                        const accountType = (app.account_type || (app as { type?: string }).type || '').toLowerCase()
                        return (
                          <tr key={app.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedAppIds.has(app.id)}
                                onChange={() => toggleSelectApp(app.id)}
                                disabled={!isPending}
                                style={{ cursor: isPending ? 'pointer' : 'not-allowed' }}
                                aria-label={`Select ${name}`}
                              />
                            </td>
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
                                  {app.location && (
                                    <div style={{ fontSize: 10, color: '#4A5270', marginTop: 2 }}>
                                      {getCountryFlag(app.location) && <span style={{ marginRight: 4 }}>{getCountryFlag(app.location)}</span>}
                                      <span>{app.location}</span>
                                    </div>
                                  )}
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
                                {st === 'waitlist' ? 'Waitlist' : st.charAt(0).toUpperCase() + st.slice(1)}
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
                                    aria-label={`Approve ${name}`}
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
                                    aria-label={`Reject ${name}`}
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
                                    aria-label={`Waitlist ${name}`}
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
              {selectedAppIds.size > 0 && (
                <div style={{
                  position: 'sticky',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'var(--card-bg)',
                  borderTop: '1px solid var(--border)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  zIndex: 10,
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {selectedAppIds.size} selected
                  </span>
                  <button
                    type="button"
                    className="btn btn-ok bsm"
                    disabled={bulkActionLoading}
                    onClick={() => doBulkAction('approve')}
                  >
                    {bulkActionLoading ? '...' : 'Approve All'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-er bsm"
                    disabled={bulkActionLoading}
                    onClick={() => doBulkAction('reject')}
                  >
                    {bulkActionLoading ? '...' : 'Reject All'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-wa bsm"
                    disabled={bulkActionLoading}
                    onClick={() => doBulkAction('waitlist')}
                  >
                    {bulkActionLoading ? '...' : 'Waitlist All'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-gh bsm"
                    disabled={bulkActionLoading}
                    onClick={() => setSelectedAppIds(new Set())}
                    style={{ marginLeft: 'auto' }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Users panel */}
            {activePanel === 'users' && (
              <div id="panel-users" className="panel active">
                <div className="ptit">Users</div>
                <div className="pdesc">Manage members: verify, ban, view.</div>
                <div style={{ marginBottom: 16 }}>
                  <input
                    className="inp"
                    style={{ width: 300 }}
                    type="text"
                    placeholder="Search name, username, or email…"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setUsersPage(1)
                      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current)
                      userSearchTimeoutRef.current = setTimeout(() => {
                        if (authorized && activePanel === 'users') void loadUsers()
                      }, 300)
                    }}
                  />
                </div>
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
                                      {u.location && (
                                        <div className="flex items-center gap-1 text-[11px] text-[#4A5270] mt-0.5">
                                          {getCountryFlag(u.location) && <span>{getCountryFlag(u.location)}</span>}
                                          <span>{u.location}</span>
                                        </div>
                                      )}
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
                <div style={{ marginBottom: 16 }}>
                  <input
                    className="inp"
                    style={{ width: 250 }}
                    type="text"
                    placeholder="Search username or email…"
                    value={verificationsSearch}
                    onChange={(e) => setVerificationsSearch(e.target.value)}
                  />
                </div>
                {verificationsLoading ? (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>User</th><th>Requested</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : verificationRequests.filter(r => {
                  if (!verificationsSearch.trim()) return true
                  const searchLower = verificationsSearch.toLowerCase()
                  return (r.username ?? '').toLowerCase().includes(searchLower)
                }).length === 0 ? (
                  <div className="te"><div className="tei">✅</div>No pending verification requests.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>User</th><th>Requested</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {verificationRequests.filter(r => {
                          if (!verificationsSearch.trim()) return true
                          const searchLower = verificationsSearch.toLowerCase()
                          return (r.username ?? '').toLowerCase().includes(searchLower)
                        }).map((r) => (
                          <tr key={r.id}>
                            <td>
                              {r.username || r.user_id}
                              <a
                                href={`/profile/${r.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ marginLeft: 8, fontSize: 11, color: 'var(--ap)' }}
                              >
                                View profile
                              </a>
                            </td>
                            <td>{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={!!verificationActionId} onClick={() => doVerificationApprove(r.user_id)}>
                                {verificationActionId === r.user_id ? '…' : 'Approve'}
                              </button>
                              {' '}
                              <button type="button" className="admin-v3-btn admin-v3-btn-sm admin-v3-btn-danger" disabled={!!verificationActionId} onClick={() => doVerificationReject(r.id)}>
                                {verificationActionId === r.id ? '…' : 'Reject'}
                              </button>
                              {' '}
                              <button
                                type="button"
                                className="admin-v3-btn admin-v3-btn-sm"
                                onClick={() => {
                                  nav('applications')
                                  setAppSearch(r.username ?? '')
                                }}
                              >
                                View application
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <input
                    className="inp"
                    style={{ width: 250 }}
                    type="text"
                    placeholder="Search reporter email or username…"
                    value={reportsSearch}
                    onChange={(e) => {
                      setReportsSearch(e.target.value)
                      setReportsPage(1)
                      if (reportsSearchTimeoutRef.current) clearTimeout(reportsSearchTimeoutRef.current)
                      reportsSearchTimeoutRef.current = setTimeout(() => {
                        if (authorized && activePanel === 'reports') void loadReports()
                      }, 300)
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-gh bsm"
                    onClick={exportReports}
                    disabled={reportsExportLoading}
                  >
                    {reportsExportLoading ? 'Exporting…' : 'Export CSV'}
                  </button>
                </div>
                {reportsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : reports.length === 0 ? (
                  <div className="te"><div className="tei">📬</div>No pending reports.</div>
                ) : (
                  <>
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
                  {reportsTotal > REPORTS_PAGE_SIZE && (
                    <div className="admin-v3-pagination">
                      <button
                        type="button"
                        className="admin-v3-btn admin-v3-btn-sm"
                        disabled={reportsPage <= 1 || reportsLoading}
                        onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="admin-v3-muted">
                        Page {reportsPage} of {Math.ceil(reportsTotal / REPORTS_PAGE_SIZE) || 1} · {fmt(reportsTotal)} total
                      </span>
                      <button
                        type="button"
                        className="admin-v3-btn admin-v3-btn-sm"
                        disabled={reportsPage >= Math.ceil(reportsTotal / REPORTS_PAGE_SIZE) || reportsLoading}
                        onClick={() => setReportsPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  </>
                )}
              </div>
            )}

            {/* Data Requests panel */}
            {activePanel === 'data-requests' && (
              <div id="panel-data-requests" className="panel active">
                <div className="ptit">Data Requests</div>
                <div className="pdesc">GDPR/data requests — view and update status.</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <select
                    className="sel"
                    value={dataRequestsStatusFilter}
                    onChange={(e) => { setDataRequestsStatusFilter(e.target.value); setDataRequestsPage(1); }}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select
                    className="sel"
                    value={dataRequestsTypeFilter}
                    onChange={(e) => { setDataRequestsTypeFilter(e.target.value); setDataRequestsPage(1); }}
                  >
                    <option value="all">All Types</option>
                    <option value="export">Export</option>
                    <option value="deletion">Deletion</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-gh bsm"
                    onClick={exportDataRequests}
                    disabled={dataRequestsExportLoading}
                  >
                    {dataRequestsExportLoading ? 'Exporting…' : 'Export CSV'}
                  </button>
                </div>
                {dataRequestsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : dataRequests.length === 0 ? (
                  <div className="te"><div className="tei">📋</div>No data requests.</div>
                ) : (
                  <>
                    <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>User</th><th>Type</th><th>Status</th><th>Created</th><th>Due Date</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {dataRequests.map((r) => {
                          const createdAt = r.created_at ? new Date(r.created_at) : null
                          const dueDate = createdAt ? new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null
                          const isOverdue = r.is_overdue === true
                          return (
                          <tr key={r.id}>
                            <td>
                              {r.username ?? r.name ?? r.user_id}
                              {isOverdue && <span className="badge br" style={{ marginLeft: 8, fontSize: 10 }}>Overdue</span>}
                            </td>
                            <td>{r.request_type ?? '—'}</td>
                            <td>{r.status}</td>
                            <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                            <td style={{ color: isOverdue ? 'var(--err)' : 'var(--t2)' }}>
                              {dueDate ? `Due ${dueDate.toLocaleDateString()}` : '—'}
                            </td>
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
                        )})}
                      </tbody>
                    </table>
                  </div>
                  {dataRequestsTotal > DATA_REQUESTS_PAGE_SIZE && (
                    <div className="admin-v3-pagination">
                      <button
                        type="button"
                        className="admin-v3-btn admin-v3-btn-sm"
                        disabled={dataRequestsPage <= 1 || dataRequestsLoading}
                        onClick={() => setDataRequestsPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="admin-v3-muted">
                        Page {dataRequestsPage} of {Math.ceil(dataRequestsTotal / DATA_REQUESTS_PAGE_SIZE) || 1} · {fmt(dataRequestsTotal)} total
                      </span>
                      <button
                        type="button"
                        className="admin-v3-btn admin-v3-btn-sm"
                        disabled={dataRequestsPage >= Math.ceil(dataRequestsTotal / DATA_REQUESTS_PAGE_SIZE) || dataRequestsLoading}
                        onClick={() => setDataRequestsPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  </>
                )}
              </div>
            )}

            {/* Risk panel */}
            {activePanel === 'risk' && (
              <div id="panel-risk" className="panel active">
                <div className="ptit">Risk</div>
                <div className="pdesc">KPIs and open escalations.</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  <select
                    className="sel"
                    value={riskLevelFilter}
                    onChange={(e) => setRiskLevelFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')}
                  >
                    <option value="all">All Levels</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button type="button" className="btn btn-gh bsm" onClick={() => void loadRisk()}>
                    Refresh
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 'auto' }}>
                    Last updated: {riskLastUpdated ? relT(riskLastUpdated.toISOString()) : '—'}
                  </span>
                </div>
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
                            <tr><th>Metric</th><th>Value</th><th>Level</th><th>Created</th><th>Links</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {(riskData.open_escalations ?? []).filter(e => {
                              if (riskLevelFilter === 'all') return true
                              return (e.threshold_level ?? '').toLowerCase() === riskLevelFilter
                            }).map((e) => (
                              <tr key={e.id}>
                                <td>{e.metric_name}</td>
                                <td>{e.metric_value}</td>
                                <td>{e.threshold_level}</td>
                                <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="admin-v3-btn admin-v3-btn-sm"
                                    onClick={() => {
                                      nav('audit-log')
                                    }}
                                  >
                                    View in audit log
                                  </button>
                                </td>
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <select
                    className="sel"
                    value={approvalsFilter}
                    onChange={(e) => setApprovalsFilter(e.target.value as 'all' | 'active' | 'expired')}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                {approvalsLoading ? (
                  <div className="te"><div className="tei">⏳</div>Loading…</div>
                ) : approvals.filter(r => {
                  const requestedAt = r.requested_at ? new Date(r.requested_at) : null
                  const isExpired = requestedAt && (Date.now() - requestedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
                  if (approvalsFilter === 'active') return !isExpired
                  if (approvalsFilter === 'expired') return isExpired
                  return true
                }).length === 0 ? (
                  <div className="te"><div className="tei">✅</div>No pending approval requests.</div>
                ) : (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>ID</th><th>Status</th><th>Requested</th><th>Links</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {approvals.filter(r => {
                          const requestedAt = r.requested_at ? new Date(r.requested_at) : null
                          const isExpired = requestedAt && (Date.now() - requestedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
                          if (approvalsFilter === 'active') return !isExpired
                          if (approvalsFilter === 'expired') return isExpired
                          return true
                        }).map((r) => {
                          const requestedAt = r.requested_at ? new Date(r.requested_at) : null
                          const isExpired = requestedAt && (Date.now() - requestedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
                          return (
                          <tr key={r.id}>
                            <td>
                              {r.id.slice(0, 8)}
                              {isExpired && <span className="badge br" style={{ marginLeft: 8, fontSize: 10 }}>Expired</span>}
                            </td>
                            <td>{r.status}</td>
                            <td>{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-v3-btn admin-v3-btn-sm"
                                onClick={() => nav('applications')}
                                style={{ marginRight: 4 }}
                              >
                                View application
                              </button>
                              <button
                                type="button"
                                className="admin-v3-btn admin-v3-btn-sm"
                                onClick={() => nav('users')}
                              >
                                View user
                              </button>
                            </td>
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
                        )})}
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
                  <button type="button" className="admin-v3-btn admin-v3-btn-sm" onClick={() => { setAuditPage(1); void loadAudit(); }}>Apply</button>
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
                      <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={auditPage <= 1 || auditLoading} onClick={() => setAuditPage((p) => Math.max(1, p - 1))}>Previous</button>
                      <span className="admin-v3-muted">
                        Page {auditPage} of {Math.ceil(auditTotal / AUDIT_PAGE_SIZE) || 1} · {fmt(auditTotal)} total
                      </span>
                      <button type="button" className="admin-v3-btn admin-v3-btn-sm" disabled={auditPage >= Math.ceil(auditTotal / AUDIT_PAGE_SIZE) || auditLoading} onClick={() => setAuditPage((p) => p + 1)}>Next</button>
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    className="btn btn-gh bsm"
                    onClick={() => {
                      const csv = [
                        ['Control Code', 'Status', 'Score', 'Last Checked'].join(','),
                        ...(complianceHealth?.controls ?? []).map(c => 
                          [c.control_code, c.status, c.score, c.last_checked_at ?? ''].join(',')
                        )
                      ].join('\r\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const link = document.createElement('a')
                      link.href = URL.createObjectURL(blob)
                      link.download = `compliance-health-${new Date().toISOString().slice(0, 10)}.csv`
                      link.click()
                      showToast('Health report exported', 'ok')
                    }}
                    disabled={!complianceHealth?.controls?.length}
                  >
                    Export health report (CSV)
                  </button>
                  <button
                    type="button"
                    className="btn btn-gh bsm"
                    title="Re-runs the compliance check and attempts to auto-fix issues"
                    aria-label="Repair chain"
                  >
                    Repair chain
                  </button>
                </div>
                {complianceLoading ? (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>Control</th><th>Status</th><th>Score</th><th>Last checked</th></tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                <div className="pdesc">Engagement metrics, trends, and insights</div>
                
                {/* Row 1: Date range selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['7', '30', '90', 'all'].map((range) => (
                      <button
                        key={range}
                        type="button"
                        className={`btn ${analyticsDateRange === range ? 'btn-pr' : 'btn-gh'} bsm`}
                        onClick={() => setAnalyticsDateRange(range)}
                      >
                        {range === 'all' ? 'All time' : `Last ${range} days`}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-gh bsm" onClick={() => void loadAnalytics()} style={{ marginLeft: 'auto' }}>
                    ↻ Refresh
                  </button>
                </div>

                {/* Row 2: Stat cards */}
                {analyticsData?.overview && (
                  <div className="sg sg4" style={{ marginBottom: 24 }}>
                    <div className="sc" style={{ ['--c' as string]: 'var(--ap)' }}>
                      <div className="sc-lbl">Signups (range)</div>
                      <div className="sc-val">{overviewStats ? fmt(analyticsDateRange === '7' ? overviewStats.signups_7d : overviewStats.signups_30d) : '—'}</div>
                      <div className="sc-meta">Applications</div>
                    </div>
                    <div className="sc" style={{ ['--c' as string]: 'var(--ok)' }}>
                      <div className="sc-lbl">Approvals (range)</div>
                      <div className="sc-val">{overviewStats ? fmt(overviewStats.approved) : '—'}</div>
                      <div className="sc-meta">Members</div>
                    </div>
                    <div className="sc" style={{ ['--c' as string]: 'var(--info)' }}>
                      <div className="sc-lbl">Approval Rate</div>
                      <div className="sc-val">{overviewStats ? `${overviewStats.approval_rate}%` : '—'}</div>
                      <div className="sc-meta">All time</div>
                    </div>
                    <div className="sc" style={{ ['--c' as string]: 'var(--warn)' }}>
                      <div className="sc-lbl">Connections</div>
                      <div className="sc-val">{overviewStats ? fmt(overviewStats.connections_total) : '—'}</div>
                      <div className="sc-meta">Total</div>
                    </div>
                  </div>
                )}

                {/* Row 3: Two line charts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <ChartCard
                    title="Signups Over Time"
                    subtitle={`Last ${analyticsDateRange === 'all' ? '90' : analyticsDateRange} days`}
                    loading={trendLoading}
                    error={trendError}
                    onRetry={() => loadTrendData(analyticsDateRange === 'all' ? 90 : parseInt(analyticsDateRange))}
                    cachedAt={trendCachedAt}
                  >
                    {trendData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#252A38" />
                          <XAxis dataKey="date" tick={{ fill: '#8892AA', fontSize: 10 }} interval={Math.floor(trendData.length / 7)} />
                          <YAxis tick={{ fill: '#8892AA', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                          <Line type="monotone" dataKey="total" stroke="#6366F1" strokeWidth={2} dot={false} name="Signups" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Connections Over Time"
                    subtitle="Coming soon"
                    loading={false}
                    error={null}
                    onRetry={() => {}}
                  >
                    <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                      <div style={{ fontSize: 12 }}>Connection tracking coming soon</div>
                    </div>
                  </ChartCard>
                </div>

                {/* Row 4: Three sections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <ChartCard
                    title="Top Niches"
                    subtitle="Approved members"
                    loading={nicheLoading}
                    error={nicheError}
                    onRetry={loadNicheData}
                    cachedAt={nicheCachedAt}
                  >
                    {nicheData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart layout="vertical" data={nicheData}>
                          <XAxis type="number" tick={{ fill: '#8892AA', fontSize: 10 }} />
                          <YAxis dataKey="niche" type="category" tick={{ fill: '#8892AA', fontSize: 11 }} width={120} />
                          <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#6366F1" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Geographic Distribution"
                    subtitle="Top locations"
                    loading={geoLoading}
                    error={geoError}
                    onRetry={loadGeoData}
                  >
                    {geoData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🌍</div>
                        <div style={{ fontSize: 12 }}>No location data</div>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 0' }}>
                        {geoData.map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < geoData.length - 1 ? '1px solid #252A38' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, width: 24, textAlign: 'center', color: '#4A5270' }}>
                                {i + 1}
                              </span>
                              <span style={{ fontSize: 13 }}>
                                {getCountryFlag(item.location)}
                              </span>
                              <span style={{ fontSize: 12, color: '#8892AA' }}>
                                {item.location}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#EEF0F8' }}>
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Platform Usage"
                    subtitle="Estimated"
                    loading={false}
                    error={null}
                    onRetry={() => {}}
                  >
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Web', value: 60, color: '#6366F1' },
                            { name: 'iOS', value: 25, color: '#10B981' },
                            { name: 'Android', value: 15, color: '#F59E0B' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {[
                            { name: 'Web', value: 60, color: '#6366F1' },
                            { name: 'iOS', value: 25, color: '#10B981' },
                            { name: 'Android', value: 15, color: '#F59E0B' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1C2030', border: '1px solid #2E3448', borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {/* Row 5: Analytics tables */}
                {analyticsData && (
                  <>
                    {analyticsData.featureUsage && analyticsData.featureUsage.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <ChartCard
                          title="Top Events"
                          subtitle="Feature usage"
                          loading={false}
                          error={null}
                          onRetry={() => {}}
                        >
                          <div className="admin-v3-table-wrap">
                            <table className="admin-v3-table">
                              <thead>
                                <tr>
                                  <th>Event</th>
                                  <th>Users</th>
                                  <th>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analyticsData.featureUsage.slice(0, 10).map((event: any, i: number) => (
                                  <tr key={i}>
                                    <td>{event.event_name || event.feature_name}</td>
                                    <td>{fmt(event.unique_users)}</td>
                                    <td>{fmt(event.total_events)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ChartCard>
                      </div>
                    )}

                    {analyticsData.funnelApp && analyticsData.funnelApp.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <ChartCard
                          title="Funnel Analysis"
                          subtitle="App activation flow"
                          loading={false}
                          error={null}
                          onRetry={() => {}}
                        >
                          <div className="admin-v3-table-wrap">
                            <table className="admin-v3-table">
                              <thead>
                                <tr>
                                  <th>Step</th>
                                  <th>Event</th>
                                  <th>Users</th>
                                  <th>Conversion</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analyticsData.funnelApp.map((step: any, i: number) => (
                                  <tr key={i}>
                                    <td>{step.step_index}</td>
                                    <td>{step.step_event_name}</td>
                                    <td>{fmt(step.unique_users)}</td>
                                    <td>{step.conversion_rate_from_previous_step != null ? `${Number(step.conversion_rate_from_previous_step).toFixed(1)}%` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ChartCard>
                      </div>
                    )}

                    {(analyticsData.insights?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <ChartCard
                          title="Insights"
                          subtitle="AI-generated recommendations"
                          loading={false}
                          error={null}
                          onRetry={() => {}}
                        >
                          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                            {(analyticsData.insights ?? []).slice(0, 10).map((ins: any, i: number) => (
                              <li key={i} style={{ marginBottom: 6, fontSize: 12, color: 'var(--t2)' }}>
                                <strong>{ins.title ?? 'Insight'}</strong> — {ins.description ?? ''} {ins.recommendation ? `Recommendation: ${ins.recommendation}` : ''}
                              </li>
                            ))}
                          </ul>
                        </ChartCard>
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={inboxUnreadOnly}
                      onChange={(e) => setInboxUnreadOnly(e.target.checked)}
                    />
                    Unread only
                  </label>
                </div>
                {inboxLoading ? (
                  <div className="admin-v3-table-wrap">
                    <table className="admin-v3-table">
                      <thead>
                        <tr><th>Participants</th><th>Last message</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                            <td><div style={{ height: 20, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : inboxThreads.length === 0 ? (
                  <div className="te"><div className="tei">📬</div>No conversations.</div>
                ) : (
                  <>
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
                    {inboxThreads.length >= 20 && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <button type="button" className="btn btn-gh bsm">
                          Load more
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Invite Creator panel */}
            {activePanel === 'invite' && (
              <div id="panel-invite" className="panel active">
                <div className="ptit">Invite Creator</div>
                <div className="pdesc">Generate invite links and track recent invites.</div>
                
                <div className="card" style={{ marginBottom: 24 }}>
                  <div className="ct">Invite Link Generator</div>
                  <div className="cs">Create a shareable signup link with optional niche</div>
                  <div style={{ marginTop: 16 }}>
                    <input
                      className="inp"
                      type="text"
                      placeholder="Niche/segment (optional)"
                      id="invite-niche-input"
                      style={{ width: '100%', marginBottom: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="inp"
                        type="text"
                        readOnly
                        value={(() => {
                          const nicheInput = typeof document !== 'undefined' ? (document.getElementById('invite-niche-input') as HTMLInputElement)?.value : ''
                          const niche = nicheInput ? `&niche=${encodeURIComponent(nicheInput)}` : ''
                          const username = adminEmail?.split('@')[0] ?? 'admin'
                          return `https://app.inthecircle.co/signup?ref=${username}${niche}`
                        })()}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-gh"
                        onClick={() => {
                          const nicheInput = (document.getElementById('invite-niche-input') as HTMLInputElement)?.value ?? ''
                          const niche = nicheInput ? `&niche=${encodeURIComponent(nicheInput)}` : ''
                          const username = adminEmail?.split('@')[0] ?? 'admin'
                          const link = `https://app.inthecircle.co/signup?ref=${username}${niche}`
                          navigator.clipboard.writeText(link)
                          showToast('Link copied to clipboard', 'ok')
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="ct">Recent Invites</div>
                  <div className="cs">Last 10 invites sent</div>
                  <div style={{ marginTop: 16 }}>
                    <div className="te">
                      <div className="tei">📋</div>
                      No invite history available. Invite tracking can be added via audit log integration.
                    </div>
                  </div>
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
