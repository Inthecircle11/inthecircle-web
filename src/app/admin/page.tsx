'use client'

import { useEffect, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getAdminBase } from '@/lib/admin'
import { Logo } from '@/components/Logo'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminPermission } from '@/lib/admin-rbac'
import AdminProductAnalyticsTab from './ProductAnalyticsTab'
import { trackAdminEvent, startSession, endSessionWithBeacon, ADMIN_EVENTS } from '@/lib/analytics'
import { parseAdminResponse } from '@/lib/admin-client'
import { ConfirmModal } from './components/ConfirmModal'
import { AdminErrorBoundary } from './AdminErrorBoundary'
import { OverviewTab } from './tabs/OverviewTab'
import { VerificationsTab } from './tabs/VerificationsTab'
import { ApprovalsTab } from './tabs/ApprovalsTab'
import { RiskTab } from './tabs/RiskTab'
import { DataRequestsTab } from './tabs/DataRequestsTab'
import { ReportsTab } from './tabs/ReportsTab'
import { AuditLogTab } from './tabs/AuditLogTab'
import { ComplianceTab } from './tabs/ComplianceTab'
import { SettingsTab } from './tabs/SettingsTab'
import { StatCard } from './components/StatCard'
import { Avatar } from './components/Avatar'
import { downloadCSV, formatTimeAgo } from './utils'
import type {
  Stats,
  Application,
  User,
  VerificationRequest,
  RecentActivity,
  InboxMessage,
  InboxThread,
  LocationByCountry,
  ConversationDisplay,
  Tab,
  AppFilter,
} from './types'

// ============================================
// TYPES - Re-export / local extensions only (main types in ./types.ts)
// ============================================
const isMessageRead = (m: InboxMessage) => m.seen_at !== null
const isMessageDelivered = (m: InboxMessage) => m.delivered_at !== null

// Location parsing: normalize "City, Country" / "Country" into country + city for flags and grouping
const COUNTRY_TO_ISO: Record<string, string> = {
  uae: 'AE', 'united arab emirates': 'AE', emirates: 'AE',
  egypt: 'EG', 'saudi arabia': 'SA', kuwait: 'KW', bahrain: 'BH', oman: 'OM', qatar: 'QA',
  usa: 'US', 'united states': 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', 'united kingdom': 'GB', britain: 'GB', england: 'GB',
  poland: 'PL', germany: 'DE', france: 'FR', spain: 'ES', italy: 'IT', netherlands: 'NL',
  india: 'IN', pakistan: 'PK', bangladesh: 'BD', lebanon: 'LB', jordan: 'JO', turkey: 'TR',
  canada: 'CA', australia: 'AU', 'new zealand': 'NZ', 'south africa': 'ZA', nigeria: 'NG',
  brazil: 'BR', mexico: 'MX', argentina: 'AR', colombia: 'CO',
  singapore: 'SG', malaysia: 'MY', indonesia: 'ID', philippines: 'PH', japan: 'JP', 'south korea': 'KR', china: 'CN',
  russia: 'RU', ukraine: 'UA', greece: 'GR', portugal: 'PT', sweden: 'SE', norway: 'NO', switzerland: 'CH', austria: 'AT',
  morocco: 'MA', algeria: 'DZ', tunisia: 'TN', kenya: 'KE', ghana: 'GH',
}
const ISO_TO_COUNTRY_NAME: Record<string, string> = {
  AE: 'United Arab Emirates', EG: 'Egypt', SA: 'Saudi Arabia', KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman', QA: 'Qatar',
  US: 'United States', GB: 'United Kingdom', PL: 'Poland', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
  IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', LB: 'Lebanon', JO: 'Jordan', TR: 'Turkey',
  CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', ZA: 'South Africa', NG: 'Nigeria',
  BR: 'Brazil', MX: 'Mexico', AR: 'Argentina', CO: 'Colombia',
  SG: 'Singapore', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines', JP: 'Japan', KR: 'South Korea', CN: 'China',
  RU: 'Russia', UA: 'Ukraine', GR: 'Greece', PT: 'Portugal', SE: 'Sweden', NO: 'Norway', CH: 'Switzerland', AT: 'Austria',
  MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', KE: 'Kenya', GH: 'Ghana',
}
// Cities often entered without country — map to country ISO so they don’t show as “countries”
const CITY_TO_COUNTRY_ISO: Record<string, string> = {
  dubai: 'AE', sharjah: 'AE', 'abu dhabi': 'AE', ajman: 'AE', 'ras al khaimah': 'AE', fujairah: 'AE', 'umm al quwain': 'AE', 'al ain': 'AE',
  cairo: 'EG', alexandria: 'EG', giza: 'EG',
  riyadh: 'SA', jeddah: 'SA', mecca: 'SA', medina: 'SA', dammam: 'SA',
  'kuwait city': 'KW', manama: 'BH', muscat: 'OM', doha: 'QA',
  london: 'GB', manchester: 'GB', birmingham: 'GB', liverpool: 'GB', leeds: 'GB',
  'new york': 'US', 'los angeles': 'US', chicago: 'US', miami: 'US', houston: 'US',
  warsaw: 'PL', krakow: 'PL', paris: 'FR', berlin: 'DE', madrid: 'ES', rome: 'IT', amsterdam: 'NL',
  mumbai: 'IN', delhi: 'IN', bangalore: 'IN', karachi: 'PK', istanbul: 'TR', beirut: 'LB', amman: 'JO',
  toronto: 'CA', sydney: 'AU', melbourne: 'AU', singapore: 'SG', 'hong kong': 'CN', tokyo: 'JP', seoul: 'KR',
}
function getFlagEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '🌍'
  return [...iso2.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('')
}
function parseLocation(raw: string): { country: string; countryCode: string; city: string; flag: string } {
  const s = (raw || '').trim()
  if (!s) return { country: 'Unknown', countryCode: '', city: '', flag: '🌍' }
  const parts = s.split(',').map(p => p.trim()).filter(Boolean)
  let countryPart = parts[parts.length - 1] ?? ''
  let cityPart = parts.length > 1 ? parts.slice(0, -1).join(', ') : ''
  const key = countryPart.toLowerCase().replace(/\s+/g, ' ')
  // Single part (e.g. "Dubai", "Sharjah") → treat as city if it’s a known city, not a country
  if (parts.length === 1) {
    const cityKey = key
    const countryFromCity = CITY_TO_COUNTRY_ISO[cityKey]
    if (countryFromCity) {
      countryPart = ISO_TO_COUNTRY_NAME[countryFromCity] ?? countryPart
      cityPart = parts[0] ?? ''
      const countryCode = countryFromCity
      const countryName = ISO_TO_COUNTRY_NAME[countryCode] ?? countryPart
      return { country: countryName, countryCode, city: cityPart, flag: getFlagEmoji(countryCode) }
    }
  }
  const code = COUNTRY_TO_ISO[key] ?? COUNTRY_TO_ISO[key.replace(/\s+/g, ' ')]
  const countryCode = code || ''
  const countryName = countryCode ? (ISO_TO_COUNTRY_NAME[countryCode] ?? countryPart) : countryPart
  const flag = countryCode ? getFlagEmoji(countryCode) : '🌍'
  return { country: countryName, countryCode: countryCode || '', city: cityPart, flag }
}

interface InboxProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

/** Raw profile row from Supabase profiles select */
interface ProfileRow {
  id: string
  username: string | null
  name: string | null
  profile_image_url: string | null
}

/** Tab visibility: show tab only if user has this permission (Phase 11). */
const TAB_PERMISSION: Record<Tab, AdminPermission> = {
  overview: ADMIN_PERMISSIONS.read_applications,
  dashboard: ADMIN_PERMISSIONS.read_applications,
  applications: ADMIN_PERMISSIONS.read_applications,
  users: ADMIN_PERMISSIONS.read_users,
  verifications: ADMIN_PERMISSIONS.read_applications,
  inbox: ADMIN_PERMISSIONS.read_reports,
  reports: ADMIN_PERMISSIONS.read_reports,
  'data-requests': ADMIN_PERMISSIONS.read_data_requests,
  risk: ADMIN_PERMISSIONS.read_risk,
  approvals: ADMIN_PERMISSIONS.approve_approval,
  audit: ADMIN_PERMISSIONS.read_audit,
  compliance: ADMIN_PERMISSIONS.read_audit,
  analytics: ADMIN_PERMISSIONS.read_analytics,
  settings: ADMIN_PERMISSIONS.read_config,
}

// Sidebar nav icons (professional dashboard style)
function NavIconChart() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-5h2v17h-2V4zm4 5h2v8h-2v-8z" />
    </svg>
  )
}
function NavIconLayout() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  )
}
function NavIconUser() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function NavIconUsers() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function NavIconCheck() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function NavIconMessage() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
function NavIconSettings() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function NavIconReport() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
function NavIconAudit() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}
function NavIconCompliance() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
function NavIconData() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}
function NavIconApproval() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
function NavIconRisk() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
function NavIconAnalytics() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

/** Focus trap and return-focus for modal dialogs */
function useModalFocusTrap(dialogRef: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const savedFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    savedFocusRef.current = document.activeElement as HTMLElement
    const el = dialogRef.current
    if (!el) return
    const focusables = Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(e => !e.hasAttribute('disabled'))
    const first = focusables[0]
    if (first) first.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { savedFocusRef.current?.focus(); onClose(); return }
      if (e.key !== 'Tab') return
      const current = document.activeElement
      const idx = focusables.indexOf(current as HTMLElement)
      if (idx === -1) return
      if (e.shiftKey) {
        if (idx === 0) { e.preventDefault(); focusables[focusables.length - 1].focus() }
      } else {
        if (idx === focusables.length - 1) { e.preventDefault(); focusables[0].focus() }
      }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback(() => {
    savedFocusRef.current?.focus()
    onClose()
  }, [onClose])
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPanel() {
  const router = useRouter()
  const [gateUnlocked, setGateUnlocked] = useState<boolean | null>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [adminRoles, setAdminRoles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadIdRef = useRef(0)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast({ message, type })
    toastRef.current = setTimeout(() => { setToast(null); toastRef.current = null }, 4000)
  }, [])
  
  // Data states
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 })
  const [applications, setApplications] = useState<Application[]>([])
  const [applicationsTotal, setApplicationsTotal] = useState(0)
  const [applicationsPage, setApplicationsPage] = useState(1)
  const APPLICATIONS_PAGE_SIZE = 50
  const [users, setUsers] = useState<User[]>([])
  const [usersTotalCount, setUsersTotalCount] = useState<number | null>(null)
  const [profilesWithDemographics, setProfilesWithDemographics] = useState<{ id: string; location: string | null; niche: string | null }[]>([])
  const [pendingVerifications, setPendingVerifications] = useState<VerificationRequest[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [activeUsersToday, setActiveUsersToday] = useState<number>(0)
  const [activeSessions, setActiveSessions] = useState<{
    count: number
    users: Array<{ user_id: string; email: string | null; username: string | null; name: string | null; last_active_at: string }>
    minutes: number
  } | null>(null)
  const [totalThreadCount, setTotalThreadCount] = useState<number | null>(null)
  const [totalMessageCount, setTotalMessageCount] = useState<number | null>(null)
  const [overviewCounts, setOverviewCounts] = useState<{
    totalUsers: number
    verifiedCount: number
    newUsersLast24h: number
    newUsersLast7d?: number
    newUsersLast30d: number
    totalThreadCount: number
    totalMessageCount: number
    applicationsSubmittedLast7d: number
    applicationsApprovedLast7d: number
  } | null>(null)
  
  // Inbox states
  const [conversations, setConversations] = useState<ConversationDisplay[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<ConversationDisplay | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [senderProfiles, setSenderProfiles] = useState<Record<string, { name: string; username: string }>>({})
  
  // UI states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [appFilter, setAppFilter] = useState<AppFilter>('all')
  const [appSort, setAppSort] = useState<string>('overdue')
  const [appAssignmentFilter, setAppAssignmentFilter] = useState<string>('all')
  const [appSearch, setAppSearch] = useState('')
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Confirm modal for bulk reject/suspend (replaces confirm/prompt)
  const [confirmBulk, setConfirmBulk] = useState<{ open: boolean; action?: 'reject' | 'suspend'; applicationIds?: string[] }>({ open: false })
  // Inline admin login (avoids dependency on /admin/login which can 404 in production)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false)

  // Audit, reports, data requests, config, blocked users
  const [auditLog, setAuditLog] = useState<Array<{ id: string; action: string; target_type: string | null; target_id: string | null; admin_email: string | null; created_at: string; details?: unknown }>>([])
  const [auditVerifyResult, setAuditVerifyResult] = useState<{ chain_valid: boolean; snapshot_valid?: boolean; first_corrupted_id?: string; snapshot_date?: string; rows_checked?: number } | null>(null)
  const [auditVerifyLoading, setAuditVerifyLoading] = useState(false)
  const [auditSnapshotLoading, setAuditSnapshotLoading] = useState(false)
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [dataRequests, setDataRequests] = useState<Array<Record<string, unknown>>>([])
  const [appConfig, setAppConfig] = useState<Record<string, string>>({})
  const [blockedUsers, setBlockedUsers] = useState<Array<Record<string, unknown>>>([])
  const [announceSuccess, setAnnounceSuccess] = useState('')
  const [configSaveSuccess, setConfigSaveSuccess] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [dataRequestsLoading, setDataRequestsLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [blockedLoading, setBlockedLoading] = useState(false)
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskData, setRiskData] = useState<{
    pending_applications: number
    pending_reports: number
    overdue_data_requests: number
    open_escalations: Array<Record<string, unknown>>
    last_escalation_time: string | null
  } | null>(null)
  const [approvalsPending, setApprovalsPending] = useState<Array<Record<string, unknown>>>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)

  // Compliance (Phase 7)
  const [complianceControls, setComplianceControls] = useState<Array<Record<string, unknown>>>([])
  const [complianceEvidence, setComplianceEvidence] = useState<Array<Record<string, unknown>>>([])
  const [complianceReviews, setComplianceReviews] = useState<Array<Record<string, unknown>>>([])
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [complianceHealth, setComplianceHealth] = useState<{
    overall_score: number | null
    controls: Array<{ control_code: string; status: string; score: number; last_checked_at: string; notes: string | null }>
    last_checked_at: string | null
  } | null>(null)
  const [generatingEvidenceCode, setGeneratingEvidenceCode] = useState<string | null>(null)
  const [governanceScore, setGovernanceScore] = useState<number | null>(null)

  // Deployment identity: detect if wrong project is being served
  const [wrongDeployment, setWrongDeployment] = useState<boolean | null>(null)

  // ============================================
  // INBOX LOADING - Matches iOS MatchesStore
  // (Defined early so it can be referenced in useEffects)
  // ============================================

  const loadInbox = useCallback(async () => {
    if (!currentUserId) return
    setInboxLoading(true)
    const supabase = createClient()
    
    try {
      // ADMIN VIEW: Get ALL message threads across the platform (not just admin's)
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100)  // More threads for admin oversight
      
      if (threadsError) throw threadsError
      if (!threads || threads.length === 0) {
        setConversations([])
        setInboxLoading(false)
        return
      }

      // Step 2: Get messages for all threads
      const threadIds = (threads as InboxThread[]).map((t: InboxThread) => t.id)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
      
      if (messagesError) throw messagesError

      // Step 3: Get ALL user profiles involved in these threads
      const allUserIds = new Set<string>()
      ;(threads as InboxThread[]).forEach((t: InboxThread) => {
        if (t.user1_id) allUserIds.add(t.user1_id)
        if (t.user2_id) allUserIds.add(t.user2_id)
      })
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, name, profile_image_url')
        .in('id', Array.from(allUserIds))

      if (profilesError) throw profilesError

      // Build profile map
      const profileMap: Record<string, InboxProfile> = {}
      ;(profiles as ProfileRow[] | null)?.forEach((p: ProfileRow) => {
        profileMap[p.id] = {
          id: p.id,
          username: p.username,
          full_name: p.name,  // DB uses 'name' not 'full_name'
          avatar_url: p.profile_image_url
        }
      })

      // Build messages map by thread
      const messagesByThread: Record<string, InboxMessage[]> = {}
      ;(messages as InboxMessage[] | null)?.forEach((m: InboxMessage) => {
        if (!messagesByThread[m.thread_id]) {
          messagesByThread[m.thread_id] = []
        }
        messagesByThread[m.thread_id].push({
          id: m.id,
          thread_id: m.thread_id,
          sender_id: m.sender_id,
          content: m.content,
          media_url: m.media_url,
          media_type: m.media_type,
          seen_at: m.seen_at,
          delivered_at: m.delivered_at,
          created_at: m.created_at
        })
      })

      // Build conversation list - show BOTH users for admin view
      const convos: ConversationDisplay[] = (threads as InboxThread[]).map((thread: InboxThread) => {
        const user1 = thread.user1_id ? profileMap[thread.user1_id] : null
        const user2 = thread.user2_id ? profileMap[thread.user2_id] : null
        const threadMessages = messagesByThread[thread.id] || []
        const lastMsg = threadMessages[0]
        const totalUnread = threadMessages.filter(m => !isMessageRead(m)).length

        // Format names for admin view: "User1 ↔ User2"
        const user1Name = user1?.full_name || user1?.username || 'Unknown'
        const user2Name = user2?.full_name || user2?.username || 'Unknown'
        const displayName = `${user1Name} ↔ ${user2Name}`
        const displayUsername = `@${user1?.username || '?'} & @${user2?.username || '?'}`

        return {
          threadId: thread.id,
          otherUserId: thread.user1_id || thread.user2_id || 'unknown',
          otherUserName: displayName,
          otherUserUsername: displayUsername,
          otherUserAvatar: user1?.avatar_url || user2?.avatar_url || null,
          lastMessage: lastMsg?.content || (lastMsg?.media_url ? '📷 Photo' : 'No messages yet'),
          lastMessageTime: lastMsg ? new Date(lastMsg.created_at) : new Date(thread.updated_at),
          unreadCount: totalUnread,
          messages: threadMessages.slice(0, 100) // More messages for admin
        }
      })

      // Sort by last message time
      convos.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
      
      // Store sender profiles for message display
      const senderMap: Record<string, { name: string; username: string }> = {}
      ;(profiles as ProfileRow[] | null)?.forEach((p: ProfileRow) => {
        senderMap[p.id] = {
          name: p.name || p.username || 'Unknown',
          username: p.username || 'unknown'
        }
      })
      setSenderProfiles(senderMap)
      
      setConversations(convos)
      console.log(`✅ Admin: Loaded ${convos.length} conversations across all users`)
    } catch (error) {
      console.error('❌ Failed to load inbox:', error)
    }
    
    setInboxLoading(false)
  }, [currentUserId])

  // ============================================
  // AUTH CHECK
  // ============================================
  
  useEffect(() => {
    if (gateUnlocked !== true) return
    checkAdminAccess()
  }, [gateUnlocked]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deployment identity check: ensure we're on inthecircle-web (not wrong project)
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/identity', { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        const { data } = parseAdminResponse<{ app?: string }>(res, json)
        return data
      })
      .then((data) => {
        if (!cancelled) setWrongDeployment(!data || data.app !== 'inthecircle-web')
      })
      .catch(() => { if (!cancelled) setWrongDeployment(true) })
    return () => { cancelled = true }
  }, [])

  // Load inbox only when Inbox tab is active (keeps initial load fast)
  useEffect(() => {
    if (authorized && activeTab === 'inbox' && currentUserId) {
      loadInbox()
    }
  }, [authorized, activeTab, currentUserId, loadInbox])

  // ============================================
  // REAL-TIME SYNC - Matches iOS Admin
  // ============================================
  
  useEffect(() => {
    if (!authorized) return

    const supabase = createClient()
    
    // Subscribe to applications table changes
    const applicationsChannel = supabase
      .channel('admin-applications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'applications'
      }, () => {
        console.log('📡 Applications changed - reloading...')
        loadData()
      })
      .subscribe()

    // Subscribe to profiles table changes
    const profilesChannel = supabase
      .channel('admin-profiles-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, () => {
        console.log('📡 Profiles changed - reloading...')
        loadData()
      })
      .subscribe()

    // Subscribe to verification_requests changes
    const verificationsChannel = supabase
      .channel('admin-verifications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'verification_requests'
      }, () => {
        console.log('📡 Verifications changed - reloading...')
        loadData()
      })
      .subscribe()

    // Subscribe to messages changes (real-time inbox)
    const messagesChannel = supabase
      .channel('admin-messages-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        console.log('📬 Messages changed - reloading inbox...')
        loadInbox()
      })
      .subscribe()

    // Subscribe to message_threads changes
    const threadsChannel = supabase
      .channel('admin-threads-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_threads'
      }, () => {
        console.log('📡 Threads changed - reloading inbox...')
        loadInbox()
      })
      .subscribe()

    console.log('✅ Real-time sync enabled for admin panel (including inbox)')

    return () => {
      supabase.removeChannel(applicationsChannel)
      supabase.removeChannel(profilesChannel)
      supabase.removeChannel(verificationsChannel)
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(threadsChannel)
      console.log('🔌 Real-time sync disconnected')
    }
  }, [authorized]) // eslint-disable-line react-hooks/exhaustive-deps

  // Product analytics: session start when admin is authorized
  useEffect(() => {
    if (authorized) startSession('admin')
  }, [authorized])

  // Product analytics: track tab open
  useEffect(() => {
    if (authorized && activeTab) {
      trackAdminEvent(ADMIN_EVENTS.admin_tab_opened, { featureName: activeTab })
    }
  }, [authorized, activeTab])

  // Product analytics: end session on leave (pagehide — not deprecated; beforeunload is deprecated for unload listeners)
  useEffect(() => {
    const onPageHide = () => endSessionWithBeacon('admin')
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  // Gate: check if password screen is needed (optional ADMIN_GATE_PASSWORD)
  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled) setGateUnlocked(true)
    }, 10000)
    fetch('/api/admin/gate', { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json()
        return { res, json }
      })
      .then(({ res, json }) => {
        if (!cancelled) {
          clearTimeout(timeoutId)
          const { data } = parseAdminResponse<{ unlocked?: boolean }>(res, json)
          setGateUnlocked(data?.unlocked === true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeoutId)
          setGateUnlocked(true)
        }
      })
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [])

  async function submitGatePassword(e: React.FormEvent) {
    e.preventDefault()
    setGateError(null)
    setGateSubmitting(true)
    try {
      const res = await fetch('/api/admin/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: gatePassword }),
      })
      const json = await res.json()
      const { data, error } = parseAdminResponse<{ ok?: boolean }>(res, json)
      if (error) {
        setGateError(error)
      } else if (data) {
        setGateUnlocked(true)
        setGatePassword('')
      }
    } catch {
      setGateError('Something went wrong')
    }
    setGateSubmitting(false)
  }

  async function checkAdminAccess() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setAuthorized(false)
        setError('Please log in with your admin account to access this panel.')
        return
      }

      const res = await fetch('/api/admin/check', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      const { data } = parseAdminResponse<{ authorized?: boolean; roles?: string[]; sessionId?: string }>(res, json)
      const authorized = !!data?.authorized
      const roles = Array.isArray(data?.roles) ? data.roles : []

      if (!authorized) {
        setAuthorized(false)
        setLoginError('This account is not authorized to access the admin panel.')
        return
      }

      setAuthorized(true)
      setAdminRoles(roles)
      setCurrentUserId(user.id)
      void loadData()
    } catch (e) {
      console.error('[admin] checkAdminAccess failed', e)
      setAuthorized(false)
      setError('Failed to load admin. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // DATA LOADING - All RPCs matching iOS
  // ============================================

  const PERMISSION_DENIED_MESSAGE = 'You do not have permission to view this section.'
  /** Phase 12: Central 403 handler. Refetch roles, show consistent message, redirect to first allowed tab if needed. */
  const handle403 = useCallback(async () => {
    setError(PERMISSION_DENIED_MESSAGE)
    const res = await fetch('/api/admin/check', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    const roles = Array.isArray(data?.roles) ? data.roles : []
    if (data?.authorized && roles.length) {
      setAdminRoles(roles)
      const visibleIds = (['overview', 'dashboard', 'applications', 'users', 'verifications', 'inbox', 'reports', 'data-requests', 'risk', 'approvals', 'audit', 'compliance', 'analytics', 'settings'] as const).filter(
        (id) => id === 'analytics' || hasPermission(roles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[id])
      )
      setActiveTab((prev) => (visibleIds.length && !visibleIds.includes(prev) ? visibleIds[0] : prev))
    }
  }, [])

  const loadData = useCallback(async (
    overrides?: { appSort?: string; appAssignmentFilter?: string; appFilter?: AppFilter },
    options?: { skipOverview?: boolean; applicationsPage?: number }
  ) => {
    loadIdRef.current += 1
    const thisLoadId = loadIdRef.current
    if (!options?.skipOverview) {
      setRefreshing(true)
      setError(null)
    }
    const supabase = createClient()
    const sort = overrides?.appSort ?? appSort
    const filter = overrides?.appAssignmentFilter ?? appAssignmentFilter
    const statusFilter = overrides?.appFilter ?? appFilter
    if (overrides?.appSort != null) setAppSort(overrides.appSort)
    if (overrides?.appAssignmentFilter != null) setAppAssignmentFilter(overrides.appAssignmentFilter)
    if (overrides?.appFilter != null) setAppFilter(overrides.appFilter)

    try {
    // 1) Fast overview stats (one request, server runs counts + active today + sessions in parallel)
    const fetchOverviewStats = async (): Promise<{
      stats: Stats
      activeToday: number | null
      activeSessions: {
        count: number
        users: Array<{ user_id: string; email: string | null; username: string | null; name: string | null; last_active_at: string }>
        minutes: number
      } | null
      overviewCounts: {
        totalUsers: number
        verifiedCount: number
        newUsersLast24h: number
        newUsersLast7d: number
        newUsersLast30d: number
        totalThreadCount: number
        totalMessageCount: number
        applicationsSubmittedLast7d: number
        applicationsApprovedLast7d: number
      } | null
      permissionDenied?: boolean
    } | null> => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // Reduced from 6s to 3s - server has 60s cache
        const res = await fetch('/api/admin/overview-stats', { credentials: 'include', signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.status === 403) return { stats: { total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 }, activeToday: null, activeSessions: null, overviewCounts: null, permissionDenied: true }
        if (!res.ok) return null
        const json = await res.json()
        const { data } = parseAdminResponse(res, json)
        if (!data) return null
        const d = data as { stats?: Stats; activeToday?: number; activeSessions?: unknown; overviewCounts?: unknown }
        return {
          stats: d.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 },
          activeToday: (() => {
            const v = d.activeToday
            if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, v)
            if (typeof v === 'string') { const n = parseInt(v, 10); if (!Number.isNaN(n)) return Math.max(0, n) }
            return v != null ? Math.max(0, Number(v)) : null
          })(),
          activeSessions: (d.activeSessions ?? null) as {
            count: number
            users: Array<{ user_id: string; email: string | null; username: string | null; name: string | null; last_active_at: string }>
            minutes: number
          } | null,
          overviewCounts: (d.overviewCounts ?? null) as {
            totalUsers: number
            verifiedCount: number
            newUsersLast24h: number
            newUsersLast7d: number
            newUsersLast30d: number
            totalThreadCount: number
            totalMessageCount: number
            applicationsSubmittedLast7d: number
            applicationsApprovedLast7d: number
          } | null,
        }
      } catch {
        return null
      }
    }

    const fetchApplications = async (
      sort?: string,
      filter?: string,
      page: number = 1,
      limit: number = 50,
      appStatus?: AppFilter
    ): Promise<{ apps: Application[]; total: number; counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } | null; countsError?: boolean; permissionDenied?: boolean }> => {
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        if (sort) params.set('sort', sort)
        if (filter) params.set('filter', filter)
        if (appStatus && appStatus !== 'all') params.set('status', appStatus)
        const q = params.toString()
        const res = await fetch(`/api/admin/applications?${q}`, { credentials: 'include' })
        if (res.status === 403) return { apps: [], total: 0, counts: null, permissionDenied: true }
        const json = await res.json().catch(() => ({}))
        const { data } = parseAdminResponse<{ applications?: Application[]; total?: number; counts?: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } }>(res, json)
        if (!res.ok || !data) return { apps: [], total: 0, counts: null, permissionDenied: false }
        const apps = (data.applications ?? []) as Application[]
        const total = typeof data.total === 'number' ? data.total : apps.length
        const counts = data.counts && typeof data.counts.pending === 'number' ? data.counts : null
        return { apps, total, counts, countsError: false, permissionDenied: false }
      } catch (e) {
        console.error('Applications error:', e)
        return { apps: [], total: 0, counts: null, permissionDenied: false }
      }
    }

    const fetchUsersAndProfiles = async (): Promise<{ users: User[]; profiles: { id: string; location: string | null; niche: string | null }[]; total: number }> => {
      try {
        const res = await fetch('/api/admin/users', { credentials: 'include' })
        if (!res.ok) return { users: [], profiles: [], total: 0 }
        const json = await res.json()
        const { data } = parseAdminResponse<{ users?: User[]; total?: number }>(res, json)
        if (!data?.users) return { users: [], profiles: [], total: 0 }
        const users = (data.users || []).map((u: User & { location?: string | null; niche?: string | null }) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          profile_image_url: u.profile_image_url,
          is_verified: u.is_verified,
          is_banned: u.is_banned,
          created_at: u.created_at,
        })) as User[]
        const profiles = (data.users || []).map((u: { id: string; location?: string | null; niche?: string | null }) => ({
          id: u.id,
          location: u.location ?? null,
          niche: u.niche ?? null,
        }))
        const total = typeof data.total === 'number' ? data.total : users.length
        return { users, profiles, total }
      } catch (e) {
        console.error('Users error:', e)
        return { users: [], profiles: [], total: 0 }
      }
    }

    const fetchActiveToday = async (): Promise<number | null> => {
      try {
        const res = await fetch('/api/admin/active-today', { credentials: 'include', cache: 'no-store' })
        if (!res.ok) return null
        const json = await res.json().catch(() => ({}))
        const { data } = parseAdminResponse<{ count?: number }>(res, json)
        const raw = data?.count
        if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.max(0, Math.floor(raw))
        if (typeof raw === 'string') {
          const n = parseInt(raw, 10)
          if (!Number.isNaN(n)) return Math.max(0, n)
        }
        return null
      } catch {
        return null
      }
    }

    const fetchActiveSessions = async () => {
      try {
        const res = await fetch('/api/admin/active-sessions?minutes=15', { credentials: 'include' })
        return res.ok ? res.json() : null
      } catch {
        return null
      }
    }

    const fetchVerificationActivity = async (): Promise<RecentActivity[]> => {
      try {
        const res = await fetch('/api/admin/verification-activity', { credentials: 'include' })
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []).map((item: { id?: string; title: string; subtitle: string; timestamp: string; color: string }, index: number) => ({
          id: item.id ?? `activity-${index}`,
          type: item.title?.includes('approved') ? 'verification_approved' : 'verification_rejected',
          title: item.title ?? '',
          subtitle: item.subtitle ?? '',
          timestamp: new Date(item.timestamp),
          color: item.color ?? '#6B7280',
        }))
      } catch {
        return []
      }
    }

    const fetchPendingVerifications = async () => {
      try {
        const res = await fetch('/api/admin/verification-requests?status=pending', { credentials: 'include' })
        if (!res.ok) return []
        const data = await res.json()
        const requests = data.requests || []
        return requests.map((v: { id: string; user_id: string; requested_at: string; username?: string; profile_image_url?: string | null }) => ({
          id: v.id,
          user_id: v.user_id,
          username: v.username ?? 'Unknown',
          profile_image_url: v.profile_image_url ?? undefined,
          requested_at: v.requested_at,
        }))
      } catch {
        return []
      }
    }

    const fetchEngagementCounts = async (): Promise<{ threadCount: number | null; messageCount: number | null }> => {
      try {
        const [threadRes, messageRes] = await Promise.all([
          supabase.from('message_threads').select('*', { count: 'exact', head: true }),
          supabase.from('messages').select('*', { count: 'exact', head: true }),
        ])
        return {
          threadCount: threadRes.count ?? null,
          messageCount: messageRes.count ?? null,
        }
      } catch {
        return { threadCount: null, messageCount: null }
      }
    }

    const fetchReportsAndDataRequests = async () => {
      try {
        const [resReports, resData] = await Promise.all([
          fetch('/api/admin/reports', { credentials: 'include' }),
          fetch('/api/admin/data-requests', { credentials: 'include' }),
        ])
        const dataReports = await resReports.json().catch(() => ({}))
        const dataData = await resData.json().catch(() => ({}))
        return {
          reports: dataReports.reports ?? [],
          dataRequests: dataData.requests ?? [],
        }
      } catch {
        return { reports: [], dataRequests: [] }
      }
    }

    if (!options?.skipOverview) {
      // Run overview, tab data, and Active today in parallel so both metrics have independent sources
      const [overviewRes, , activeTodayFromApi] = await Promise.all([
        fetchOverviewStats(),
        loadTabData(activeTab, thisLoadId),
        fetchActiveToday(),
      ])
      if (loadIdRef.current !== thisLoadId) return
      const overview = overviewRes
      if (overview?.permissionDenied) {
        handle403()
        setApplications([])
        setApplicationsTotal(0)
        setApplicationsPage(1)
        setStats({ total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 })
        setActiveSessions(null)
        setActiveUsersToday(0)
        setOverviewCounts(null)
      } else if (overview) {
        setStats(overview.stats)
        setActiveSessions(overview.activeSessions)
        if (overview.overviewCounts) {
          setOverviewCounts(overview.overviewCounts)
          setTotalThreadCount(overview.overviewCounts.totalThreadCount)
          setTotalMessageCount(overview.overviewCounts.totalMessageCount)
        }
        // Active today: dedicated endpoint first, then overview, then concurrent active count (15m) as fallback
        const activeTodayValue =
          activeTodayFromApi ??
          (overview.activeToday != null ? overview.activeToday : null) ??
          (overview.activeSessions?.count != null ? overview.activeSessions.count : null) ??
          0
        setActiveUsersToday(activeTodayValue)
      } else {
        // Overview failed or timed out; we still have activeTodayFromApi from parallel fetch
        const activeSessionsData = await fetchActiveSessions()
        setActiveSessions(activeSessionsData)
        setActiveUsersToday(activeTodayFromApi ?? (activeSessionsData?.count ?? 0))
      }
    }

    async function loadTabData(tab: Tab, loadId: number) {
      if (tab === 'overview') {
        const [appResult, usersAndProfiles] = await Promise.all([
          fetchApplications(sort, filter, 1, APPLICATIONS_PAGE_SIZE, statusFilter),
          fetchUsersAndProfiles(),
        ])
        if (loadIdRef.current !== loadId) return
        if (!appResult.permissionDenied) {
          setApplications(appResult.apps)
          setApplicationsTotal(appResult.total)
          setApplicationsPage(prev => Math.min(prev, Math.max(1, Math.ceil(appResult.total / APPLICATIONS_PAGE_SIZE))))
          if (appResult.counts) {
            setStats({
              total: appResult.total,
              pending: appResult.counts.pending,
              approved: appResult.counts.approved,
              rejected: appResult.counts.rejected,
              waitlisted: appResult.counts.waitlisted,
              suspended: appResult.counts.suspended,
            })
          }
        }
        setUsers(usersAndProfiles.users)
        setProfilesWithDemographics(usersAndProfiles.profiles)
        setUsersTotalCount(usersAndProfiles.total)
      } else if (tab === 'applications') {
        const page = options?.applicationsPage ?? applicationsPage
        const appResult = await fetchApplications(sort, filter, page, APPLICATIONS_PAGE_SIZE, statusFilter)
        if (loadIdRef.current !== loadId) return
        if (!appResult.permissionDenied) {
          setApplications(appResult.apps)
          setApplicationsTotal(appResult.total)
          setApplicationsPage(prev => Math.min(prev, Math.max(1, Math.ceil(appResult.total / APPLICATIONS_PAGE_SIZE))))
          if (appResult.counts) {
            setStats({
              total: appResult.total,
              pending: appResult.counts.pending,
              approved: appResult.counts.approved,
              rejected: appResult.counts.rejected,
              waitlisted: appResult.counts.waitlisted,
              suspended: appResult.counts.suspended,
            })
          }
        }
      } else if (tab === 'users') {
        const usersAndProfiles = await fetchUsersAndProfiles()
        if (loadIdRef.current !== loadId) return
        setUsers(usersAndProfiles.users)
        setProfilesWithDemographics(usersAndProfiles.profiles)
        setUsersTotalCount(usersAndProfiles.total)
      } else if (tab === 'dashboard') {
        const [activityList, pendingVerificationsList, engagement, reportsAndData] = await Promise.all([
          fetchVerificationActivity(),
          fetchPendingVerifications(),
          fetchEngagementCounts(),
          fetchReportsAndDataRequests(),
        ])
        if (loadIdRef.current !== loadId) return
        setRecentActivity(activityList)
        setPendingVerifications(pendingVerificationsList)
        setTotalThreadCount(engagement.threadCount)
        setTotalMessageCount(engagement.messageCount)
        if (reportsAndData.reports.length) setReports(reportsAndData.reports)
        if (reportsAndData.dataRequests.length) setDataRequests(reportsAndData.dataRequests)
      }
    }

    if (options?.skipOverview) {
      if (activeTab === 'applications') setApplicationsLoading(true)
      await loadTabData(activeTab, thisLoadId)
    }
    if (thisLoadId !== loadIdRef.current) return
    if (options?.skipOverview) setApplicationsLoading(false)
    if (!options?.skipOverview) {
      setRefreshing(false)
      setLastRefreshed(new Date())
    }
    } catch (e) {
      console.error('[admin] loadData failed', e)
      if (!options?.skipOverview) {
        setRefreshing(false)
        setError('Some data failed to load. Use Refresh to try again.')
      }
      if (options?.skipOverview && activeTab === 'applications') setApplicationsLoading(false)
    }
  }, [appSort, appAssignmentFilter, appFilter, applicationsPage, activeTab, handle403])

  // When role changes, if current tab is no longer visible, switch to first visible tab (Phase 11)
  useEffect(() => {
    if (!authorized || !adminRoles.length) return
    const visibleIds = (['overview', 'dashboard', 'applications', 'users', 'verifications', 'inbox', 'reports', 'data-requests', 'risk', 'approvals', 'audit', 'compliance', 'analytics', 'settings'] as const).filter(
      (id) => id === 'analytics' || hasPermission(adminRoles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[id])
    )
    if (visibleIds.length && !visibleIds.includes(activeTab)) setActiveTab(visibleIds[0])
  }, [authorized, adminRoles, activeTab])

  // Lazy-load tab data when switching to a non-overview tab (overview tab is loaded by initial loadData())
  useEffect(() => {
    if (!authorized || activeTab === 'overview') return
    loadData(undefined, { skipOverview: true })
  }, [activeTab, authorized, loadData])

  // Log admin action for audit trail (fire-and-forget). Pass reason for destructive actions.
  async function logAudit(
    action: string,
    targetType?: string,
    targetId?: string,
    details?: Record<string, unknown>,
    reason?: string
  ) {
    try {
      await fetch('/api/admin/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          target_type: targetType,
          target_id: targetId,
          details,
          ...(reason != null && reason.trim() ? { reason: reason.trim() } : {}),
        }),
      })
    } catch (e) {
      console.error('Audit log POST failed', e)
    }
  }

  type AuditFilters = {
    admin_user_id?: string
    action?: string
    target_type?: string
    target_id?: string
    date_from?: string
    date_to?: string
    limit?: number
  }

  async function loadAuditLog(filters?: AuditFilters) {
    setAuditLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(filters?.limit ?? 100))
      if (filters?.admin_user_id) params.set('admin_user_id', filters.admin_user_id)
      if (filters?.action) params.set('action', filters.action)
      if (filters?.target_type) params.set('target_type', filters.target_type)
      if (filters?.target_id) params.set('target_id', filters.target_id)
      if (filters?.date_from) params.set('date_from', filters.date_from)
      if (filters?.date_to) params.set('date_to', filters.date_to)
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<{ entries?: typeof auditLog }>(res, json)
      if (res.ok && data?.entries) setAuditLog(data.entries)
      else setAuditLog([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load audit log.')
      }
    } catch {
      setAuditLog([])
      setError('Failed to load audit log.')
    }
    setAuditLoading(false)
  }
  async function exportAuditCsv(filters?: AuditFilters) {
    const params = new URLSearchParams()
    params.set('format', 'csv')
    params.set('limit', String(Math.min(filters?.limit ?? 1000, 1000)))
    if (filters?.admin_user_id) params.set('admin_user_id', filters.admin_user_id)
    if (filters?.action) params.set('action', filters.action)
    if (filters?.target_type) params.set('target_type', filters.target_type)
    if (filters?.target_id) params.set('target_id', filters.target_id)
    if (filters?.date_from) params.set('date_from', filters.date_from)
    if (filters?.date_to) params.set('date_to', filters.date_to)
    try {
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError('Export failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    }
  }
  async function loadReports(opts?: { sort?: string; filter?: string; status?: string }) {
    setReportsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (opts?.sort) params.set('sort', opts.sort)
      if (opts?.filter) params.set('filter', opts.filter)
      if (opts?.status) params.set('status', opts.status || 'pending')
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<{ reports?: unknown[] }>(res, json)
      if (res.ok && data?.reports) setReports((data.reports ?? []) as Array<Record<string, unknown>>)
      else setReports([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load reports.')
      }
    } catch {
      setReports([])
      setError('Failed to load reports.')
    }
    setReportsLoading(false)
  }
  async function loadDataRequests() {
    setDataRequestsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/data-requests', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<{ requests?: unknown[] }>(res, json)
      if (res.ok && data?.requests) setDataRequests((data.requests ?? []) as Array<Record<string, unknown>>)
      else setDataRequests([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load data requests.')
      }
    } catch {
      setDataRequests([])
      setError('Failed to load data requests.')
    }
    setDataRequestsLoading(false)
  }
  async function loadAppConfig() {
    setConfigLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<Record<string, string>>(res, json)
      if (res.ok && data && typeof data === 'object') setAppConfig(data)
      else setAppConfig({})
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load config.')
      }
    } catch {
      setAppConfig({})
      setError('Failed to load config.')
    }
    setConfigLoading(false)
  }
  async function loadRisk() {
    setRiskLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/risk', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse(res, json)
      if (res.ok && data) setRiskData(data as typeof riskData)
      else setRiskData(null)
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load risk dashboard.')
      }
    } catch {
      setRiskData(null)
      setError('Failed to load risk dashboard.')
    }
    setRiskLoading(false)
  }
  async function loadApprovals() {
    setApprovalsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/approvals?status=pending', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<{ requests?: unknown[] }>(res, json)
      if (res.ok && Array.isArray(data?.requests)) setApprovalsPending((data.requests ?? []) as Array<Record<string, unknown>>)
      else setApprovalsPending([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(err || 'Failed to load approvals')
      }
    } catch {
      setApprovalsPending([])
      setError('Failed to load. Please refresh.')
    }
    setApprovalsLoading(false)
  }
  async function loadBlockedUsers() {
    setBlockedLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/blocked-users', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      const { data, error: err } = parseAdminResponse<{ blocked?: unknown[] }>(res, json)
      if (res.ok && data?.blocked) setBlockedUsers((data.blocked ?? []) as Array<Record<string, unknown>>)
      else setBlockedUsers([])
      if (!res.ok) {
        if (res.status === 403) {
          setError(PERMISSION_DENIED_MESSAGE)
          void handle403()
        } else setError(err || 'Failed to load blocked users.')
      }
    } catch {
      setBlockedUsers([])
      setError('Failed to load. Please refresh.')
    }
    setBlockedLoading(false)
  }

  async function loadCompliance() {
    setComplianceLoading(true)
    setError(null)
    try {
      const [cRes, eRes, gRes, hRes] = await Promise.all([
        fetch('/api/admin/compliance/controls', { credentials: 'include' }),
        fetch('/api/admin/compliance/evidence', { credentials: 'include' }),
        fetch('/api/admin/compliance/governance-reviews', { credentials: 'include' }),
        fetch('/api/admin/compliance/health', { credentials: 'include' }),
      ])
      const cJson = await cRes.json().catch(() => ({}))
      const eJson = await eRes.json().catch(() => ({}))
      const gJson = await gRes.json().catch(() => ({}))
      const hJson = await hRes.json().catch(() => ({}))
      const cData = parseAdminResponse<{ controls?: unknown[] }>(cRes, cJson).data
      const eData = parseAdminResponse<{ evidence?: unknown[] }>(eRes, eJson).data
      const gData = parseAdminResponse<{ reviews?: unknown[] }>(gRes, gJson).data
      const hData = parseAdminResponse<{ overall_score?: number; controls?: unknown[]; last_checked_at?: string | null }>(hRes, hJson).data
      if (cRes.ok && Array.isArray(cData?.controls)) setComplianceControls((cData.controls ?? []) as Array<Record<string, unknown>>)
      else setComplianceControls([])
      if (eRes.ok && Array.isArray(eData?.evidence)) setComplianceEvidence((eData.evidence ?? []) as Array<Record<string, unknown>>)
      else setComplianceEvidence([])
      if (gRes.ok && Array.isArray(gData?.reviews)) setComplianceReviews((gData.reviews ?? []) as Array<Record<string, unknown>>)
      else setComplianceReviews([])
      if (hRes.ok && hData && hData.overall_score !== undefined) setComplianceHealth({ overall_score: hData.overall_score, controls: (hData.controls ?? []) as { control_code: string; status: string; score: number; last_checked_at: string; notes: string | null; }[], last_checked_at: hData.last_checked_at ?? null })
      else setComplianceHealth(null)
      const any403 = cRes.status === 403 || eRes.status === 403 || gRes.status === 403 || hRes.status === 403
      if (any403) void handle403()
      else if (!cRes.ok || !eRes.ok || !gRes.ok || !hRes.ok) setError(parseAdminResponse(cRes, cJson).error || parseAdminResponse(eRes, eJson).error || parseAdminResponse(gRes, gJson).error || parseAdminResponse(hRes, hJson).error || 'Failed to load compliance data')
    } catch {
      setComplianceControls([])
      setComplianceEvidence([])
      setComplianceReviews([])
      setComplianceHealth(null)
      setError('Failed to load. Please refresh.')
    }
    setComplianceLoading(false)
  }

  // When switching to audit/reports/data-requests/settings/risk, load that data
  useEffect(() => {
    if (!authorized) return
    if (activeTab === 'audit') loadAuditLog()
    if (activeTab === 'reports') loadReports()
    if (activeTab === 'data-requests') loadDataRequests()
    if (activeTab === 'settings') loadAppConfig()
    if (activeTab === 'risk') loadRisk()
    if (activeTab === 'approvals') loadApprovals()
    if (activeTab === 'compliance') loadCompliance()
    if (activeTab === 'inbox' && currentUserId) loadInbox()
  }, [authorized, activeTab, currentUserId, loadInbox]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch governance score for sidebar badge after a delay (keeps initial load fast)
  useEffect(() => {
    if (!authorized) return
    const t = setTimeout(() => {
      fetch('/api/admin/compliance/health', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.overall_score === 'number') setGovernanceScore(data.overall_score)
        })
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(t)
  }, [authorized])

  // Keep badge in sync when compliance health is loaded (e.g. from Compliance tab)
  useEffect(() => {
    if (complianceHealth?.overall_score != null) setGovernanceScore(complianceHealth.overall_score)
  }, [complianceHealth?.overall_score])

  // ============================================
  // APPLICATION ACTIONS - All matching iOS
  // ============================================

  async function approveApplication(applicationId: string, updated_at?: string) {
    setActionLoading(applicationId)
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve', ...(updated_at != null ? { updated_at } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (res.ok) {
        await loadData()
        logAudit('application_approve', 'application', applicationId)
        showToast('Application approved', 'success')
      } else {
        if (res.status === 409) setError(data.error || 'Record changed by another moderator')
        else setError(data.error || 'Failed to approve')
        showToast(data.error || 'Failed to approve', 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast(msg || 'Request failed', 'error')
    } finally {
      setActionLoading(null)
      setSelectedApp(null)
    }
  }

  async function rejectApplication(applicationId: string, updated_at?: string) {
    setActionLoading(applicationId)
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject', ...(updated_at != null ? { updated_at } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (res.ok) {
        await loadData()
        logAudit('application_reject', 'application', applicationId)
        showToast('Application rejected', 'success')
      } else {
        if (res.status === 409) setError(data.error || 'Record changed by another moderator')
        else setError(data.error || 'Failed to reject')
        showToast(data.error || 'Failed to reject', 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast(msg || 'Request failed', 'error')
    } finally {
      setActionLoading(null)
      setSelectedApp(null)
    }
  }

  async function waitlistApplication(applicationId: string, updated_at?: string) {
    setActionLoading(applicationId)
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'waitlist', ...(updated_at != null ? { updated_at } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (res.ok) {
        await loadData()
        logAudit('application_waitlist', 'application', applicationId)
        showToast('Application waitlisted', 'success')
      } else {
        if (res.status === 409) setError(data.error || 'Record changed by another moderator')
        else setError(data.error || 'Failed to waitlist')
        showToast(data.error || 'Failed to waitlist', 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast(msg || 'Request failed', 'error')
    } finally {
      setActionLoading(null)
      setSelectedApp(null)
    }
  }

  async function suspendApplication(applicationId: string, updated_at?: string) {
    setActionLoading(applicationId)
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'suspend', ...(updated_at != null ? { updated_at } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (res.ok) {
        await loadData()
        logAudit('application_suspend', 'application', applicationId)
        showToast('Application suspended', 'success')
      } else {
        if (res.status === 409) setError(data.error || 'Record changed by another moderator')
        else setError(data.error || 'Failed to suspend')
        showToast(data.error || 'Failed to suspend', 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast(msg || 'Request failed', 'error')
    } finally {
      setActionLoading(null)
      setSelectedApp(null)
    }
  }

  async function bulkApplicationAction(applicationIds: string[], action: 'approve' | 'reject' | 'waitlist' | 'suspend', reasonFromModal?: string) {
    if (applicationIds.length === 0) return
    const isDestructive = action === 'reject' || action === 'suspend'
    let reason: string | null = reasonFromModal ?? null
    if (isDestructive && reason == null) {
      setConfirmBulk({ open: true, action, applicationIds })
      return
    }
    if (isDestructive && reason != null) reason = reason.trim()
    setActionLoading('bulk')
    try {
      const updated_at_by_id: Record<string, string> = {}
      applicationIds.forEach((id) => {
        const app = applications.find((a) => a.id === id)
        if (app?.updated_at != null && String(app.updated_at).trim()) {
          updated_at_by_id[id] = String(app.updated_at).trim()
        }
      })
      if (Object.keys(updated_at_by_id).length !== applicationIds.length) {
        setError('Some selected applications are missing data. Refresh the list and try again.')
        setActionLoading(null)
        return
      }
      const res = await fetch('/api/admin/bulk-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          application_ids: applicationIds,
          action,
          updated_at_by_id,
          ...(reason ? { reason } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      const { data: payload, error: err } = parseAdminResponse<{ approval_required?: boolean; errors?: string[]; ok?: boolean; count?: number }>(res, json)
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (!payload && err) {
        setError(err)
        return
      }
      if (res.status === 202 && payload?.approval_required) {
        showToast('Approval required. Request submitted.', 'success')
        setSelectedAppIds(new Set())
        loadApprovals()
        return
      }
      if (res.status === 429) {
        setError(err || 'Rate limit exceeded. Try again later.')
        return
      }
      if (res.status === 409) {
        setError(err || 'Some applications were modified by another admin. Refresh and try again.')
        await loadData()
        return
      }
      if (res.status === 207 && payload?.errors && Array.isArray(payload.errors)) {
        const failed = payload.errors.length
        const succeeded = Math.max(0, applicationIds.length - failed)
        setError(`Some items failed. ${succeeded} succeeded, ${failed} failed. ${payload.errors.slice(0, 3).join('; ')}${payload.errors.length > 3 ? '…' : ''}`)
        if (succeeded > 0) {
          await loadData()
          showToast(`${succeeded} application(s) ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'waitlist' ? 'waitlisted' : 'suspended'}`)
        }
        return
      }
      if (!payload?.ok && payload !== null) {
        setError(err || 'Bulk action failed')
      } else {
        setSelectedAppIds(new Set())
        await loadData()
        const actionLabel = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'waitlist' ? 'waitlisted' : 'suspended'
        showToast(`${applicationIds.length} application(s) ${actionLabel}`)
      }
    } catch (e) {
      setError(String(e))
      showToast(String(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ============================================
  // USER ACTIONS - All matching iOS
  // ============================================

  async function toggleVerification(userId: string, currentStatus: boolean) {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_verified: !currentStatus }),
      })
      const json = await res.json().catch(() => ({}))
      const { error: err } = parseAdminResponse(res, json)
      if (!res.ok) {
        setError(err || 'Failed to update verification')
        return
      }
      await loadData()
      showToast('Verification updated')
      logAudit(currentStatus ? 'verification_remove' : 'verification_set', 'user', userId)
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_verified: !currentStatus } : null)
      }
    } catch {
      setError('Failed to update verification')
    }
    setActionLoading(null)
  }

  async function toggleBan(userId: string, currentStatus: boolean) {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_banned: !currentStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Failed to update ban status`)
        return
      }
      await loadData()
      logAudit(currentStatus ? 'user_unban' : 'user_ban', 'user', userId)
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_banned: !currentStatus } : null)
      }
    } catch {
      setError('Failed to update ban status')
    }
    setActionLoading(null)
  }

  async function deleteUser(userId: string, reason: string) {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (res.status === 202 && data.approval_required) {
        showToast('Approval required. Request submitted.', 'success')
        setSelectedUser(null)
        loadApprovals()
      } else if (res.ok) {
        setSelectedUser(null)
        await loadData()
        showToast('User deleted')
      } else {
        setError(data?.error || 'Failed to delete user')
      }
    } catch {
      setError('Failed to delete user')
    }
    setActionLoading(null)
  }

  // ============================================
  // VERIFICATION ACTIONS
  // ============================================

  async function approveVerification(userId: string) {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_verified: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Failed to approve verification`)
        return
      }
      await loadData()
      logAudit('verification_approve', 'user', userId)
    } catch {
      setError('Failed to approve verification')
    }
    setActionLoading(null)
  }

  async function rejectVerification(userId: string) {
    setActionLoading(userId)
    try {
      const pending = pendingVerifications.find((p) => p.user_id === userId)
      if (!pending?.id) {
        setError('Verification request not found')
        setActionLoading(null)
        return
      }
      const res = await fetch(`/api/admin/verification-requests/${encodeURIComponent(pending.id)}/reject`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Failed to reject verification`)
        setActionLoading(null)
        return
      }
      await loadData()
      showToast('Verification updated')
      logAudit('verification_reject', 'user', userId)
    } catch {
      setError('Failed to reject verification')
    }
    setActionLoading(null)
  }

  // ============================================
  // FILTER LOGIC
  // ============================================

  const isPendingStatus = (status: string) => {
    return ['DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'PENDING'].includes(status.toUpperCase())
  }

  const filteredAppsByStatus = appFilter === 'all' ? applications : applications.filter(a => {
    const status = a.status.toUpperCase()
    if (appFilter === 'pending') return isPendingStatus(status)
    if (appFilter === 'approved') return status === 'ACTIVE'
    if (appFilter === 'rejected') return status === 'REJECTED'
    if (appFilter === 'waitlisted') return status === 'WAITLISTED'
    if (appFilter === 'suspended') return status === 'SUSPENDED'
    return true
  })
  const searchLower = appSearch.trim().toLowerCase()
  const filteredApps = searchLower
    ? filteredAppsByStatus.filter(a =>
        (a.name?.toLowerCase() ?? '').includes(searchLower) ||
        (a.username?.toLowerCase() ?? '').includes(searchLower) ||
        (a.email?.toLowerCase() ?? '').includes(searchLower) ||
        (a.niche?.toLowerCase() ?? '').includes(searchLower) ||
        (a.referrer_username?.toLowerCase() ?? '').includes(searchLower)
      )
    : filteredAppsByStatus

  const getFilterCount = (filter: AppFilter) => {
    // Use stats from API (global counts from admin_get_application_counts RPC) for all filters
    // stats.total is the true total, applicationsTotal is just for the current page
    if (filter === 'all') return stats.total > 0 ? stats.total : applicationsTotal
    if (filter === 'pending') return stats.pending
    if (filter === 'approved') return stats.approved
    if (filter === 'rejected') return stats.rejected
    if (filter === 'waitlisted') return stats.waitlisted
    if (filter === 'suspended') return stats.suspended
    return 0
  }

  // ============================================
  // COMPUTED VALUES & ADVANCED METRICS
  // ============================================

  // Prefer overviewCounts (from admin_get_overview_counts RPC) as the source of truth
  const totalUsers = overviewCounts?.totalUsers ?? usersTotalCount ?? users.length
  const verifiedUsersCount = overviewCounts?.verifiedCount ?? users.filter(u => u.is_verified).length
  const newUsersThisWeek = overviewCounts?.newUsersLast7d ?? users.filter(u => {
    if (!u.created_at) return false
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return new Date(u.created_at) > weekAgo
  }).length

  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const newUsersLast24h = overviewCounts?.newUsersLast24h ?? users.filter(u => u.created_at && (now.getTime() - new Date(u.created_at).getTime() < dayMs)).length
  const newUsersLast30d = overviewCounts?.newUsersLast30d ?? users.filter(u => {
    if (!u.created_at) return false
    const d = new Date(u.created_at)
    const monthAgo = new Date(now)
    monthAgo.setDate(monthAgo.getDate() - 30)
    return d > monthAgo
  }).length
  const bannedUsersCount = users.filter(u => u.is_banned).length
  const totalThreads = totalThreadCount ?? conversations.length
  const totalMessages = totalMessageCount ?? conversations.reduce((sum, c) => sum + (c.messages?.length ?? 0), 0)
  const appsTotal = stats.total || applications.length
  const approvalRate = appsTotal > 0 ? Math.round((stats.approved / appsTotal) * 100) : 0
  const rejectionRate = appsTotal > 0 ? Math.round((stats.rejected / appsTotal) * 100) : 0
  const verificationRate = totalUsers > 0 ? Math.round((verifiedUsersCount / totalUsers) * 100) : 0
  const nicheCounts = applications.reduce<Record<string, number>>((acc, a) => {
    const n = (a.niche || 'Other').trim()
    acc[n] = (acc[n] || 0) + 1
    return acc
  }, {})
  const topNiches = Object.entries(nicheCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const signupsByDay = (() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const count = users.filter(u => {
        if (!u.created_at) return false
        const t = new Date(u.created_at).getTime()
        return t >= d.getTime() && t < next.getTime()
      }).length
      days.push({ label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }), count })
    }
    return days
  })()
  const maxSignupsInWeek = Math.max(1, ...signupsByDay.map(d => d.count))
  const appsSubmittedThisWeek = applications.filter(a => {
    const d = new Date(a.application_date)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return d > weekAgo
  }).length
  const avgMessagesPerThread = totalThreads > 0 ? (totalMessages / totalThreads).toFixed(1) : '0'
  const engagementFromExactCounts = totalThreadCount != null && totalMessageCount != null

  // Demographics & locations (from profiles) — by country & city with flags
  const locationsByCountry: LocationByCountry[] = (() => {
    const byCountry = new Map<string, { country: string; countryCode: string; flag: string; cities: Map<string, number> }>()
    for (const p of profilesWithDemographics) {
      const loc = (p.location || '').trim()
      if (!loc) continue
      const { country, countryCode, city, flag } = parseLocation(loc)
      const key = countryCode || country
      if (!byCountry.has(key)) {
        byCountry.set(key, { country, countryCode, flag, cities: new Map() })
      }
      const entry = byCountry.get(key)!
      const cityLabel = city || '—'
      entry.cities.set(cityLabel, (entry.cities.get(cityLabel) ?? 0) + 1)
    }
    return Array.from(byCountry.entries())
      .map(([, v]) => ({
        country: v.country,
        countryCode: v.countryCode,
        flag: v.flag,
        total: Array.from(v.cities.values()).reduce((a, b) => a + b, 0),
        cities: Array.from(v.cities.entries())
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total)
  })()

  // Flat list of cities only (for separate "Cities" section): "City, Country" with count
  const citiesList: { label: string; count: number }[] = (() => {
    const out: { label: string; count: number }[] = []
    for (const row of locationsByCountry) {
      for (const { city, count } of row.cities) {
        const label = city !== '—' ? `${city}, ${row.country}` : row.country
        out.push({ label, count })
      }
    }
    return out.sort((a, b) => b.count - a.count)
  })()

  const usersWithLocationSet = profilesWithDemographics.filter(p => (p.location || '').trim()).length
  const locationSetPct = totalUsers > 0 ? Math.round((usersWithLocationSet / totalUsers) * 100) : 0
  const nicheByUser = profilesWithDemographics.reduce<Record<string, number>>((acc, p) => {
    const n = (p.niche || '').trim() || 'Not set'
    acc[n] = (acc[n] || 0) + 1
    return acc
  }, {})
  const topNichesByUser = Object.entries(nicheByUser)
    .filter(([k]) => k !== 'Not set')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const usersWithNicheSet = profilesWithDemographics.filter(p => (p.niche || '').trim()).length
  const nicheSetPct = totalUsers > 0 ? Math.round((usersWithNicheSet / totalUsers) * 100) : 0
  const referrerCounts = applications.reduce<Record<string, number>>((acc, a) => {
    const r = (a.referrer_username || '').trim() || 'None'
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})
  const topReferrers = Object.entries(referrerCounts)
    .filter(([k]) => k !== 'None')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // 12-week growth (investor view)
  const signupsByWeek = (() => {
    const weeks: { label: string; count: number; weekStart: Date }[] = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - 7 * i)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const count = users.filter(u => {
        if (!u.created_at) return false
        const t = new Date(u.created_at).getTime()
        return t >= weekStart.getTime() && t < weekEnd.getTime()
      }).length
      const label = i === 0 ? 'This week' : `W-${i}`
      weeks.push({ label, count, weekStart })
    }
    return weeks
  })()
  const cumulativeUsersByWeek = (() => {
    let cum = 0
    return signupsByWeek.map(w => {
      cum += w.count
      return { ...w, cumulative: cum }
    })
  })()
  const lastWeekSignups = signupsByWeek[signupsByWeek.length - 2]?.count ?? 0
  const thisWeekSignups = signupsByWeek[signupsByWeek.length - 1]?.count ?? 0
  const growthRateWoW = lastWeekSignups > 0 ? Math.round(((thisWeekSignups - lastWeekSignups) / lastWeekSignups) * 100) : (thisWeekSignups > 0 ? 100 : 0)
  const avgMessagesPerUser = totalUsers > 0 ? (totalMessages / totalUsers).toFixed(1) : '0'
  const _usersWithAtLeastOneMessage = totalThreads > 0 ? '—' : '0'
  const applicationsApprovedLast7d = overviewCounts?.applicationsApprovedLast7d ?? applications.filter(a => {
    const status = (a.status || '').toUpperCase()
    if (status !== 'ACTIVE') return false
    const appDate = new Date(a.application_date)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return appDate > weekAgo
  }).length
  const applicationsSubmittedLast7d = overviewCounts?.applicationsSubmittedLast7d ?? applications.filter(a => {
    const appDate = new Date(a.application_date)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return appDate > weekAgo
  }).length
  const snapshotDate = lastRefreshed || new Date()

  // ============================================
  // RENDER
  // ============================================

  // Gate password screen (when ADMIN_GATE_PASSWORD is set)
  if (gateUnlocked === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center p-2">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Admin access</h1>
            <p className="text-[var(--text-secondary)] text-[15px] mt-2">
              Enter the gate password to continue to the admin panel.
            </p>
          </div>
          <form onSubmit={submitGatePassword} className="space-y-4">
            <div>
              <label htmlFor="gate-password" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                id="gate-password"
                type="password"
                value={gatePassword}
                onChange={(e) => { setGatePassword(e.target.value); setGateError(null) }}
                placeholder="••••••••"
                autoFocus
                className="input-field w-full"
                autoComplete="current-password"
              />
            </div>
            {gateError && (
              <p className="text-[var(--error)] text-sm">{gateError}</p>
            )}
            <button
              type="submit"
              disabled={gateSubmitting || !gatePassword.trim()}
              className="btn-gradient w-full h-12 rounded-xl font-semibold disabled:opacity-50"
            >
              {gateSubmitting ? 'Checking…' : 'Continue'}
            </button>
            <p className="text-center mt-4">
              <button type="button" onClick={() => router.push('/')} className="text-[var(--text-muted)] text-[15px] hover:text-[var(--text)] underline-offset-2 hover:underline">
                Back to app
              </button>
            </p>
          </form>
        </div>
      </div>
    )
  }

  if (gateUnlocked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)] text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)] text-sm">Loading admin panel…</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault()
      setLoginError(null)
      const email = loginEmail.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setLoginError('Please enter a valid email address')
        return
      }
      setLoginLoading(true)
      const supabase = createClient()
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: loginPassword })
        if (signInError) {
          setLoginError(signInError.message)
          setLoginLoading(false)
          return
        }
        const res = await fetch('/api/admin/check', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        const { data } = parseAdminResponse<{ authorized?: boolean }>(res, json)
        if (!data?.authorized) {
          await supabase.auth.signOut()
          setLoginError('This account is not authorized to access the admin panel.')
          setLoginLoading(false)
          return
        }
        await checkAdminAccess()
      } catch {
        setLoginError('Something went wrong. Please try again.')
        setLoginLoading(false)
      }
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] p-8">
        <div className="w-full max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center p-3 mb-6 mx-auto">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Inthecircle Admin</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6 text-center">Sign in with an admin account to continue.</p>
          <div className="card-premium p-6 rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)]">
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm">{error}</div>
            )}
            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <label htmlFor="admin-email-inline" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Email</label>
                <input
                  id="admin-email-inline"
                  type="email"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setLoginError(null) }}
                  className="input-field w-full"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-password-inline" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    id="admin-password-inline"
                    type={loginPasswordVisible ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); setLoginError(null) }}
                    className="input-field w-full pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setLoginPasswordVisible(!loginPasswordVisible)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    aria-label={loginPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    {loginPasswordVisible ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              {loginError && (
                <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm">{loginError}</div>
              )}
              <button type="submit" disabled={loginLoading} className="btn-gradient w-full h-12 rounded-xl font-semibold disabled:opacity-50">
                {loginLoading ? 'Signing in…' : 'Admin Sign In'}
              </button>
            </form>
          </div>
          <p className="text-center mt-6">
            <button type="button" onClick={() => router.push('/')} className="text-[var(--text-muted)] text-[15px] hover:text-[var(--text)] underline-offset-2 hover:underline">
              Back to app
            </button>
          </p>
        </div>
      </div>
    )
  }

  const reportsPendingCount = reports.filter((r: Record<string, unknown>) => r.status === 'pending').length
  const dataRequestsPendingCount = dataRequests.filter((r: Record<string, unknown>) => r.status === 'pending').length
  const riskRedCount = riskData?.open_escalations?.filter((e: Record<string, unknown>) => e.threshold_level === 'red').length ?? 0

  const navItems: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <NavIconLayout /> },
    { id: 'dashboard', label: 'Dashboard', icon: <NavIconChart /> },
    { id: 'applications', label: 'Applications', icon: <NavIconUser />, badge: stats.pending > 0 ? stats.pending : undefined },
    { id: 'users', label: 'Users', icon: <NavIconUsers /> },
    { id: 'verifications', label: 'Verifications', icon: <NavIconCheck />, badge: pendingVerifications.length > 0 ? pendingVerifications.length : undefined },
    { id: 'inbox', label: 'Inbox', icon: <NavIconMessage />, badge: conversations.reduce((sum, c) => sum + c.unreadCount, 0) || undefined },
    { id: 'reports', label: 'Reports', icon: <NavIconReport />, badge: reportsPendingCount > 0 ? reportsPendingCount : undefined },
    { id: 'data-requests', label: 'Data Requests', icon: <NavIconData />, badge: dataRequestsPendingCount > 0 ? dataRequestsPendingCount : undefined },
    { id: 'risk', label: 'Risk', icon: <NavIconRisk />, badge: riskRedCount > 0 ? riskRedCount : undefined },
    { id: 'approvals', label: 'Approvals', icon: <NavIconApproval />, badge: approvalsPending.length > 0 ? approvalsPending.length : undefined },
    { id: 'audit', label: 'Audit Log', icon: <NavIconAudit /> },
    { id: 'compliance', label: 'Compliance', icon: <NavIconCompliance /> },
    { id: 'analytics', label: 'Product Analytics', icon: <NavIconAnalytics /> },
    { id: 'settings', label: 'Settings', icon: <NavIconSettings /> },
  ].filter((item) => {
    if (item.id === 'analytics') return true
    return hasPermission(adminRoles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[item.id as Tab])
  }) as { id: Tab; label: string; icon: React.ReactNode; badge?: number }[]

  return (
    <AdminErrorBoundary>
    <>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex">
      {wrongDeployment === true && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-2 text-center text-sm font-medium">
          Wrong deployment. You may be seeing another project. Run from inthecircle-web repo: <code className="bg-black/20 px-1 rounded">npm run deploy</code>
        </div>
      )}
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
        />
      )}

      {/* Left sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 h-screen w-64 flex-shrink-0
          bg-[var(--surface)] border-r border-[var(--separator)]
          flex flex-col
          transform transition-transform duration-200 ease-out
          md:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-[var(--separator)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-bold text-[var(--text)] tracking-tight">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Admin navigation">
          <ul className="space-y-1">
            {navItems.map(({ id, label, icon, badge }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => { setActiveTab(id); setSidebarOpen(false) }}
                  aria-label={badge != null && badge > 0 ? `${label}, ${badge > 99 ? '99+' : badge} pending` : label}
                  title={badge != null && badge > 0 ? `${badge > 99 ? '99+' : badge} pending applications` : undefined}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-smooth
                    ${activeTab === id
                      ? 'bg-[var(--accent-purple)]/15 text-[var(--text)] border border-[var(--accent-purple)]/30'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-transparent'
                    }
                  `}
                >
                  <span className="w-6 h-6 flex items-center justify-center flex-shrink-0 [&_svg]:w-5 [&_svg]:h-5">{icon}</span>
                  <span className="flex-1">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="px-2 py-0.5 min-w-[20px] text-center text-xs font-semibold rounded-full bg-[var(--error)] text-white" aria-hidden>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-3 border-t border-[var(--separator)] space-y-1">
          {/* Governance health badge (Phase 10) */}
          <div
            className="px-3 py-2 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--separator)] text-center"
            title="Overall control health score (0–100). Based on daily checks: RBAC consistency, audit chain validity, escalation age, session anomalies, overdue data requests. See Compliance tab for details."
          >
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Governance Health</p>
            <p className="text-lg font-bold text-[var(--text)] tabular-nums">
              {governanceScore != null ? governanceScore : '—'} <span className="text-sm font-normal text-[var(--text-muted)]">/ 100</span>
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (signingOut) return
              setSigningOut(true)
              const supabase = createClient()
              await supabase.auth.signOut()
              setSigningOut(false)
              router.push(getAdminBase())
              router.refresh()
            }}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-smooth disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-smooth"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to app
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex-shrink-0 border-b border-[var(--separator)] bg-[var(--bg)]/95 backdrop-blur-xl px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text)] border border-[var(--separator)]"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <nav className="flex items-center gap-2 text-sm text-[var(--text-secondary)] min-w-0" aria-label="Breadcrumb">
            <span className="font-medium text-[var(--text)] truncate">Admin</span>
            <span className="text-[var(--text-muted)] flex-shrink-0">/</span>
            <span className="font-semibold text-[var(--text)] capitalize truncate">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'applications' && 'Applications'}
              {activeTab === 'users' && 'Users'}
              {activeTab === 'verifications' && 'Verifications'}
              {activeTab === 'inbox' && 'Inbox'}
              {activeTab === 'reports' && 'Reports'}
              {activeTab === 'data-requests' && 'Data Requests'}
              {activeTab === 'risk' && 'Risk'}
              {activeTab === 'approvals' && 'Approvals'}
              {activeTab === 'audit' && 'Audit Log'}
              {activeTab === 'compliance' && 'Compliance'}
              {activeTab === 'analytics' && 'Product Analytics'}
              {activeTab === 'settings' && 'Settings'}
            </span>
          </nav>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                Updated {formatTimeAgo(lastRefreshed)}
              </span>
            )}
            <button
              type="button"
              onClick={() => loadData()}
              disabled={refreshing}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-smooth disabled:opacity-50 border border-[var(--separator)]"
              aria-label="Refresh"
            >
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="flex-shrink-0 px-4 md:px-6 pt-4">
            <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => { setError(null); loadData() }} className="font-medium underline hover:no-underline">Retry</button>
                <span className="text-[var(--text-muted)]">|</span>
                <button type="button" onClick={() => setError(null)} className="font-medium underline hover:no-underline">Dismiss</button>
              </span>
            </div>
          </div>
        )}

        {/* Toast (fixed bottom-right) */}
        {toast && (
          <div
            className="fixed bottom-6 right-6 z-[100] max-w-sm transition-all duration-300 ease-out"
            role="status"
            aria-live="polite"
          >
            <div
              className={`rounded-xl border px-4 py-3 shadow-[var(--shadow-card)] ${
                toast.type === 'success'
                  ? 'bg-[var(--success)]/15 border-[var(--success)]/40 text-[var(--success)]'
                  : 'bg-[var(--error)]/15 border-[var(--error)]/40 text-[var(--error)]'
              }`}
            >
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 max-w-6xl w-full mx-auto">
          {activeTab === 'overview' && (
          <OverviewTab
            totalUsers={totalUsers}
            newUsersLast24h={newUsersLast24h}
            newUsersThisWeek={newUsersThisWeek}
            newUsersLast30d={newUsersLast30d}
            growthRateWoW={growthRateWoW}
            activeUsersToday={activeUsersToday}
            activeSessions={activeSessions}
            totalThreads={totalThreads}
            totalMessages={totalMessages}
            avgMessagesPerUser={avgMessagesPerUser}
            verifiedUsersCount={verifiedUsersCount}
            verificationRate={verificationRate}
            stats={stats}
            approvalRate={approvalRate}
            applicationsSubmittedLast7d={applicationsSubmittedLast7d}
            applicationsApprovedLast7d={applicationsApprovedLast7d}
            signupsByWeek={signupsByWeek}
            cumulativeUsersByWeek={cumulativeUsersByWeek}
            locationsByCountry={locationsByCountry}
            citiesList={citiesList}
            topNiches={topNiches}
            snapshotDate={snapshotDate}
            users={users}
            applications={applications}
          />
        )}
          {activeTab === 'dashboard' && (
          <DashboardTab 
            stats={stats}
            totalUsers={totalUsers}
            verifiedUsersCount={verifiedUsersCount}
            newUsersThisWeek={newUsersThisWeek}
            newUsersLast24h={newUsersLast24h}
            newUsersLast30d={newUsersLast30d}
            activeUsersToday={activeUsersToday}
            pendingVerifications={pendingVerifications.length}
            recentActivity={recentActivity}
            bannedUsersCount={bannedUsersCount}
            totalThreads={totalThreads}
            totalMessages={totalMessages}
            approvalRate={approvalRate}
            rejectionRate={rejectionRate}
            verificationRate={verificationRate}
            topNiches={topNiches}
            signupsByDay={signupsByDay}
            maxSignupsInWeek={maxSignupsInWeek}
            appsSubmittedThisWeek={appsSubmittedThisWeek}
            avgMessagesPerThread={avgMessagesPerThread}
            engagementFromExactCounts={engagementFromExactCounts}
            locationsByCountry={locationsByCountry}
            citiesList={citiesList}
            locationSetPct={locationSetPct}
            usersWithLocationSet={usersWithLocationSet}
            topNichesByUser={topNichesByUser}
            nicheSetPct={nicheSetPct}
            topReferrers={topReferrers}
            setActiveTab={setActiveTab}
            onRefreshData={loadData}
          />
        )}
        {activeTab === 'applications' && (
          <ApplicationsTab
            applications={filteredApps}
            allApplications={applications}
            stats={stats}
            filter={appFilter}
            setFilter={setAppFilter}
            getFilterCount={getFilterCount}
            onStatusFilterChange={(f) => {
              setApplicationsPage(1)
              loadData({ appFilter: f }, { applicationsPage: 1 })
            }}
            appSearch={appSearch}
            setAppSearch={setAppSearch}
            appSort={appSort}
            appAssignmentFilter={appAssignmentFilter}
            onSortFilterChange={(sort, filter) => {
              setApplicationsPage(1)
              loadData({ appSort: sort, appAssignmentFilter: filter }, { applicationsPage: 1 })
            }}
            applicationsTotal={applicationsTotal}
            applicationsPage={applicationsPage}
            applicationsPageSize={APPLICATIONS_PAGE_SIZE}
            onApplicationsPageChange={(page) => {
              setApplicationsPage(page)
              loadData(undefined, { skipOverview: true, applicationsPage: page })
            }}
            applicationsLoading={applicationsLoading}
            currentUserId={currentUserId}
            onClaim={async (id: string) => {
              const res = await fetch(`/api/admin/applications/${id}/claim`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadData()
              else if (res.status === 409) setError(data.error || 'Already claimed')
              else setError(data.error || 'Failed to claim')
            }}
            onRelease={async (id: string) => {
              const res = await fetch(`/api/admin/applications/${id}/release`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadData()
              else setError((data?.error as string) || 'Failed to release')
            }}
            selectedAppIds={selectedAppIds}
            setSelectedAppIds={setSelectedAppIds}
            onApprove={(id, updated_at) => approveApplication(id, updated_at)}
            onReject={(id, updated_at) => rejectApplication(id, updated_at)}
            onWaitlist={(id, updated_at) => waitlistApplication(id, updated_at)}
            onSuspend={(id, updated_at) => suspendApplication(id, updated_at)}
            onBulkAction={bulkApplicationAction}
            onExportCsv={() => {
              const headers = ['id', 'user_id', 'name', 'username', 'email', 'niche', 'status', 'application_date', 'referrer_username', 'instagram_username', 'follower_count']
              const rows = applications.map(a => [a.id, a.user_id, a.name ?? '', a.username ?? '', a.email ?? '', a.niche ?? '', (a.status ?? '').toUpperCase(), a.application_date ?? '', a.referrer_username ?? '', a.instagram_username ?? '', a.follower_count ?? ''])
              downloadCSV(`applications_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
            }}
            actionLoading={actionLoading}
            selectedApp={selectedApp}
            setSelectedApp={setSelectedApp}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            onToggleVerify={toggleVerification}
            onToggleBan={toggleBan}
            onDelete={deleteUser}
            canDeleteUser={adminRoles.includes('super_admin')}
            canAnonymizeUser={adminRoles.includes('super_admin')}
            onExportUser={async (userId: string) => {
              try {
                const res = await fetch(`/api/admin/export-user?user_id=${encodeURIComponent(userId)}`, { credentials: 'include' })
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}))
                  throw new Error(typeof data?.error === 'string' ? data.error : 'Export failed')
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `user-export-${userId.slice(0, 8)}.json`
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to export user data')
              }
            }}
            onAnonymizeUser={async (userId: string, reason: string) => {
              try {
                const res = await fetch('/api/admin/anonymize-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ user_id: userId, reason }),
                })
                const data = await res.json().catch(() => ({}))
                if (res.status === 401) {
                  setAuthorized(false)
                  setError('Session expired. Please log in again.')
                  return
                }
                if (res.status === 202 && data.approval_required) {
                  showToast('Approval required. Request submitted.', 'success')
                  setSelectedUser(null)
                  loadApprovals()
                  return
                }
                if (res.status === 429) {
                  setError(data?.error || 'Rate limit exceeded. Try again later.')
                  return
                }
                if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed')
                setSelectedUser(null)
                await loadData()
                showToast('User anonymized')
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
            actionLoading={actionLoading}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
          />
        )}
        {activeTab === 'verifications' && (
          <VerificationsTab
            pendingVerifications={pendingVerifications}
            onApprove={approveVerification}
            onReject={rejectVerification}
            actionLoading={actionLoading}
          />
        )}
        {activeTab === 'inbox' && (
          <InboxTab
            conversations={conversations}
            loading={inboxLoading}
            onRefresh={loadInbox}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            currentUserId={currentUserId}
            senderProfiles={senderProfiles}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab
            reports={reports}
            loading={reportsLoading}
            currentUserId={currentUserId}
            onRefresh={(opts) => loadReports(opts)}
            onClaim={async (reportId: string) => {
              const res = await fetch(`/api/admin/reports/${reportId}/claim`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadReports()
              else if (res.status === 409) setError(data.error || 'Already claimed')
              else setError(data.error || 'Failed to claim')
            }}
            onRelease={async (reportId: string) => {
              const res = await fetch(`/api/admin/reports/${reportId}/release`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadReports()
              else setError((data?.error as string) || 'Failed to release')
            }}
            onResolve={async (reportId: string, status: 'resolved' | 'dismissed', notes?: string, updated_at?: string) => {
              const res = await fetch('/api/admin/reports', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ report_id: reportId, status, notes, updated_at }),
              })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadReports()
              else if (res.status === 409) setError(data.error || 'Record changed by another moderator')
              else setError(data.error || 'Failed to update report')
            }}
          />
        )}
        {activeTab === 'data-requests' && (
          <DataRequestsTab
            requests={dataRequests}
            loading={dataRequestsLoading}
            onRefresh={loadDataRequests}
            onStatusChange={async (requestId: string, status: string, updated_at?: string) => {
              const res = await fetch('/api/admin/data-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ request_id: requestId, status, ...(updated_at != null ? { updated_at } : {}) }),
              })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) await loadDataRequests()
              else if (res.status === 409) setError((data?.error as string) || 'Record changed by another user. Refresh and try again.')
              else setError((data?.error as string) || 'Failed to update request')
            }}
          />
        )}
        {activeTab === 'risk' && (
          <RiskTab
            data={riskData}
            loading={riskLoading}
            onRefresh={loadRisk}
            onResolve={async (escalationId: string, notes?: string) => {
              const res = await fetch(`/api/admin/escalations/${escalationId}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes: notes ?? '' }),
              })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) {
                await loadRisk()
                showToast('Escalation resolved')
              } else setError(data?.error || 'Failed to resolve')
            }}
            canResolve={adminRoles.some(r => ['supervisor', 'compliance', 'super_admin'].includes(r))}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'approvals' && (
          <ApprovalsTab
            requests={approvalsPending}
            loading={approvalsLoading}
            onRefresh={loadApprovals}
            onApprove={async (id: string) => {
              const res = await fetch(`/api/admin/approvals/${id}/approve`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) {
                await loadApprovals()
                await loadData()
                showToast('Approval granted')
              } else if (res.status === 409) {
                showToast('Another approver acted first.', 'error')
                await loadApprovals()
              } else setError(data?.error || 'Failed to approve')
            }}
            onReject={async (id: string) => {
              const res = await fetch(`/api/admin/approvals/${id}/reject`, { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.status === 401) {
                setAuthorized(false)
                setError('Session expired. Please log in again.')
                return
              }
              if (res.ok) {
                await loadApprovals()
                showToast('Request rejected')
              } else if (res.status === 409) {
                showToast('Another approver acted first.', 'error')
                await loadApprovals()
              } else setError(data?.error || 'Failed to reject')
            }}
            canApprove={adminRoles.some(r => ['supervisor', 'super_admin'].includes(r))}
          />
        )}
        {activeTab === 'audit' && (
          <AuditLogTab
            entries={auditLog}
            loading={auditLoading}
            onRefresh={(filters) => loadAuditLog(filters)}
            onExportCsv={exportAuditCsv}
            onVerifyChain={async () => {
              setAuditVerifyLoading(true)
              setAuditVerifyResult(null)
              try {
                const res = await fetch('/api/admin/audit/verify', { credentials: 'include' })
                const data = await res.json().catch(() => ({}))
                if (res.ok) {
                  setAuditVerifyResult(data)
                  return data
                }
                if (res.status === 403) void handle403()
                else setError(data.error || 'Failed to verify chain')
                return null
              } finally {
                setAuditVerifyLoading(false)
              }
            }}
            verifyResult={auditVerifyResult}
            verifyLoading={auditVerifyLoading}
            onCreateSnapshot={async () => {
              setAuditSnapshotLoading(true)
              try {
                const res = await fetch('/api/admin/audit/snapshot', { method: 'POST', credentials: 'include' })
                const data = await res.json().catch(() => ({}))
                if (res.ok) {
                  showToast(data.snapshot_date ? `Snapshot saved: ${data.snapshot_date}` : 'Daily snapshot created')
                  return true
                }
                if (res.status === 403) {
                  void handle403()
                  showToast('You may not have permission to create snapshots.', 'error')
                } else showToast(data.error || 'Failed to create snapshot', 'error')
                return false
              } finally {
                setAuditSnapshotLoading(false)
              }
            }}
            snapshotLoading={auditSnapshotLoading}
          />
        )}
        {activeTab === 'compliance' && (
          <ComplianceTab
            controls={complianceControls}
            evidence={complianceEvidence}
            reviews={complianceReviews}
            health={complianceHealth}
            loading={complianceLoading}
            generatingCode={generatingEvidenceCode}
            onRefresh={loadCompliance}
            onRunHealthCheck={async () => {
              const res = await fetch('/api/admin/compliance/health/run', { method: 'POST', credentials: 'include' })
              if (res.ok) {
                await loadCompliance()
                showToast('Health checks run successfully')
              } else {
                const data = await res.json().catch(() => ({}))
                const msg = data?.details ? `${data?.error || 'Health checks failed'}: ${data.details}` : (data?.error || 'Failed to run health checks')
                setError(msg)
              }
            }}
            onRepairChain={async () => {
              const res = await fetch('/api/admin/audit/repair-chain', { method: 'POST', credentials: 'include' })
              const data = await res.json().catch(() => ({}))
              if (res.ok) {
                showToast(data.rows_updated != null ? `Audit chain repaired (${data.rows_updated} rows)` : 'Audit chain repaired')
                await loadCompliance()
              } else {
                setError(data?.error || 'Failed to repair chain')
              }
            }}
            onGenerateEvidence={async (controlCode: string) => {
              setGeneratingEvidenceCode(controlCode)
              try {
                const res = await fetch('/api/admin/compliance/evidence/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ control_code: controlCode }),
                })
                const data = await res.json().catch(() => ({}))
                if (res.ok) {
                  await loadCompliance()
                  showToast(data.summary ? `Evidence generated: ${data.summary}` : 'Evidence generated')
                } else setError(data?.error || 'Failed to generate evidence')
              } finally {
                setGeneratingEvidenceCode(null)
              }
            }}
            onAddReview={async (reviewPeriod: string, summary: string) => {
              const res = await fetch('/api/admin/compliance/governance-reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ review_period: reviewPeriod, summary: summary || undefined }),
              })
              const data = await res.json().catch(() => ({}))
              if (res.ok) {
                await loadCompliance()
                showToast('Governance review logged')
              } else setError(data?.error || 'Failed to add review')
            }}
            canExportAudit={adminRoles.includes('super_admin') || adminRoles.includes('compliance')}
          />
        )}
        {activeTab === 'analytics' && (
          <AdminProductAnalyticsTab />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            appConfig={appConfig}
            loading={configLoading}
            onRefresh={loadAppConfig}
            onSaveConfig={async (updates: Record<string, string>) => {
              const res = await fetch('/api/admin/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
              })
              const data = await res.json().catch(() => ({}))
              if (res.ok) {
                await loadAppConfig()
                setAppConfig(prev => ({ ...prev, ...updates }))
                setConfigSaveSuccess('Saved')
                showToast('Config saved')
              } else setError((data?.error as string) || 'Failed to save config')
            }}
            configSaveSuccess={configSaveSuccess}
            clearConfigSaveSuccess={() => setConfigSaveSuccess('')}
            blockedUsers={blockedUsers}
            blockedLoading={blockedLoading}
            onLoadBlocked={loadBlockedUsers}
            setActiveTab={setActiveTab}
            adminRoles={adminRoles}
            currentUserId={currentUserId}
            onAnnounce={async (title: string, body: string, segment: string) => {
              const res = await fetch('/api/admin/announce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title, body, segment }),
              })
              const data = await res.json()
              if (data.ok) {
                const msg = data.message ?? 'Announcement queued.'
                setAnnounceSuccess(msg)
                showToast(msg)
              } else setError(data.error ?? 'Failed to send')
            }}
            announceSuccess={announceSuccess}
            clearAnnounceSuccess={() => setAnnounceSuccess('')}
            showToast={showToast}
            on403={handle403}
          />
        )}
        </main>
      </div>
    </div>
    <ConfirmModal
      open={confirmBulk.open}
      title={confirmBulk.action === 'reject' ? 'Reject applications' : 'Suspend applications'}
      description={
        confirmBulk.action === 'reject'
          ? `Reject ${confirmBulk.applicationIds?.length ?? 0} application(s)? This cannot be undone. You must provide a reason.`
          : `Suspend ${confirmBulk.applicationIds?.length ?? 0} application(s)? This cannot be undone. You must provide a reason.`
      }
      requiredInput={{ placeholder: 'Reason (min 5 characters)', minLength: 5, label: 'Reason' }}
      confirmLabel={confirmBulk.action === 'reject' ? 'Reject all' : 'Suspend all'}
      variant="danger"
      onConfirm={(value) => {
        if (confirmBulk.applicationIds && confirmBulk.action && value) {
          bulkApplicationAction(confirmBulk.applicationIds, confirmBulk.action, value)
          setConfirmBulk({ open: false })
        }
      }}
      onCancel={() => setConfirmBulk({ open: false })}
    />
    </>
    </AdminErrorBoundary>
  )
}

// ============================================
// DASHBOARD TAB - Advanced metrics
// ============================================

function DashboardTab({ 
  stats, totalUsers, verifiedUsersCount, newUsersThisWeek, 
  newUsersLast24h, newUsersLast30d,
  activeUsersToday, pendingVerifications, recentActivity,
  bannedUsersCount, totalThreads, totalMessages,
  approvalRate, rejectionRate, verificationRate,
  topNiches, signupsByDay, maxSignupsInWeek,
  appsSubmittedThisWeek, avgMessagesPerThread, engagementFromExactCounts,
  locationsByCountry, citiesList, locationSetPct, usersWithLocationSet,
  topNichesByUser, nicheSetPct, topReferrers,
  setActiveTab,
  onRefreshData,
}: {
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
}) {
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
      {/* Primary KPIs */}
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
        {/* Active Today - inline to guarantee number display */}
        <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3 bg-[#3B82F6]/20 text-[#2563EB]">📈</div>
          <p className="text-3xl font-bold min-h-[1.25em] tabular-nums text-[#3B82F6]">{typeof activeUsersToday === 'number' ? activeUsersToday : 0}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Active Today</p>
          <p className="text-xs mt-2 text-[var(--text-muted)]">Last 24h</p>
        </div>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricPill label="New (24h)" value={newUsersLast24h} color="#8B5CF6" />
        <MetricPill label="Banned" value={bannedUsersCount} color="#EF4444" />
        <MetricPill label="Approval rate" value={`${approvalRate}%`} color="#10B981" />
        <MetricPill label="Conversations" value={totalThreads} color="#3B82F6" />
        <MetricPill label="Messages" value={totalMessages} color="#0EA5E9" />
        <MetricPill label="Apps this week" value={appsSubmittedThisWeek} color="#F59E0B" />
      </div>

      {/* User growth - Last 7 days */}
      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          <span className="w-8 h-8 rounded-lg bg-[#A855F7]/20 flex items-center justify-center text-[#A855F7]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          </span>
          User signups · Last 7 days
        </h3>
        <div className="flex items-end gap-2 h-24">
          {signupsByDay.map((day, _i) => (
            <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className="w-full rounded-t-md min-h-[4px] transition-all duration-300"
                style={{ 
                  height: `${(day.count / maxSignupsInWeek) * 80}px`,
                  backgroundColor: 'var(--accent-purple)',
                  opacity: 0.6 + (day.count / maxSignupsInWeek) * 0.4
                }}
              />
              <span className="text-xs font-medium text-[var(--text)]">{day.count}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Application funnel */}
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </span>
            Application funnel
          </h3>
          <div className="space-y-3">
            <FunnelRow label="Approved" value={stats.approved} pct={approvalRate} color="#10B981" />
            <FunnelRow label="Rejected" value={stats.rejected} pct={rejectionRate} color="#EF4444" />
            <FunnelRow label="Waitlisted" value={stats.waitlisted} pct={stats.total ? Math.round((stats.waitlisted / stats.total) * 100) : 0} color="#A855F7" />
            <FunnelRow label="Suspended" value={stats.suspended} pct={stats.total ? Math.round((stats.suspended / stats.total) * 100) : 0} color="#F97316" />
            <FunnelRow label="Pending" value={stats.pending} pct={stats.total ? Math.round((stats.pending / stats.total) * 100) : 0} color="#F59E0B" />
          </div>
        </div>

        {/* Top niches */}
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.51 0 .955.198 1.377.481L12 3l.623.481A3 3 0 0114.99 3H17v14a2 2 0 01-2 2H9a2 2 0 01-2-2V3z" /></svg>
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

      {/* Demographics & locations: Countries and Cities separate */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-[var(--text-secondary)]">
          {usersWithLocationSet} of {totalUsers} users ({locationSetPct}%) have location set
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center text-[#10B981]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 0010.5-4.065M12 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            Countries
          </h3>
          {locationsByCountry.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No country data yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {locationsByCountry.map((row) => (
                <div key={row.country} className="flex items-center justify-between py-2 border-b border-[var(--separator)] last:border-0">
                  <span className="text-base" aria-hidden>{row.flag}</span>
                  <span className="text-sm text-[var(--text)] flex-1 ml-2 truncate">{row.country}</span>
                  <span className="text-sm font-semibold text-[var(--accent-purple)]">{row.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center text-[#0EA5E9]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            Cities
          </h3>
          {citiesList.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No city data yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {citiesList.map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--separator)] last:border-0">
                  <span className="text-sm text-[var(--text)] truncate flex-1">{label}</span>
                  <span className="text-sm font-semibold text-[var(--accent-purple)] ml-2">{count}</span>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
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

      {/* Top referrers (applications) */}
      {topReferrers.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
            <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </span>
            Top referrers (applications)
          </h3>
          <div className="flex flex-wrap gap-3">
            {topReferrers.map(([username, count]) => (
              <span 
                key={username}
                className="px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm"
              >
                @{username} <span className="font-semibold text-[var(--accent-purple)]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Engagement (inbox) */}
      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          <span className="w-8 h-8 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center text-[#0EA5E9]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </span>
          Engagement
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Conversations</p>
            <p className="text-2xl font-bold text-[var(--text)]">{totalThreads}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total messages</p>
            <p className="text-2xl font-bold text-[var(--text)]">{totalMessages}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Avg per thread</p>
            <p className="text-2xl font-bold text-[var(--text)]">{avgMessagesPerThread}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Verification rate</p>
            <p className="text-2xl font-bold text-[var(--text)]">{verificationRate}%</p>
          </div>
        </div>
      </div>

      {/* Data accuracy note */}
      <div className="bg-[var(--surface)]/50 border border-[var(--separator)] rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-[var(--text-muted)] mt-0.5" aria-hidden>ℹ️</span>
        <div className="text-sm text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text)]">Data accuracy</p>
          <p className="mt-1">
            User counts, applications, verifications, locations and niches come from your live database and are exact.
            {engagementFromExactCounts ? ' Conversation and message totals are exact platform-wide counts.' : ' Conversation and message totals are from the most recent threads until full counts load.'}
            Signups by day are grouped by your browser&apos;s local date.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
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
            {recentActivity.slice(0, 5).map(activity => (
              <div key={activity.id} className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--separator)]">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${activity.color}20`, color: activity.color }}
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

      {/* Quick Actions */}
      <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text)]">
          ⚡ Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction icon="🔔" label="Send Notification" onClick={() => setActiveTab?.('settings')} />
          <QuickAction icon="📤" label="Export Data" onClick={() => setActiveTab?.('overview')} />
          <QuickAction icon="📋" label="View Logs" onClick={() => setActiveTab?.('audit')} />
          <QuickAction icon="🔄" label={cacheRefreshed ? 'Refreshed' : 'Refresh data'} onClick={handleClearCache} />
        </div>
        {cacheRefreshed && <p className="text-sm text-[var(--success)] mt-2">Data refreshed.</p>}
      </div>
    </div>
  )
}

// ============================================
// APPLICATIONS TAB — built from scratch
// ============================================

function ApplicationsTab({
  applications,
  filter,
  setFilter,
  getFilterCount,
  onStatusFilterChange,
  appSearch,
  setAppSearch,
  applicationsTotal,
  applicationsPage,
  applicationsPageSize,
  onApplicationsPageChange,
  applicationsLoading = false,
  onApprove,
  onReject,
  onWaitlist,
  onSuspend,
  onExportCsv,
  actionLoading,
  selectedApp,
  setSelectedApp,
  onClaim,
  onRelease,
  currentUserId,
}: {
  applications: Application[]
  allApplications: Application[]
  stats: Stats
  filter: AppFilter
  setFilter: (f: AppFilter) => void
  getFilterCount: (f: AppFilter) => number
  onStatusFilterChange?: (f: AppFilter) => void
  appSearch: string
  setAppSearch: (s: string) => void
  appSort: string
  appAssignmentFilter: string
  onSortFilterChange: (sort: string, filter: string) => void
  applicationsTotal: number
  applicationsPage: number
  applicationsPageSize: number
  onApplicationsPageChange: (page: number) => void
  applicationsLoading?: boolean
  selectedAppIds: Set<string>
  setSelectedAppIds: Dispatch<SetStateAction<Set<string>>>
  onApprove: (id: string, updated_at?: string) => void
  onReject: (id: string, updated_at?: string) => void
  onWaitlist: (id: string, updated_at?: string) => void
  onSuspend: (id: string, updated_at?: string) => void
  onBulkAction: (ids: string[], action: 'approve' | 'reject' | 'waitlist' | 'suspend') => void
  onExportCsv: () => void
  actionLoading: string | null
  selectedApp: Application | null
  setSelectedApp: (a: Application | null) => void
  currentUserId?: string | null
  onClaim?: (id: string) => Promise<void>
  onRelease?: (id: string) => Promise<void>
}) {
  const totalPages = Math.max(1, Math.ceil(applicationsTotal / applicationsPageSize))
  const statusLabel = (s: string) => {
    const u = (s || '').toUpperCase()
    if (u === 'ACTIVE' || u === 'APPROVED') return 'Approved'
    if (u === 'REJECTED') return 'Rejected'
    if (u === 'WAITLISTED' || u === 'WAITLIST') return 'Waitlisted'
    if (u === 'SUSPENDED') return 'Suspended'
    return 'Pending'
  }
  const isPending = (s: string) => ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes((s || '').toUpperCase())
  const filters: { key: AppFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'waitlisted', label: 'Waitlisted' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'suspended', label: 'Suspended' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold text-[var(--text)]">Applications</h2>
        <button
          type="button"
          onClick={onExportCsv}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Export CSV
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name, email, or username..."
        value={appSearch}
        onChange={e => setAppSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)]"
      />

      <div className="flex flex-wrap gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => (onStatusFilterChange ?? setFilter)(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              filter === key
                ? 'bg-[var(--accent-purple)] text-white'
                : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--separator)]'
            }`}
          >
            {label} ({getFilterCount(key)})
          </button>
        ))}
      </div>

      {applicationsLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!applicationsLoading && applications.length === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)]">No applications found</div>
      )}

      {!applicationsLoading && applications.length > 0 && (
        <>
          <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-xl divide-y divide-[var(--separator)]">
            {applications.map(app => (
              <div
                key={app.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedApp(app)}
                onKeyDown={e => e.key === 'Enter' && setSelectedApp(app)}
                className="p-4 hover:bg-[var(--surface-hover)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)] focus:ring-inset"
              >
                <div className="flex items-center gap-4">
                  <Avatar url={app.profile_image_url} name={app.name || app.username || app.email || ''} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-[var(--text)]">
                        {app.name || app.username || app.email || (app.user_id ? `User ${String(app.user_id).slice(0, 8)}` : 'Unknown')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        (app.status?.toUpperCase() ?? '') === 'ACTIVE' || app.status?.toUpperCase() === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                        app.status?.toUpperCase() === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                        app.status?.toUpperCase() === 'WAITLISTED' || app.status?.toUpperCase() === 'WAITLIST' ? 'bg-purple-500/20 text-purple-400' :
                        app.status?.toUpperCase() === 'SUSPENDED' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {statusLabel(app.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {[app.username && `@${app.username}`, app.email, app.niche].filter(Boolean).join(' · ') || (app.user_id ? `ID: ${String(app.user_id).slice(0, 8)}` : '—')}
                    </p>
                    {(app.instagram_username || app.referrer_username || (app.follower_count != null && app.follower_count > 0)) && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {[app.instagram_username && `Instagram @${app.instagram_username}`, app.referrer_username && `Referred by @${app.referrer_username}`, app.follower_count != null && app.follower_count > 0 && `${Number(app.follower_count).toLocaleString()} followers`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {isPending(app.status) && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      {onClaim && (app.assigned_to == null || (app.assignment_expires_at && new Date(app.assignment_expires_at) < new Date())) && (
                        <button
                          type="button"
                          onClick={() => onClaim(app.id)}
                          disabled={actionLoading === app.id}
                          className="px-3 py-1.5 text-sm font-medium bg-blue-500/15 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-50"
                        >
                          Claim
                        </button>
                      )}
                      {onRelease && app.assigned_to === currentUserId && app.assignment_expires_at && new Date(app.assignment_expires_at) >= new Date() && (
                        <button
                          type="button"
                          onClick={() => onRelease(app.id)}
                          disabled={actionLoading === app.id}
                          className="px-3 py-1.5 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-[var(--separator)] disabled:opacity-50"
                        >
                          Release
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onApprove(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onWaitlist(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-[var(--separator)] disabled:opacity-50"
                      >
                        Waitlist
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(app.id, app.updated_at)}
                        disabled={actionLoading === app.id}
                        className="px-3 py-1.5 text-sm font-medium text-red-400 bg-[var(--surface-hover)] border border-[var(--separator)] rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {app.application_date ? new Date(app.application_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onApplicationsPageChange(applicationsPage - 1)}
                disabled={applicationsPage <= 1}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--text-muted)]">Page {applicationsPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => onApplicationsPageChange(applicationsPage + 1)}
                disabled={applicationsPage >= totalPages}
                className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={() => onApprove(selectedApp.id, selectedApp.updated_at)}
          onReject={() => onReject(selectedApp.id, selectedApp.updated_at)}
          onWaitlist={() => onWaitlist(selectedApp.id, selectedApp.updated_at)}
          onSuspend={() => onSuspend(selectedApp.id, selectedApp.updated_at)}
          isLoading={actionLoading === selectedApp.id}
          canAct
        />
      )}
    </div>
  )
}

function ApplicationDetailModal({
  app,
  onClose,
  onApprove,
  onReject,
  onWaitlist,
  onSuspend: _onSuspend,
  isLoading,
  canAct = true,
}: {
  app: Application
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onSuspend: () => void
  isLoading: boolean
  canAct?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = useModalFocusTrap(dialogRef, onClose)
  const status = (app.status || '').toUpperCase()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const statusLabel = status === 'ACTIVE' || status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : status === 'WAITLISTED' || status === 'WAITLIST' ? 'Waitlisted' : status === 'SUSPENDED' ? 'Suspended' : 'Pending'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && handleClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--background)] rounded-2xl max-w-lg w-full flex flex-col shadow-xl border border-[var(--separator)] overflow-hidden"
        style={{ maxHeight: 'min(90vh, 700px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-detail-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--separator)]">
          <div className="flex items-center gap-3">
            <Avatar url={app.profile_image_url} name={app.name || app.username || app.email || ''} size={48} />
            <div>
              <h2 id="app-detail-title" className="font-semibold text-[var(--text)]">{app.name || app.username || app.email || 'Unknown'}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {[app.username && `@${app.username}`, app.email].filter(Boolean).join(' · ') || (app.user_id ? `ID: ${String(app.user_id).slice(0, 8)}` : '—')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              status === 'ACTIVE' || status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
              status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
              status === 'WAITLISTED' || status === 'WAITLIST' ? 'bg-purple-500/20 text-purple-400' :
              status === 'SUSPENDED' ? 'bg-gray-500/20 text-gray-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {statusLabel}
            </span>
            <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-[var(--text-muted)]">Email</span><p className="text-[var(--text)] truncate">{app.email || '-'}</p></div>
            <div><span className="text-[var(--text-muted)]">Phone</span><p className="text-[var(--text)]">{app.phone || '-'}</p></div>
            <div><span className="text-[var(--text-muted)]">Instagram</span><p className="text-[var(--text)]">{app.instagram_username ? `@${app.instagram_username}` : '-'}</p></div>
            <div><span className="text-[var(--text-muted)]">Followers</span><p className="text-[var(--text)]">{app.follower_count?.toLocaleString() ?? '-'}</p></div>
            {app.niche && <div><span className="text-[var(--text-muted)]">Niche</span><p className="text-[var(--accent-purple)]">{app.niche}</p></div>}
            {app.referrer_username && <div><span className="text-[var(--text-muted)]">Referred by</span><p className="text-[var(--text)]">@{app.referrer_username}</p></div>}
            <div><span className="text-[var(--text-muted)]">Applied</span><p className="text-[var(--text)]">{app.application_date ? new Date(app.application_date).toLocaleDateString() : '-'}</p></div>
          </div>
          {app.bio && <div><h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Bio</h3><p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">{app.bio}</p></div>}
          {app.why_join && <div><h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Why join?</h3><p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">{app.why_join}</p></div>}
          {app.what_to_offer && <div><h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">What to offer</h3><p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">{app.what_to_offer}</p></div>}
          {app.collaboration_goals && <div><h3 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Collaboration goals</h3><p className="text-sm text-[var(--text)] p-3 rounded-lg bg-[var(--surface)]">{app.collaboration_goals}</p></div>}
        </div>

        <div className="p-4 border-t border-[var(--separator)] bg-[var(--surface)] flex gap-2">
          <button type="button" onClick={onApprove} disabled={!canAct || isLoading || status === 'APPROVED' || status === 'ACTIVE'} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40">Approve</button>
          <button type="button" onClick={onWaitlist} disabled={!canAct || isLoading || status === 'WAITLISTED' || status === 'WAITLIST'} className="flex-1 py-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm font-medium text-[var(--text)] hover:bg-[var(--separator)] disabled:opacity-40">Waitlist</button>
          <button type="button" onClick={onReject} disabled={!canAct || isLoading || status === 'REJECTED'} className="flex-1 py-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40">Reject</button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// USERS TAB - Matching iOS
// ============================================

type UserFilter = 'all' | 'verified' | 'banned' | 'new_7d'

function UsersTab({
  users, onToggleVerify, onToggleBan, onDelete, canDeleteUser = true, canAnonymizeUser = true, onExportUser, onAnonymizeUser, actionLoading, selectedUser, setSelectedUser
}: {
  users: User[]
  onToggleVerify: (id: string, current: boolean) => void
  onToggleBan: (id: string, current: boolean) => void
  onDelete: (id: string, reason: string) => void
  canDeleteUser?: boolean
  canAnonymizeUser?: boolean
  onExportUser?: (userId: string) => void | Promise<void>
  onAnonymizeUser?: (userId: string, reason: string) => void | Promise<void>
  actionLoading: string | null
  selectedUser: User | null
  setSelectedUser: (u: User | null) => void
}) {
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  
  const filteredBySearch = users.filter(u => 
    (u.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(search.toLowerCase())
  )
  const filteredUsers = userFilter === 'all'
    ? filteredBySearch
    : userFilter === 'verified'
      ? filteredBySearch.filter(u => u.is_verified)
      : userFilter === 'banned'
        ? filteredBySearch.filter(u => u.is_banned)
        : filteredBySearch.filter(u => {
            if (!u.created_at) return false
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            return new Date(u.created_at) > weekAgo
          })

  return (
    <div className="space-y-4">
      <input
        id="admin-users-search"
        name="users-search"
        type="text"
        placeholder="Search users by name, username, email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input-field w-full"
        aria-label="Search users"
      />
      <div className="flex flex-wrap gap-2">
        {(['all', 'verified', 'banned', 'new_7d'] as UserFilter[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setUserFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
              userFilter === f ? 'bg-[var(--accent-purple)] text-[var(--text)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--separator)]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'verified' ? 'Verified' : f === 'banned' ? 'Banned' : 'New (7d)'}
          </button>
        ))}
      </div>
      
      <div className="text-sm text-[var(--text-muted)]">
        Users ({filteredUsers.length})
      </div>

      <div className="space-y-3">
        {filteredUsers.map(user => (
          <div 
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="bg-[var(--surface)] border border-[var(--separator)] p-4 rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-smooth card-interactive"
          >
            <div className="flex items-center gap-4">
              <Avatar url={user.profile_image_url} name={user.name || '?'} size={48} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">{user.name || 'No name'}</span>
                  {user.is_verified && <span className="text-[var(--verified)]">✓</span>}
                  {user.is_banned && <span className="text-[var(--error)]">🚫</span>}
                </div>
                <p className="text-[var(--text-secondary)] text-sm">@{user.username} • {user.email}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleVerify={() => onToggleVerify(selectedUser.id, selectedUser.is_verified)}
          onToggleBan={() => onToggleBan(selectedUser.id, selectedUser.is_banned)}
          onDelete={(reason) => onDelete(selectedUser.id, reason)}
          canDeleteUser={canDeleteUser}
          canAnonymizeUser={canAnonymizeUser}
          onExportUser={onExportUser}
          onAnonymizeUser={onAnonymizeUser ? (reason) => onAnonymizeUser(selectedUser.id, reason) : undefined}
          isLoading={actionLoading === selectedUser.id}
        />
      )}
    </div>
  )
}

// ============================================
// INBOX TAB - Matching iOS InboxView
// ============================================

function InboxTab({
  conversations, loading, onRefresh, selectedConversation, setSelectedConversation, currentUserId, senderProfiles
}: {
  conversations: ConversationDisplay[]
  loading: boolean
  onRefresh: () => void
  selectedConversation: ConversationDisplay | null
  setSelectedConversation: (c: ConversationDisplay | null) => void
  currentUserId: string | null
  senderProfiles: Record<string, { name: string; username: string }>
}) {
  const [search, setSearch] = useState('')
  const [inboxTab, setInboxTab] = useState<'primary' | 'requests'>('primary')
  
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  
  const searchLower = search.trim().toLowerCase()
  const filteredConversations = !searchLower
    ? conversations
    : conversations.filter(c =>
        c.otherUserName.toLowerCase().includes(searchLower) ||
        c.otherUserUsername.toLowerCase().includes(searchLower) ||
        c.lastMessage.toLowerCase().includes(searchLower) ||
        (c.messages?.some(m => m.content?.toLowerCase().includes(searchLower)) ?? false)
      )

  return (
    <div className="space-y-4">
      {/* Inbox Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">All Messages (Admin View)</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {conversations.length} conversations across all users • {totalUnread} unread
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl disabled:opacity-50 bg-[var(--accent-purple)] text-white hover:opacity-90"
        >
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Primary / Requests tabs (like iOS) */}
      <div className="flex gap-2 p-1 bg-[var(--surface)] rounded-xl">
        <button
          onClick={() => setInboxTab('primary')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            inboxTab === 'primary'
              ? 'bg-[var(--accent-purple)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Primary
        </button>
        <button
          onClick={() => setInboxTab('requests')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            inboxTab === 'requests'
              ? 'bg-[var(--accent-purple)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Requests
        </button>
      </div>

      {/* Search (names, usernames, last message, or any message content) — Primary only */}
      {inboxTab === 'primary' && (
        <div className="relative">
          <input
            id="admin-inbox-search"
            name="inbox-search"
            type="text"
            placeholder="Search by name, @username, or keyword in messages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-[var(--surface)] border border-[var(--separator)] rounded-xl focus:border-[var(--accent-purple)] outline-none"
            aria-label="Search conversations"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
        </div>
      )}

      {/* Requests: Coming soon */}
      {inboxTab === 'requests' ? (
        <div className="text-center py-12 text-[var(--text-muted)] rounded-xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-5xl mb-4">📩</div>
          <p className="font-medium text-[var(--text-secondary)]">Requests</p>
          <p className="text-sm mt-2">Coming soon. Request threads will appear here.</p>
        </div>
      ) : (
        <>
      {/* Conversations List */}
      {loading && conversations.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading conversations...</p>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="text-5xl mb-4">💬</div>
          <p>No conversations yet</p>
          <p className="text-sm mt-2">Messages will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(convo => (
            <ConversationRow
              key={convo.threadId}
              conversation={convo}
              onClick={() => setSelectedConversation(convo)}
              isSelected={selectedConversation?.threadId === convo.threadId}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          currentUserId={currentUserId}
          senderProfiles={senderProfiles}
        />
      )}
    </div>
  )
}

function ConversationRow({ 
  conversation, onClick, isSelected 
}: { 
  conversation: ConversationDisplay
  onClick: () => void
  isSelected: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-[var(--accent-purple)]/20 border border-[var(--accent-purple)]/50' 
          : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar 
            url={conversation.otherUserAvatar} 
            name={conversation.otherUserName} 
            size={52} 
          />
          {conversation.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`font-semibold truncate ${conversation.unreadCount > 0 ? 'text-[var(--text)]' : 'text-[var(--text)]'}`}>
              {conversation.otherUserName}
            </p>
            <span className="text-xs text-[var(--text-muted)] flex-shrink-0 ml-2">
              {formatTimeAgo(conversation.lastMessageTime)}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] truncate">@{conversation.otherUserUsername}</p>
          <p className={`text-sm truncate mt-1 ${conversation.unreadCount > 0 ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'}`}>
            {conversation.lastMessage}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConversationModal({
  conversation, onClose, currentUserId: _currentUserId, senderProfiles
}: {
  conversation: ConversationDisplay
  onClose: () => void
  currentUserId: string | null
  senderProfiles?: Record<string, { name: string; username: string }>
}) {
  // Sort messages oldest first for display
  const sortedMessages = [...conversation.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Group messages by date for better readability
  let lastSenderId = ''

  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = useModalFocusTrap(dialogRef, onClose)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && handleClose()} role="presentation">
      <div ref={dialogRef} className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="conversation-modal-title" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--separator)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-purple)] to-pink-500 flex items-center justify-center text-[var(--text)] font-bold">
              💬
            </div>
            <div>
              <p id="conversation-modal-title" className="font-semibold">{conversation.otherUserName}</p>
              <p className="text-sm text-[var(--text-secondary)]">{conversation.otherUserUsername}</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-[var(--text-secondary)] hover:text-[var(--text)] text-2xl p-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Messages - Admin View: Show sender for each message */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <p>No messages in this conversation</p>
            </div>
          ) : (
            sortedMessages.map((msg, idx) => {
              const showSender = msg.sender_id !== lastSenderId
              lastSenderId = msg.sender_id
              const senderInfo = senderProfiles?.[msg.sender_id]
              const isEven = idx % 2 === 0  // Alternate colors for different senders
              
              return (
                <div key={msg.id} className="space-y-1">
                  {showSender && (
                    <p className="text-xs text-[var(--accent-purple)] font-medium ml-1">
                      {senderInfo?.name || senderInfo?.username || `User ${msg.sender_id.slice(0, 8)}`}
                    </p>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl ${
                      isEven 
                        ? 'bg-[var(--accent-purple)]/20 border border-[var(--accent-purple)]/30' 
                        : 'bg-[var(--surface-hover)] border border-[var(--border-strong)]'
                    }`}
                  >
                    {msg.media_url && (
                      <div className="mb-2">
                        {msg.media_type?.startsWith('image') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={msg.media_url} 
                            alt="Media" 
                            className="rounded-lg max-h-60 object-cover"
                          />
                        ) : msg.media_type?.startsWith('video') ? (
                          <video 
                            src={msg.media_url} 
                            controls 
                            className="rounded-lg max-h-60"
                          />
                        ) : (
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[var(--verified)] underline"
                          >
                            📎 Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <p className="break-words text-[var(--text)]">{msg.content}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs mt-1 text-[var(--text-muted)]">
                      <span>{new Date(msg.created_at).toLocaleString([], { 
                        month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}</span>
                      <span>•</span>
                      <span>{isMessageRead(msg) ? '✓✓ Read' : isMessageDelivered(msg) ? '✓ Delivered' : '○ Sent'}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[var(--separator)] text-center text-sm text-[var(--text-muted)]">
          Admin View • {conversation.messages.length} messages total
        </div>
      </div>
    </div>
  )
}

// ============================================
// SKELETON LOADERS (enterprise-style)
// ============================================

function _AdminSkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] rounded-2xl p-5 shadow-[var(--shadow-soft)] animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)] mb-3" />
      <div className="h-6 w-20 bg-[var(--surface-hover)] rounded mb-2" />
      <div className="h-8 w-16 bg-[var(--surface-hover)] rounded" />
    </div>
  )
}

// ============================================
// COMPONENTS
// ============================================

/** Active today card: always render the number inline so it never appears blank (avoids any StatCard/value edge case). */
function _ActiveTodayCard({ activeUsersToday }: { activeUsersToday: number }) {
  const n = Number.isFinite(Number(activeUsersToday)) ? Number(activeUsersToday) : 0
  const display = String(n)
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3 bg-[#3B82F6]/20 text-[#2563EB]"
        aria-hidden
      >
        📈
      </div>
      <p className="text-3xl font-bold min-h-[1.25em] tabular-nums text-[var(--text)]" aria-label={`Active today: ${display}`}>
        {display}
      </p>
      <p className="text-sm text-[var(--text-secondary)] mt-1">Active today</p>
      <p className="text-xs mt-2 text-[var(--text-muted)]">Logged in last 24h</p>
    </div>
  )
}

function _MiniStat({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] px-4 py-3 rounded-xl flex-shrink-0">
      <p className="text-xs text-[var(--text-secondary)]">{title}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function MetricPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] px-4 py-3 rounded-xl">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}

function FunnelRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--text)]">{label}</span>
      <div className="flex items-center gap-3 flex-1 max-w-[200px]">
        <div className="flex-1 h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
        </div>
        <span className="text-sm font-semibold w-12 text-right" style={{ color }}>{value} ({pct}%)</span>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
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

function _ApplicationCard({
  app,
  onApprove,
  onReject,
  onWaitlist,
  onSuspend: _onSuspend,
  onViewDetails,
  isLoading,
  canAct = true,
  claimedByMe = false,
  claimedByOther = false,
  onClaim,
  onRelease,
  claiming = false,
}: {
  app: Application
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onSuspend: () => void
  onViewDetails: () => void
  isLoading: boolean
  canAct?: boolean
  claimedByMe?: boolean
  claimedByOther?: boolean
  onClaim?: () => void | Promise<void>
  onRelease?: () => void | Promise<void>
  claiming?: boolean
}) {
  const isPending = ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes(app.status.toUpperCase())

  const statusStyles: Record<string, string> = {
    'ACTIVE': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    'APPROVED': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    'PENDING': 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    'SUBMITTED': 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    'PENDING_REVIEW': 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    'DRAFT': 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    'REJECTED': 'bg-red-500/15 text-red-400 border border-red-500/30',
    'WAITLIST': 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    'WAITLISTED': 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    'SUSPENDED': 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  }

  const getCardStatusStyle = (status: string) => {
    return statusStyles[status.toUpperCase()] || 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
  }

  return (
    <div
      className="bg-[var(--surface)] border border-[var(--separator)] p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--accent-purple)]/40 transition-all cursor-pointer group"
      onClick={onViewDetails}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-4 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <Avatar url={app.profile_image_url} name={app.name} size={56} />
          </div>
          <div className="min-w-0 flex-1">
            {/* Primary: name + status */}
            <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
              <p className="font-semibold text-[var(--text)] text-base truncate">{app.name || 'No name'}</p>
              <span className={`text-xs px-2.5 py-1 rounded-lg flex-shrink-0 font-medium ${getCardStatusStyle(app.status)}`}>
                {getStatusLabel(app.status)}
              </span>
              {(claimedByMe || claimedByOther) && (
                <span className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0 bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
                  {claimedByMe ? 'Claimed by you' : 'Claimed'}
                </span>
              )}
            </div>
            {/* Secondary: @username · email */}
            <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--text-secondary)]">
              <span className="font-medium">@{app.username}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="truncate">{app.email}</span>
            </div>
            {/* Tertiary: metadata tags */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {app.niche && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] font-medium">
                  {app.niche}
                </span>
              )}
              {app.referrer_username && (
                <span className="text-xs text-[var(--text-muted)]">
                  Referred by <span className="text-[var(--text-secondary)]">{app.referrer_username}</span>
                </span>
              )}
              {app.follower_count != null && app.follower_count > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {app.follower_count.toLocaleString()} followers
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)]">
                {app.application_date ? new Date(app.application_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {isPending && (
          <div className="flex gap-2 flex-shrink-0 flex-wrap items-center" onClick={e => e.stopPropagation()}>
            {!claimedByMe && !claimedByOther && onClaim && (
              <button type="button" onClick={onClaim} disabled={claiming} className="px-3 py-2 rounded-xl bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-colors border border-blue-500/30 disabled:opacity-50">
                Claim
              </button>
            )}
            {claimedByMe && onRelease && (
              <button type="button" onClick={onRelease} disabled={claiming} className="px-3 py-2 rounded-xl bg-[var(--surface-hover)] text-sm font-medium border border-[var(--separator)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-50">
                Release
              </button>
            )}
            <button
              type="button"
              onClick={onWaitlist}
              disabled={!canAct || isLoading}
              className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-xl hover:bg-purple-500/25 text-sm font-medium disabled:opacity-50 transition-colors border border-purple-500/30"
            >
              Waitlist
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={!canAct || isLoading}
              className="px-3 py-2 bg-red-500/15 text-red-400 rounded-xl hover:bg-red-500/25 text-sm font-medium disabled:opacity-50 transition-colors border border-red-500/30"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={!canAct || isLoading}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const DESTRUCTIVE_REASON_MIN = 5

function UserDetailModal({
  user, onClose, onToggleVerify, onToggleBan, onDelete, canDeleteUser = true, canAnonymizeUser = true, onExportUser, onAnonymizeUser, isLoading
}: {
  user: User
  onClose: () => void
  onToggleVerify: () => void
  onToggleBan: () => void
  onDelete: (reason: string) => void
  canDeleteUser?: boolean
  canAnonymizeUser?: boolean
  onExportUser?: (userId: string) => void | Promise<void>
  onAnonymizeUser?: (reason: string) => void | Promise<void>
  isLoading: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pendingAction, setPendingAction] = useState<'delete' | 'anonymize' | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const handleClose = useModalFocusTrap(dialogRef, () => {
    setPendingAction(null)
    setReasonInput('')
    onClose()
  })
  const submitDestructive = () => {
    const reason = reasonInput.trim()
    if (reason.length < DESTRUCTIVE_REASON_MIN) return
    if (pendingAction === 'delete') onDelete(reason)
    if (pendingAction === 'anonymize' && onAnonymizeUser) onAnonymizeUser(reason)
    setPendingAction(null)
    setReasonInput('')
  }
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && handleClose()} role="presentation">
      <div ref={dialogRef} className="bg-[var(--surface)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="user-detail-title" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 id="user-detail-title" className="text-xl font-bold">User Details</h2>
            <button onClick={handleClose} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-2xl" aria-label="Close">×</button>
          </div>
          
          {pendingAction ? (
            <div className="space-y-4">
              <p className="text-[var(--text-secondary)]">
                {pendingAction === 'delete'
                  ? 'Permanently delete this user and all their data. This cannot be undone.'
                  : 'Anonymize this user? Profile name/username/image will be replaced. This cannot be undone.'}
              </p>
              <label className="block text-sm font-medium text-[var(--text)]">
                Reason (required, min {DESTRUCTIVE_REASON_MIN} characters)
              </label>
              <textarea
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                placeholder="e.g. GDPR erasure request"
                rows={3}
                className="input-field w-full resize-y"
                aria-label="Reason"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setPendingAction(null); setReasonInput('') }} className="px-4 py-2 rounded-xl border border-[var(--separator)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitDestructive}
                  disabled={reasonInput.trim().length < DESTRUCTIVE_REASON_MIN || isLoading}
                  className={`px-4 py-2 rounded-xl font-medium disabled:opacity-50 ${pendingAction === 'delete' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}
                >
                  {pendingAction === 'delete' ? 'Delete User' : 'Anonymize'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <Avatar url={user.profile_image_url} name={user.name || '?'} size={100} />
                <div className="mt-4 flex items-center justify-center gap-2">
                  <h3 className="text-xl font-bold">{user.name || 'No name'}</h3>
                  {user.is_verified && <span className="text-[var(--verified)] text-lg">✓</span>}
                </div>
                <p className="text-[var(--text-secondary)]">@{user.username}</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <DetailRow icon="📧" label="Email" value={user.email || 'No email'} />
                <DetailRow icon="📅" label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'} />
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={onToggleVerify}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <span className={user.is_verified ? 'text-[var(--verified)]' : 'text-[var(--text-secondary)]'}>
                    {user.is_verified ? '✓' : '○'}
                  </span>
                  <span>{user.is_verified ? 'Remove Verification' : 'Verify User'}</span>
                </button>
                
                <button
                  onClick={onToggleBan}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <span className={user.is_banned ? 'text-green-400' : 'text-yellow-400'}>
                    {user.is_banned ? '✓' : '🚫'}
                  </span>
                  <span>{user.is_banned ? 'Unban User' : 'Ban User'}</span>
                </button>

                {onExportUser && (
                  <button
                    onClick={() => onExportUser(user.id)}
                    className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)]"
                  >
                    <span>📤</span>
                    <span>Export user data (GDPR)</span>
                  </button>
                )}
                {canAnonymizeUser && onAnonymizeUser && (
                  <button
                    onClick={() => setPendingAction('anonymize')}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-4 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <span>🔒</span>
                    <span>Anonymize user</span>
                  </button>
                )}
                {canDeleteUser && (
                <button
                  onClick={() => setPendingAction('delete')}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 disabled:opacity-50"
                >
                  <span>🗑️</span>
                  <span>Delete User</span>
                </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] rounded-xl">
      <span>{icon}</span>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

function _getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE': return 'bg-green-500/20 text-green-400'
    case 'REJECTED': return 'bg-red-500/20 text-red-400'
    case 'WAITLISTED': return 'bg-purple-500/20 text-purple-400'
    case 'SUSPENDED': return 'bg-orange-500/20 text-orange-400'
    default: return 'bg-yellow-500/20 text-yellow-400'
  }
}

function getStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE': return 'Approved'
    case 'PENDING': return 'Pending'
    case 'SUBMITTED': return 'Pending'
    case 'PENDING_REVIEW': return 'In Review'
    case 'DRAFT': return 'Draft'
    case 'REJECTED': return 'Rejected'
    case 'WAITLISTED': return 'Waitlisted'
    case 'SUSPENDED': return 'Suspended'
    default: return status ? (status.charAt(0) + status.slice(1).toLowerCase()) : 'Pending'
  }
}