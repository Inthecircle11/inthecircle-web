'use client'

import { useEffect, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getAdminBase } from '@/lib/admin'
import { Logo } from '@/components/Logo'
import { hasPermission, ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import type { AdminPermission } from '@/lib/admin-rbac'

// ============================================
// TYPES - Matching iOS Admin exactly
// ============================================

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
}

interface Application {
  id: string
  user_id: string
  name: string
  username: string
  email: string
  profile_image_url: string | null
  bio: string
  niche: string
  application_date: string
  status: string
  review_notes: string | null
  referrer_username: string | null
  why_join: string | null
  what_to_offer: string | null
  collaboration_goals: string | null
  phone: string | null
  instagram_username: string | null
  follower_count: number | null
  updated_at?: string
  assigned_to?: string | null
  assigned_at?: string | null
  assignment_expires_at?: string | null
}

interface User {
  id: string
  name: string | null  // DB returns 'name' not 'full_name'
  username: string | null
  email: string | null
  profile_image_url: string | null  // DB returns 'profile_image_url' not 'avatar_url'
  is_verified: boolean
  is_banned: boolean
  created_at: string | null
}

interface VerificationRequest {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  requested_at: string
}

interface RecentActivity {
  id: string
  type: string
  title: string
  subtitle: string
  timestamp: Date
  color: string
}

// Inbox types - matching iOS MatchesStore
interface InboxThread {
  id: string
  user1_id: string | null
  user2_id: string | null
  created_at: string
  updated_at: string
}

interface InboxMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  seen_at: string | null
  delivered_at: string | null
  created_at: string
}

// Helper functions for message status
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

interface LocationByCountry {
  country: string
  countryCode: string
  flag: string
  total: number
  cities: { city: string; count: number }[]
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

interface ConversationDisplay {
  threadId: string
  otherUserId: string
  otherUserName: string
  otherUserUsername: string
  otherUserAvatar: string | null
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  messages: InboxMessage[]
}

type Tab = 'overview' | 'dashboard' | 'applications' | 'users' | 'verifications' | 'inbox' | 'reports' | 'data-requests' | 'risk' | 'approvals' | 'audit' | 'compliance' | 'settings'
type AppFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'suspended'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])
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
  const [profilesWithDemographics, setProfilesWithDemographics] = useState<{ id: string; location: string | null; niche: string | null }[]>([])
  const [pendingVerifications, setPendingVerifications] = useState<VerificationRequest[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [activeUsersToday, setActiveUsersToday] = useState<number | null>(null)
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
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateUnlocked])

  // Deployment identity check: ensure we're on inthecircle-web (not wrong project)
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/identity', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized])

  // Gate: check if password screen is needed (optional ADMIN_GATE_PASSWORD)
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/gate', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setGateUnlocked(data.unlocked === true)
      })
      .catch(() => {
        // On network/API failure, fail open so admin check can run (don't show gate form)
        if (!cancelled) setGateUnlocked(true)
      })
    return () => { cancelled = true }
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
      const data = await res.json()
      if (data.ok) {
        setGateUnlocked(true)
        setGatePassword('')
      } else {
        setGateError(data.error || 'Incorrect password')
      }
    } catch {
      setGateError('Something went wrong')
    }
    setGateSubmitting(false)
  }

  async function checkAdminAccess() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setAuthorized(false)
      setLoading(false)
      setError('Please log in with your admin account to access this panel.')
      return
    }

    const res = await fetch('/api/admin/check', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      setAuthorized(false)
      setError('Session expired. Please log in again.')
      setLoading(false)
      return
    }
    const authorized = !!data?.authorized
    const roles = Array.isArray(data?.roles) ? data.roles : []
    
    if (!authorized) {
      setAuthorized(false)
      setLoading(false)
      setLoginError('This account is not authorized to access the admin panel. Add your email or user ID to ADMIN_EMAILS or ADMIN_USER_IDS in the server environment.')
      return
    }

    setAuthorized(true)
    setAdminRoles(roles)
    setCurrentUserId(user.id)
    setLoading(false)
    void loadData()
    // Inbox loaded only when user opens Inbox tab (see activeTab useEffect)
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
      const visibleIds = (['overview', 'dashboard', 'applications', 'users', 'verifications', 'inbox', 'reports', 'data-requests', 'risk', 'approvals', 'audit', 'compliance', 'settings'] as const).filter(
        (id) => hasPermission(roles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[id])
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

    // Run all overview requests in parallel (was 4–6s sequential)
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
        const timeoutId = setTimeout(() => controller.abort(), 6000)
        const res = await fetch('/api/admin/overview-stats', { credentials: 'include', signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.status === 403) return { stats: { total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 }, activeToday: null, activeSessions: null, overviewCounts: null, permissionDenied: true }
        if (!res.ok) return null
        const data = await res.json()
        return {
          stats: data.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0, suspended: 0 },
          activeToday: data.activeToday ?? null,
          activeSessions: data.activeSessions ?? null,
          overviewCounts: data.overviewCounts ?? null,
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
    ): Promise<{ apps: Application[]; total: number; counts: { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } | null; permissionDenied?: boolean }> => {
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
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            return { apps: data, total: data.length, counts: null, permissionDenied: false }
          }
          const apps = (data?.applications ?? []) as Application[]
          const total = typeof data?.total === 'number' ? data.total : apps.length
          const counts = data?.counts && typeof data.counts.pending === 'number' ? data.counts as { pending: number; approved: number; rejected: number; waitlisted: number; suspended: number } : null
          return { apps, total, counts, permissionDenied: false }
        }
        if (res.status !== 403) {
          try {
            const { data } = await supabase.rpc('admin_get_applications')
            const arr = data || []
            return { apps: arr, total: arr.length, counts: null, permissionDenied: false }
          } catch {
            return { apps: [], total: 0, counts: null, permissionDenied: false }
          }
        }
        return { apps: [], total: 0, counts: null, permissionDenied: false }
      } catch (e) {
        console.error('Applications error:', e)
        try {
          const { data } = await supabase.rpc('admin_get_applications')
          const arr = data || []
          return { apps: arr, total: arr.length, counts: null, permissionDenied: false }
        } catch {
          return { apps: [], total: 0, counts: null, permissionDenied: false }
        }
      }
    }

    const fetchUsersAndProfiles = async (): Promise<{ users: User[]; profiles: { id: string; location: string | null; niche: string | null }[] }> => {
      try {
        const { data: usersData } = await supabase.rpc('admin_get_all_users')
        const users = (usersData || []) as User[]
        if (users.length === 0) return { users, profiles: [] }
        const ids = users.map((u) => u.id)
        const { data: profilesData } = await supabase.from('profiles').select('id, location, niche').in('id', ids)
        return { users, profiles: (profilesData as { id: string; location: string | null; niche: string | null }[]) || [] }
      } catch (e) {
        console.error('Users error:', e)
        return { users: [], profiles: [] }
      }
    }

    const fetchActiveToday = async (): Promise<number | null> => {
      try {
        const { data } = await supabase.rpc('admin_get_active_today_count')
        return data?.[0]?.active_count ?? null
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
        const { data } = await supabase.rpc('admin_get_recent_verification_activity')
        if (!data) return []
        return data.map((item: { status: string; username?: string; reviewed_at: string }, index: number) => ({
          id: `activity-${index}`,
          type: item.status === 'approved' ? 'verification_approved' : 'verification_rejected',
          title: item.status === 'approved' ? 'Verification approved' : 'Verification rejected',
          subtitle: `@${item.username ?? 'unknown'}`,
          timestamp: new Date(item.reviewed_at),
          color: item.status === 'approved' ? '#10B981' : '#EF4444',
        }))
      } catch {
        return []
      }
    }

    const fetchPendingVerifications = async () => {
      try {
        const { data } = await supabase
          .from('verification_requests')
          .select('id, user_id, created_at, profiles(username, profile_image_url)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        if (!data) return []
        return data.map((v: { id: string; user_id: string; created_at: string; profiles?: { username?: string; profile_image_url?: string } }) => ({
          id: v.id,
          user_id: v.user_id,
          username: v.profiles?.username || 'Unknown',
          profile_image_url: v.profiles?.profile_image_url,
          requested_at: v.created_at,
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
      // Run overview and tab data in parallel so numbers and list load together
      const [overviewRes] = await Promise.all([
        fetchOverviewStats(),
        loadTabData(activeTab, thisLoadId),
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
        setActiveUsersToday(null)
        setOverviewCounts(null)
      } else if (overview) {
        setStats(overview.stats)
        setActiveUsersToday(overview.activeToday ?? null)
        setActiveSessions(overview.activeSessions)
        if (overview.overviewCounts) {
          setOverviewCounts(overview.overviewCounts)
          setTotalThreadCount(overview.overviewCounts.totalThreadCount)
          setTotalMessageCount(overview.overviewCounts.totalMessageCount)
        }
      } else {
        // Overview failed or timed out: load active sessions/today (applications already set by loadTabData)
        const [activeSessionsData, activeTodayCount] = await Promise.all([
          fetchActiveSessions(),
          fetchActiveToday(),
        ])
        setActiveSessions(activeSessionsData)
        if (activeTodayCount !== null) setActiveUsersToday(activeTodayCount)
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

    if (options?.skipOverview) await loadTabData(activeTab, thisLoadId)
    if (thisLoadId !== loadIdRef.current) return
    if (!options?.skipOverview) {
      setRefreshing(false)
      setLastRefreshed(new Date())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSort, appAssignmentFilter, applicationsPage, activeTab, handle403])

  // When role changes, if current tab is no longer visible, switch to first visible tab (Phase 11)
  useEffect(() => {
    if (!authorized || !adminRoles.length) return
    const visibleIds = (['overview', 'dashboard', 'applications', 'users', 'verifications', 'inbox', 'reports', 'data-requests', 'risk', 'approvals', 'audit', 'compliance', 'settings'] as const).filter(
      (id) => hasPermission(adminRoles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[id])
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.entries) setAuditLog(data.entries)
      else setAuditLog([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data.error || 'Failed to load audit log.')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.reports) setReports(data.reports)
      else setReports([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data.error || 'Failed to load reports.')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.requests) setDataRequests(data.requests)
      else setDataRequests([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data.error || 'Failed to load data requests.')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && typeof data === 'object') setAppConfig(data)
      else setAppConfig({})
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data?.error || 'Failed to load config.')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data) setRiskData(data)
      else setRiskData(null)
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data?.error || 'Failed to load risk dashboard.')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.requests)) setApprovalsPending(data.requests)
      else setApprovalsPending([])
      if (!res.ok) {
        if (res.status === 403) void handle403()
        else setError(data?.error || 'Failed to load approvals')
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.blocked) {
        setBlockedUsers(data.blocked)
      } else {
        setBlockedUsers([])
        if (res.status === 403) {
          setError(PERMISSION_DENIED_MESSAGE)
          void handle403()
        } else {
          setError(data?.error || 'Failed to load blocked users.')
        }
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
      const cData = await cRes.json().catch(() => ({}))
      const eData = await eRes.json().catch(() => ({}))
      const gData = await gRes.json().catch(() => ({}))
      const hData = await hRes.json().catch(() => ({}))
      if (cRes.ok && Array.isArray(cData.controls)) setComplianceControls(cData.controls)
      else setComplianceControls([])
      if (eRes.ok && Array.isArray(eData.evidence)) setComplianceEvidence(eData.evidence)
      else setComplianceEvidence([])
      if (gRes.ok && Array.isArray(gData.reviews)) setComplianceReviews(gData.reviews)
      else setComplianceReviews([])
      if (hRes.ok && hData.overall_score !== undefined) setComplianceHealth({ overall_score: hData.overall_score, controls: hData.controls ?? [], last_checked_at: hData.last_checked_at ?? null })
      else setComplianceHealth(null)
      const any403 = cRes.status === 403 || eRes.status === 403 || gRes.status === 403 || hRes.status === 403
      if (any403) void handle403()
      else if (!cRes.ok || !eRes.ok || !gRes.ok || !hRes.ok) setError(cData?.error || eData?.error || gData?.error || hData?.error || 'Failed to load compliance data')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, activeTab, currentUserId, loadInbox])

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

  async function bulkApplicationAction(applicationIds: string[], action: 'approve' | 'reject' | 'waitlist' | 'suspend') {
    if (applicationIds.length === 0) return
    const isDestructive = action === 'reject' || action === 'suspend'
    let reason: string | null = null
    if (isDestructive) {
      const actionLabel = action === 'reject' ? 'Reject' : 'Suspend'
      if (!confirm(`${actionLabel} ${applicationIds.length} application(s)? This cannot be undone. You must provide a reason.`)) return
      reason = window.prompt('Reason (required, min 5 characters):')
      if (!reason || reason.trim().length < 5) {
        setError('Reason required (min 5 characters) for reject/suspend')
        return
      }
      reason = reason.trim()
    }
    setActionLoading('bulk')
    try {
      const res = await fetch('/api/admin/bulk-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          application_ids: applicationIds,
          action,
          ...(reason ? { reason } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setAuthorized(false)
        setError('Session expired. Please log in again.')
        return
      }
      if (!data || typeof data !== 'object') {
        setError('Invalid response from server. Please try again.')
        return
      }
      if (res.status === 202 && data.approval_required) {
        showToast('Approval required. Request submitted.', 'success')
        setSelectedAppIds(new Set())
        loadApprovals()
        return
      }
      if (res.status === 429) {
        setError(data.error || 'Rate limit exceeded. Try again later.')
        return
      }
      if (res.status === 207 && data.errors && Array.isArray(data.errors)) {
        const failed = data.errors.length
        const succeeded = Math.max(0, applicationIds.length - failed)
        setError(`Some items failed. ${succeeded} succeeded, ${failed} failed. ${data.errors.slice(0, 3).join('; ')}${data.errors.length > 3 ? '…' : ''}`)
        if (succeeded > 0) {
          await loadData()
          showToast(`${succeeded} application(s) ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'waitlist' ? 'waitlisted' : 'suspended'}`)
        }
        return
      }
      if (!data.ok) setError(data.errors?.join(', ') || data.error || 'Bulk action failed')
      else {
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
    const supabase = createClient()
    const { error } = await supabase.rpc('admin_set_verification', { 
      p_target_user_id: userId, 
      p_is_verified: !currentStatus 
    })
    if (error) setError(`Failed to update verification: ${error.message}`)
    else {
      await loadData()
      showToast('Verification updated')
      logAudit(currentStatus ? 'verification_remove' : 'verification_set', 'user', userId)
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_verified: !currentStatus } : null)
      }
    }
    setActionLoading(null)
  }

  async function toggleBan(userId: string, currentStatus: boolean) {
    setActionLoading(userId)
    const supabase = createClient()
    const { error } = await supabase.rpc('admin_set_banned', { 
      p_target_user_id: userId, 
      p_is_banned: !currentStatus 
    })
    if (error) setError(`Failed to update ban status: ${error.message}`)
    else {
      await loadData()
      logAudit(currentStatus ? 'user_unban' : 'user_ban', 'user', userId)
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_banned: !currentStatus } : null)
      }
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
    const supabase = createClient()
    const { error } = await supabase.rpc('admin_set_verification', { 
      p_target_user_id: userId, 
      p_is_verified: true 
    })
    if (error) setError(`Failed to approve verification: ${error.message}`)
    else {
      await loadData()
      logAudit('verification_approve', 'user', userId)
    }
    setActionLoading(null)
  }

  async function rejectVerification(userId: string) {
    setActionLoading(userId)
    const supabase = createClient()
    const { error } = await supabase
      .from('verification_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) setError(`Failed to reject verification: ${error.message}`)
    else {
      await loadData()
      showToast('Verification updated')
      logAudit('verification_reject', 'user', userId)
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
    if (filter === 'all') return applicationsTotal > 0 ? applicationsTotal : applications.length
    // Use global counts from API (stats) when available
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

  const totalUsers = overviewCounts?.totalUsers ?? users.length
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
        const { authorized: isAdmin } = await res.json()
        if (!isAdmin) {
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
    { id: 'settings', label: 'Settings', icon: <NavIconSettings /> },
  ].filter((item) => hasPermission(adminRoles as Array<'viewer' | 'moderator' | 'supervisor' | 'compliance' | 'super_admin'>, TAB_PERMISSION[item.id as Tab])) as { id: Tab; label: string; icon: React.ReactNode; badge?: number }[]

  return (
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
                      ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] border border-[var(--accent-purple)]/30'
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
              <button type="button" onClick={() => setError(null)} className="font-medium underline hover:no-underline">Dismiss</button>
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
  )
}

// ============================================
// OVERVIEW TAB - Investor / executive summary
// ============================================

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const line = (row: (string | number | null | undefined)[]) => row.map(escape).join(',')
  const csv = [headers.join(','), ...rows.map(line)].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function OverviewTab({
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
}: {
  totalUsers: number
  newUsersLast24h: number
  newUsersThisWeek: number
  newUsersLast30d: number
  growthRateWoW: number
  activeUsersToday: number | null
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
}) {
  const maxWeekly = Math.max(1, ...signupsByWeek.map(w => w.count))

  const onExportUsers = () => {
    const headers = ['id', 'email', 'name', 'username', 'is_verified', 'is_banned', 'created_at']
    const rows = users.map(u => [
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
      'id', 'user_id', 'name', 'username', 'email', 'niche', 'status', 'application_date',
      'referrer_username', 'instagram_username', 'follower_count',
    ]
    const rows = applications.map(a => [
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
            Data as of {snapshotDate instanceof Date ? snapshotDate.toLocaleString() : new Date(snapshotDate).toLocaleString()}
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

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total users" value={totalUsers} icon="👥" color="#A855F7" trend={`+${newUsersLast30d} last 30d`} />
        <StatCard title="Active today" value={activeUsersToday ?? '—'} icon="📈" color="#3B82F6" trend="Logged in last 24h" />
        <StatCard title="Conversations" value={totalThreads} icon="💬" color="#8B5CF6" trend={`${totalMessages} messages · ${avgMessagesPerUser} avg/user`} />
        <StatCard title="Verified" value={verifiedUsersCount} icon="✓" color="#10B981" trend={`${verificationRate}% of users`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="New (24h)" value={newUsersLast24h} icon="🆕" color="#06B6D4" trend="Signups" />
        <StatCard title="New (7d)" value={newUsersThisWeek} icon="📅" color="#F59E0B" trend={growthRateWoW !== 0 ? `${growthRateWoW > 0 ? '+' : ''}${growthRateWoW}% WoW` : 'This week'} />
        <StatCard title="Applications (7d)" value={applicationsSubmittedLast7d} icon="📋" color="#EC4899" trend={`${applicationsApprovedLast7d} approved · ${approvalRate}% rate`} />
        <StatCard title="Pending review" value={stats.pending} icon="⏳" color="#F59E0B" trend={`${stats.approved} approved · ${stats.rejected} rejected`} />
      </div>

      {/* Concurrent active users (last 15 min) */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Concurrent active users</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Users with an active session in the last {activeSessions?.minutes ?? 15} minutes (who they are right now).
        </p>
        {activeSessions === null ? (
          <p className="text-sm text-[var(--text-muted)]">Loading… or run migration <code className="text-xs bg-[var(--surface-hover)] px-1 rounded">20260225000001_get_active_sessions.sql</code></p>
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
                  {activeSessions.users.map((u) => (
                    <tr key={u.user_id} className="border-b border-[var(--separator)]/50">
                      <td className="py-2 pr-4 text-[var(--text)]">
                        {u.name || u.username ? `${u.name || ''} ${u.username ? `@${u.username}` : ''}`.trim() || '—' : '—'}
                      </td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">{u.email ?? '—'}</td>
                      <td className="py-2 text-[var(--text-muted)]">
                        {u.last_active_at ? new Date(u.last_active_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 12-week growth */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--separator)] p-4 md:p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">12-week signup growth</h3>
        <div className="h-64 flex items-end gap-1">
          {signupsByWeek.map((w, _i) => (
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

      {/* Top niches, Countries, Cities — separate sections */}
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
                  <span className="text-base" aria-hidden>{row.flag}</span>
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
  activeUsersToday: number | null
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
          value={verifiedUsersCount} 
          icon="✓" 
          color="#10B981"
          trend={`${verificationRate}% of total · ${pendingVerifications} pending`}
        />
        <StatCard 
          title="Active Today" 
          value={activeUsersToday ?? '—'} 
          icon="📈" 
          color="#3B82F6"
          trend={activeUsersToday !== null ? "Last 24h" : "Loading..."}
        />
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
// APPLICATIONS TAB - Matching iOS with ALL fields
// ============================================

function ApplicationsTab({
  applications, allApplications: _allApplications, stats: _stats, filter, setFilter, getFilterCount,
  onStatusFilterChange,
  appSearch, setAppSearch, appSort, appAssignmentFilter, onSortFilterChange,
  applicationsTotal, applicationsPage, applicationsPageSize, onApplicationsPageChange,
  selectedAppIds, setSelectedAppIds,
  onApprove, onReject, onWaitlist, onSuspend, onBulkAction, onExportCsv,
  actionLoading, selectedApp, setSelectedApp,
  currentUserId = null,
  onClaim,
  onRelease,
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
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(applicationsTotal / applicationsPageSize))
  const paginatedApps = applications
  const now = new Date()
  const isClaimedByMe = (a: Application): boolean => {
    const assignedTo = a.assigned_to
    const expiresAt = a.assignment_expires_at
    return !!(assignedTo === currentUserId && expiresAt && new Date(expiresAt) >= now)
  }
  const isClaimedByOther = (a: Application): boolean => {
    const assignedTo = a.assigned_to
    const expiresAt = a.assignment_expires_at
    if (!assignedTo) return false
    if (expiresAt && new Date(expiresAt) < now) return false
    return assignedTo !== currentUserId
  }
  const canActOnApp = (a: Application) => isPending(a) && !isClaimedByOther(a)
  const isPending = (a: Application) => ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes(a.status?.toUpperCase() ?? '')
  const pendingInSelection = paginatedApps.filter(a => selectedAppIds.has(a.id) && isPending(a)).map(a => a.id)
  const toggleSelect = (id: string) => {
    setSelectedAppIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedAppIds.size >= paginatedApps.length) setSelectedAppIds(new Set())
    else setSelectedAppIds(new Set(paginatedApps.map(a => a.id)))
  }

  return (
    <div className="space-y-4">
      {/* Search + Export on one line; filters only (counts in tabs = single source of truth) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            id="admin-applications-search"
            name="applications-search"
            type="text"
            placeholder="Search by name, username, email, niche, referrer..."
            value={appSearch}
            onChange={e => setAppSearch(e.target.value)}
            className="input-field w-full"
            aria-label="Search applications"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">Search applies to current page only.</p>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-[var(--text)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
          title="Exports current page only. Use pagination to export other pages."
        >
          Export CSV
        </button>
      </div>

      {/* Filter tabs only — counts here, no duplicate stat row */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'rejected', 'waitlisted', 'suspended'] as AppFilter[]).map(f => (
          <button
            type="button"
            key={f}
            onClick={() => (onStatusFilterChange ?? setFilter)(f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f 
                ? 'bg-[var(--accent-purple)] text-white shadow-[var(--shadow-soft)]' 
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-[var(--separator)]'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({getFilterCount(f)})
          </button>
        ))}
      </div>
      {/* Assignment + Sort for moderation queue */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[var(--text-muted)]">Assignment:</span>
        {['all', 'unassigned', 'assigned_to_me'].map(f => (
          <button key={f} type="button" onClick={() => onSortFilterChange(appSort, f)} className={`px-3 py-1.5 rounded-lg text-sm ${appAssignmentFilter === f ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)]'}`}>{f === 'assigned_to_me' ? 'Assigned to me' : f}</button>
        ))}
        <span className="text-xs text-[var(--text-muted)] ml-2">Sort:</span>
        {['overdue', 'oldest', 'assigned_to_me'].map(s => (
          <button key={s} type="button" onClick={() => onSortFilterChange(s, appAssignmentFilter)} className={`px-3 py-1.5 rounded-lg text-sm ${appSort === s ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)]'}`}>{s === 'assigned_to_me' ? 'My items first' : s}</button>
        ))}
      </div>

      {/* Bulk action bar */}
      {pendingInSelection.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/30">
          <span className="text-sm font-medium text-[var(--text)]">{pendingInSelection.length} selected (pending)</span>
          <button type="button" onClick={() => onBulkAction(pendingInSelection, 'approve')} disabled={actionLoading === 'bulk'} className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 disabled:opacity-50">Approve all</button>
          <button type="button" onClick={() => onBulkAction(pendingInSelection, 'reject')} disabled={actionLoading === 'bulk'} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50">Reject all</button>
          <button type="button" onClick={() => onBulkAction(pendingInSelection, 'waitlist')} disabled={actionLoading === 'bulk'} className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50">Waitlist all</button>
          <button type="button" onClick={() => setSelectedAppIds(new Set())} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">Clear</button>
        </div>
      )}

      {/* List header: count + select all + pagination in one compact row */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1 border-b border-[var(--separator)]">
        <div className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
          <span className="font-medium text-[var(--text)]">{applicationsTotal} applications</span>
          {applications.length > 0 && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <button type="button" onClick={toggleSelectAll} className="text-[var(--accent-purple)] hover:underline">
                {selectedAppIds.size >= paginatedApps.length ? 'Deselect all (this page)' : 'Select all (this page)'}
              </button>
            </>
          )}
        </div>
        {applicationsTotal > applicationsPageSize && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Showing {(applicationsPage - 1) * applicationsPageSize + 1}–{Math.min(applicationsPage * applicationsPageSize, applicationsTotal)} of {applicationsTotal}</span>
            <span className="text-[var(--separator)]">|</span>
            <button type="button" onClick={() => onApplicationsPageChange(applicationsPage - 1)} disabled={applicationsPage <= 1} className="px-2 py-1 rounded bg-[var(--surface)] border border-[var(--separator)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
              Prev
            </button>
            <span>Page {applicationsPage} of {totalPages}</span>
            <button type="button" onClick={() => onApplicationsPageChange(applicationsPage + 1)} disabled={applicationsPage >= totalPages} className="px-2 py-1 rounded bg-[var(--surface)] border border-[var(--separator)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        )}
      </div>
      
      {applications.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">📄</div>
          <p className="text-[var(--text-secondary)] font-medium">
            {applicationsTotal === 0
              ? 'No applications'
              : `No ${filter === 'all' ? 'applications' : filter} on this page`}
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {applicationsTotal === 0
              ? 'New applications will appear here.'
              : 'Try another page or change the status filter above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedApps.map(app => (
            <div key={app.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedAppIds.has(app.id)}
                onChange={() => toggleSelect(app.id)}
                aria-label={`Select ${app.name || app.username}`}
                className="rounded border-[var(--separator)] text-[var(--accent-purple)] focus:ring-[var(--accent-purple)] flex-shrink-0 mt-0"
              />
              <div className="flex-1 min-w-0">
                <ApplicationCard
                  app={app}
                  onApprove={() => onApprove(app.id, app.updated_at)}
                  onReject={() => onReject(app.id, app.updated_at)}
                  onWaitlist={() => onWaitlist(app.id, app.updated_at)}
                  onSuspend={() => onSuspend(app.id, app.updated_at)}
                  onViewDetails={() => setSelectedApp(app)}
                  isLoading={actionLoading === app.id}
                  canAct={canActOnApp(app)}
                  claimedByMe={isClaimedByMe(app)}
                  claimedByOther={isClaimedByOther(app)}
                  onClaim={onClaim ? async () => { setClaimingId(app.id); await onClaim(app.id); setClaimingId(null) } : undefined}
                  onRelease={onRelease ? async () => { setClaimingId(app.id); await onRelease(app.id); setClaimingId(null) } : undefined}
                  claiming={claimingId === app.id}
                />
              </div>
            </div>
          ))}
        </div>
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
          canAct={canActOnApp(selectedApp)}
          canActReason={!canActOnApp(selectedApp) ? (isClaimedByOther(selectedApp) ? 'Claimed by another moderator.' : 'This application is not pending.') : undefined}
        />
      )}
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
// VERIFICATIONS TAB - Matching iOS
// ============================================

function VerificationsTab({
  pendingVerifications, onApprove, onReject, actionLoading
}: {
  pendingVerifications: VerificationRequest[]
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
  actionLoading: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-muted)]">
        Pending Verifications ({pendingVerifications.length})
      </div>

      {pendingVerifications.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="text-5xl mb-4">✓</div>
          <p>No pending verification requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingVerifications.map(v => (
            <div key={v.id} className="bg-[var(--surface)] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar url={v.profile_image_url} name={v.username} size={48} />
                  <div>
                    <p className="font-semibold">@{v.username}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Requested {formatTimeAgo(new Date(v.requested_at))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onReject(v.user_id)}
                    disabled={actionLoading === v.user_id}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => onApprove(v.user_id)}
                    disabled={actionLoading === v.user_id}
                    className="px-4 py-2 bg-green-500 text-[var(--text)] rounded-xl hover:bg-green-600 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// REPORTS TAB
// ============================================

type ReportFilter = 'all' | 'pending' | 'resolved' | 'dismissed'
type ReportAssignmentFilter = 'all' | 'unassigned' | 'assigned_to_me'
type ReportSort = 'overdue' | 'oldest' | 'assigned_to_me'
function ReportsTab({
  reports,
  loading,
  currentUserId = null,
  onRefresh,
  onClaim,
  onRelease,
  onResolve,
}: {
  reports: Array<Record<string, unknown>>
  loading: boolean
  currentUserId?: string | null
  onRefresh: (opts?: { sort?: string; filter?: string; status?: string }) => void
  onClaim?: (reportId: string) => Promise<void>
  onRelease?: (reportId: string) => Promise<void>
  onResolve: (reportId: string, status: 'resolved' | 'dismissed', notes?: string, updated_at?: string) => Promise<void>
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<ReportAssignmentFilter>('all')
  const [sort, setSort] = useState<ReportSort>('overdue')
  const pending = reports.filter(r => r.status === 'pending')
  let filtered = reportFilter === 'all' ? reports : reports.filter(r => String(r.status) === reportFilter)
  const now = new Date()
  const isClaimedByOther = (r: Record<string, unknown>): boolean => {
    const assignedTo = r.assigned_to as string | null | undefined
    const expiresAt = r.assignment_expires_at as string | null | undefined
    if (!assignedTo) return false
    if (expiresAt && new Date(expiresAt) < now) return false
    return assignedTo !== currentUserId
  }
  const isClaimedByMe = (r: Record<string, unknown>): boolean => {
    const assignedTo = r.assigned_to as string | null | undefined
    const expiresAt = r.assignment_expires_at as string | null | undefined
    return !!(assignedTo === currentUserId && expiresAt && new Date(expiresAt) >= now)
  }
  if (assignmentFilter === 'unassigned') filtered = filtered.filter(r => !r.assigned_to || (r.assignment_expires_at && new Date(r.assignment_expires_at as string) < now))
  else if (assignmentFilter === 'assigned_to_me' && currentUserId) filtered = filtered.filter(isClaimedByMe)
  const handleRefresh = () => onRefresh({ sort, filter: assignmentFilter, status: reportFilter === 'all' ? undefined : reportFilter })
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    onRefresh({ sort, filter: assignmentFilter, status: reportFilter === 'all' ? undefined : reportFilter })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, assignmentFilter, reportFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">{reports.length} reports · {pending.length} pending</p>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[var(--text-muted)]">Status:</span>
          {(['all', 'pending', 'resolved', 'dismissed'] as ReportFilter[]).map(f => (
            <button key={f} type="button" onClick={() => setReportFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${reportFilter === f ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)] text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>{f}</button>
          ))}
          <span className="text-xs text-[var(--text-muted)] ml-2">Assignment:</span>
          {(['all', 'unassigned', 'assigned_to_me'] as ReportAssignmentFilter[]).map(f => (
            <button key={f} type="button" onClick={() => setAssignmentFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${assignmentFilter === f ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)] text-[var(--text-secondary)]'}`}>{f === 'assigned_to_me' ? 'Assigned to me' : f}</button>
          ))}
          <span className="text-xs text-[var(--text-muted)]">Sort:</span>
          {(['overdue', 'oldest', 'assigned_to_me'] as ReportSort[]).map(s => (
            <button key={s} type="button" onClick={() => setSort(s)} className={`px-3 py-1.5 rounded-lg text-sm ${sort === s ? 'bg-[var(--accent-purple)] text-white' : 'bg-[var(--surface)] border border-[var(--separator)]'}`}>{s === 'assigned_to_me' ? 'My items first' : s}</button>
          ))}
        </div>
        <button type="button" onClick={handleRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {loading && reports.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
              <div className="h-5 w-3/4 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/2 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">⚠️</div>
          <p className="text-[var(--text-secondary)] font-medium">{reports.length === 0 ? 'No reports yet' : `No ${reportFilter} reports`}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{reports.length === 0 ? 'When users report content, they will appear here.' : 'Try another filter.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: Record<string, unknown>) => {
            const claimedByOther = r.status === 'pending' && isClaimedByOther(r)
            const claimedByMe = isClaimedByMe(r)
            const canAct = r.status === 'pending' && !claimedByOther
            return (
            <div key={String(r.id)} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)]">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    Report by @{String(r.reporter_username ?? r.reporter_id ?? '?')} → reported @{String(r.reported_username ?? r.reported_user_id ?? '?')}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{String(r.reason ?? 'No reason')}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(String(r.created_at)).toLocaleString()}</p>
                  {(claimedByMe || !!(r.assigned_to && r.assignment_expires_at && new Date(r.assignment_expires_at as string) >= now)) && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      {claimedByMe ? 'Claimed by you' : 'Claimed by another moderator'}
                    </span>
                  )}
                  <span className={`inline-block mt-2 ml-1 text-xs px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--surface-hover)]'}`}>
                    {String(r.status)}
                  </span>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2 flex-wrap">
                    {!claimedByMe && !claimedByOther && onClaim && (
                      <button type="button" disabled={claimingId === r.id} onClick={async () => { setClaimingId(String(r.id)); await onClaim(String(r.id)); setClaimingId(null) }} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm">Claim</button>
                    )}
                    {claimedByMe && onRelease && (
                      <button type="button" disabled={claimingId === r.id} onClick={async () => { setClaimingId(String(r.id)); await onRelease(String(r.id)); setClaimingId(null) }} className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm">Release</button>
                    )}
                    <button type="button" disabled={!canAct || resolvingId === r.id} onClick={async () => { setResolvingId(String(r.id)); await onResolve(String(r.id), 'dismissed', undefined, r.updated_at as string); setResolvingId(null) }} className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm">Dismiss</button>
                    <button type="button" disabled={!canAct || resolvingId === r.id} onClick={async () => { setResolvingId(String(r.id)); await onResolve(String(r.id), 'resolved', undefined, r.updated_at as string); setResolvingId(null) }} className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

// ============================================
// APPROVALS TAB — 4-Eyes Approval Workflow
// ============================================

function ApprovalsTab({
  requests,
  loading,
  onRefresh,
  onApprove,
  onReject,
  canApprove,
}: {
  requests: Array<Record<string, unknown>>
  loading: boolean
  onRefresh: () => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  canApprove: boolean
}) {
  const [actingId, setActingId] = useState<string | null>(null)
  const now = new Date()
  const formatRemaining = (expiresAt: string) => {
    const exp = new Date(expiresAt)
    if (exp <= now) return 'Expired'
    const min = Math.floor((exp.getTime() - now.getTime()) / 60000)
    if (min < 60) return `${min} min left`
    const h = Math.floor(min / 60)
    return `${h}h ${min % 60}m left`
  }
  const actionLabel = (action: string) => {
    if (action === 'user_delete') return 'Delete user'
    if (action === 'user_anonymize') return 'Anonymize user'
    if (action === 'bulk_reject') return 'Bulk reject applications'
    if (action === 'bulk_suspend') return 'Bulk suspend applications'
    return action
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Pending approvals</h2>
        <button type="button" onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
              <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/2 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-center text-[var(--text-muted)] text-sm">No pending approvals</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: Record<string, unknown>) => {
            const id = String(r.id)
            const expiresAt = String(r.expires_at ?? '')
            const isExpired = expiresAt && new Date(expiresAt) <= now
            return (
              <div key={id} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text)]">{actionLabel(String(r.action ?? ''))}</p>
                  <p className="text-sm text-[var(--text-secondary)]">Target: {String(r.target_type)} · {String(r.target_id)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Reason: {String(r.reason ?? '—')}</p>
                  <p className="text-xs text-[var(--text-muted)]">Requested at: {new Date(String(r.requested_at)).toLocaleString()} · {formatRemaining(expiresAt)}</p>
                </div>
                {canApprove && !isExpired && (
                  <div className="flex gap-2">
                    <button type="button" disabled={actingId === id} onClick={async () => { setActingId(id); await onReject(id); setActingId(null) }} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium disabled:opacity-50">Reject</button>
                    <button type="button" disabled={actingId === id} onClick={async () => { setActingId(id); await onApprove(id); setActingId(null) }} className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium disabled:opacity-50">Approve</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// RISK TAB — Incident Control Layer
// ============================================

function RiskTab({
  data,
  loading,
  onRefresh,
  onResolve,
  canResolve,
  onNavigateToTab,
}: {
  data: {
    pending_applications: number
    pending_reports: number
    overdue_data_requests: number
    open_escalations: Array<Record<string, unknown>>
    last_escalation_time: string | null
  } | null
  loading: boolean
  onRefresh: () => void
  onResolve: (escalationId: string, notes?: string) => Promise<void>
  canResolve: boolean
  onNavigateToTab: (tab: Tab) => void
}) {
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
        <button type="button" onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {data?.last_escalation_time && (
        <p className="text-xs text-[var(--text-muted)]">Last escalation: {new Date(data.last_escalation_time).toLocaleString()}</p>
      )}
      {/* KPI cards with links to queues */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button type="button" onClick={() => onNavigateToTab('applications')} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors">
          <p className="text-2xl font-bold text-[var(--text)]">{pendingApps}</p>
          <p className="text-sm text-[var(--text-secondary)]">Pending applications</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
        <button type="button" onClick={() => onNavigateToTab('reports')} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors">
          <p className="text-2xl font-bold text-[var(--text)]">{pendingReports}</p>
          <p className="text-sm text-[var(--text-secondary)]">Pending reports</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
        <button type="button" onClick={() => onNavigateToTab('data-requests')} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-left hover:border-[var(--accent-purple)]/30 transition-colors">
          <p className="text-2xl font-bold text-[var(--text)]">{overdueData}</p>
          <p className="text-sm text-[var(--text-secondary)]">Overdue data requests</p>
          <p className="text-xs text-[var(--accent-purple)] mt-1">View queue →</p>
        </button>
      </div>
      {/* Open escalations */}
      <div>
        <h3 className="text-base font-medium text-[var(--text)] mb-3">
          Open escalations
          {hasRed && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">Red</span>}
        </h3>
        {loading && openEscalations.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
                <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
                <div className="h-4 w-1/3 bg-[var(--surface-hover)] rounded" />
              </div>
            ))}
          </div>
        ) : openEscalations.length === 0 ? (
          <div className="py-8 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-center text-[var(--text-muted)] text-sm">No open escalations</div>
        ) : (
          <div className="space-y-3">
            {openEscalations.map((e: Record<string, unknown>) => {
              const id = String(e.id)
              const tab = queueTab(e.metric_name as string)
              const isRed = e.threshold_level === 'red'
              return (
                <div key={id} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--text)]">{metricLabel(e.metric_name as string)}</p>
                    <p className="text-sm text-[var(--text-secondary)]">Value: {String(e.metric_value)} · {new Date(String(e.created_at)).toLocaleString()}</p>
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${isRed ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {isRed ? 'Red' : 'Yellow'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tab && (
                      <button type="button" onClick={() => onNavigateToTab(tab)} className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm">View queue</button>
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

// ============================================
// DATA REQUESTS TAB
// ============================================

function DataRequestsTab({
  requests,
  loading,
  onRefresh,
  onStatusChange,
}: {
  requests: Array<Record<string, unknown>>
  loading: boolean
  onRefresh: () => void
  onStatusChange: (requestId: string, status: string, updated_at?: string) => Promise<void>
}) {
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const getStatus = (r: Record<string, unknown>) => draftStatus[String(r.id)] ?? String(r.status)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{requests.length} requests</p>
        <button type="button" onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] animate-pulse">
              <div className="h-5 w-2/3 bg-[var(--surface-hover)] rounded mb-2" />
              <div className="h-4 w-1/3 bg-[var(--surface-hover)] rounded" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">📥</div>
          <p className="text-[var(--text-secondary)] font-medium">No data requests yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Export or deletion requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: Record<string, unknown>) => {
            const id = r.id != null ? String(r.id) : null
            const current = id ? (getStatus(r)) : String(r.status)
            const unchanged = id ? current === String(r.status) : true
            return (
              <div key={id ?? `req-${r.user_id}-${r.created_at}`} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--separator)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text)]">{String(r.name ?? r.username ?? r.user_id)} · {String(r.request_type)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(String(r.created_at)).toLocaleString()}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--surface-hover)]'}`}>{String(r.status)}</span>
                  {id == null && <p className="text-xs text-amber-400 mt-1">No id — add primary key to data_requests to update status.</p>}
                </div>
                {id != null && (
                  <div className="flex items-center gap-2">
                    <select
                      id={`data-request-status-${id}`}
                      name="data_request_status"
                      value={current}
                      onChange={e => setDraftStatus(prev => ({ ...prev, [id]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--separator)] text-sm"
                      aria-label="Status"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <button
                      type="button"
                      disabled={unchanged || updatingId === id}
                      onClick={async () => {
                        setUpdatingId(id)
                        // Pass updated_at when available for conflict-safe PATCH (C3).
                        const updatedAt = (r as { updated_at?: string }).updated_at
                        await onStatusChange(id, current, updatedAt)
                        setDraftStatus(prev => { const next = { ...prev }; delete next[id]; return next })
                        setUpdatingId(null)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingId === id ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// AUDIT LOG TAB
// ============================================

type AuditFilters = {
  admin_user_id?: string
  action?: string
  target_type?: string
  target_id?: string
  date_from?: string
  date_to?: string
  limit?: number
}
type AuditSortKey = 'created_at' | 'admin_email' | 'action' | 'target'
function AuditLogTab({
  entries,
  loading,
  onRefresh,
  onExportCsv,
  onVerifyChain,
  verifyResult,
  verifyLoading,
  onCreateSnapshot,
  snapshotLoading,
}: {
  entries: Array<{ id: string; action: string; target_type: string | null; target_id: string | null; admin_email: string | null; created_at: string; details?: unknown }>
  loading: boolean
  onRefresh: (filters?: AuditFilters) => void
  onExportCsv?: (filters?: AuditFilters) => void
  onVerifyChain?: () => Promise<{ chain_valid: boolean; snapshot_valid?: boolean; first_corrupted_id?: string; rows_checked?: number } | null>
  verifyResult?: { chain_valid: boolean; snapshot_valid?: boolean; first_corrupted_id?: string; snapshot_date?: string; rows_checked?: number } | null
  verifyLoading?: boolean
  onCreateSnapshot?: () => Promise<boolean>
  snapshotLoading?: boolean
}) {
  const [sortKey, setSortKey] = useState<AuditSortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterAction, setFilterAction] = useState('')
  const [filterTargetType, setFilterTargetType] = useState('')
  const [filterTargetId, setFilterTargetId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const getFilters = (): AuditFilters => {
    const f: AuditFilters = { limit: 100 }
    if (filterAction.trim()) f.action = filterAction.trim()
    if (filterTargetType.trim()) f.target_type = filterTargetType.trim()
    if (filterTargetId.trim()) f.target_id = filterTargetId.trim()
    if (filterDateFrom.trim()) f.date_from = filterDateFrom.trim()
    if (filterDateTo.trim()) f.date_to = filterDateTo.trim()
    return f
  }
  const toggleSort = (key: AuditSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'created_at' ? 'desc' : 'asc') }
  }
  const sorted = [...entries].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    if (sortKey === 'created_at') { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime() }
    else if (sortKey === 'admin_email') { av = (a.admin_email ?? ''); bv = (b.admin_email ?? '') }
    else if (sortKey === 'action') { av = a.action; bv = b.action }
    else { av = (a.target_type && a.target_id ? `${a.target_type}:${a.target_id}` : ''); bv = (b.target_type && b.target_id ? `${b.target_type}:${b.target_id}` : '') }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">Who did what and when</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onRefresh(getFilters())} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {onExportCsv && (
            <button type="button" onClick={() => onExportCsv(getFilters())} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors">
              Export CSV
            </button>
          )}
          {onVerifyChain && (
            <button type="button" onClick={onVerifyChain} disabled={verifyLoading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors">
              {verifyLoading ? 'Verifying…' : 'Verify audit chain'}
            </button>
          )}
          {onCreateSnapshot && (
            <button type="button" onClick={onCreateSnapshot} disabled={snapshotLoading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--surface-hover)] transition-colors">
              {snapshotLoading ? 'Creating…' : 'Create daily snapshot'}
            </button>
          )}
        </div>
      </div>
      {verifyResult != null && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--separator)]">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${verifyResult.chain_valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            Chain: {verifyResult.chain_valid ? 'Valid' : 'Invalid'}
          </span>
          {verifyResult.snapshot_valid !== undefined && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${verifyResult.snapshot_valid ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              Snapshot: {verifyResult.snapshot_valid ? 'Valid' : 'Missing or mismatch'}
            </span>
          )}
          {verifyResult.first_corrupted_id && (
            <span className="text-sm text-[var(--text-muted)]">First corrupted: {verifyResult.first_corrupted_id}</span>
          )}
          {verifyResult.rows_checked != null && (
            <span className="text-xs text-[var(--text-muted)]">Rows checked: {verifyResult.rows_checked}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <input type="text" placeholder="Action (partial)" value={filterAction} onChange={e => setFilterAction(e.target.value)} className="input-field text-sm" aria-label="Filter by action" />
        <input type="text" placeholder="Target type" value={filterTargetType} onChange={e => setFilterTargetType(e.target.value)} className="input-field text-sm" aria-label="Filter by target type" />
        <input type="text" placeholder="Target ID" value={filterTargetId} onChange={e => setFilterTargetId(e.target.value)} className="input-field text-sm" aria-label="Filter by target ID" />
        <input type="date" placeholder="From" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input-field text-sm" aria-label="Date from" />
        <input type="date" placeholder="To" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input-field text-sm" aria-label="Date to" />
      </div>
      {loading && entries.length === 0 ? (
        <AdminSkeletonTable rows={8} />
      ) : entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-4xl mb-3 opacity-60">📋</div>
          <p className="text-[var(--text-secondary)] font-medium">No audit entries yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Admin actions will be logged here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--separator)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--separator)]">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="p-3">
                  <button type="button" onClick={() => toggleSort('created_at')} className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors">
                    Time {sortKey === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button type="button" onClick={() => toggleSort('admin_email')} className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors">
                    Admin {sortKey === 'admin_email' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button type="button" onClick={() => toggleSort('action')} className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors">
                    Action {sortKey === 'action' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3">
                  <button type="button" onClick={() => toggleSort('target')} className="flex items-center gap-1 font-medium hover:text-[var(--text)] transition-colors">
                    Target {sortKey === 'target' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="p-3 font-medium text-[var(--text-muted)]">Reason</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={e.id} className={`border-b border-[var(--separator)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors ${i % 2 === 1 ? 'bg-[var(--surface)]/30' : ''}`}>
                  <td className="p-3 text-[var(--text-muted)]">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3">{e.admin_email ?? '—'}</td>
                  <td className="p-3 font-medium">{e.action}</td>
                  <td className="p-3">{e.target_type && e.target_id ? `${e.target_type}: ${e.target_id.slice(0, 8)}…` : '—'}</td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">{(e as Record<string, unknown>).reason ? String((e as Record<string, unknown>).reason) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================
// COMPLIANCE TAB (Phase 7)
// ============================================

function ComplianceTab({
  controls,
  evidence,
  reviews,
  health,
  loading,
  generatingCode,
  onRefresh,
  onRunHealthCheck,
  onRepairChain,
  onGenerateEvidence,
  onAddReview,
  canExportAudit,
}: {
  controls: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  health: {
    overall_score: number | null
    controls: Array<{ control_code: string; status: string; score: number; last_checked_at: string; notes: string | null }>
    last_checked_at: string | null
  } | null
  loading: boolean
  generatingCode: string | null
  onRefresh: () => void
  onRunHealthCheck: () => Promise<void>
  onRepairChain: () => Promise<void>
  onGenerateEvidence: (controlCode: string) => Promise<void>
  onAddReview: (reviewPeriod: string, summary: string) => Promise<void>
  canExportAudit: boolean
}) {
  const [runningHealth, setRunningHealth] = useState(false)
  const [repairingChain, setRepairingChain] = useState(false)
  const [evidenceFilter, setEvidenceFilter] = useState('')
  const [reviewPeriod, setReviewPeriod] = useState('')
  const [reviewSummary, setReviewSummary] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const filteredEvidence = evidenceFilter.trim()
    ? evidence.filter((e) => String(e.control_code ?? '').toLowerCase().includes(evidenceFilter.trim().toLowerCase()))
    : evidence

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Control framework & evidence</h2>
        <button type="button" onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Control health (Phase 8 CCM) */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Control health</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">Overall governance score and per-control status. Run checks daily (e.g. via cron calling POST /api/admin/compliance/health/run).</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {health != null && health.overall_score != null && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--text)]">Overall: {health.overall_score}</span>
              <span className="text-sm text-[var(--text-muted)]">/ 100</span>
            </div>
          )}
          {health?.last_checked_at && (
            <span className="text-xs text-[var(--text-muted)]">Last run: {new Date(health.last_checked_at).toLocaleString()}</span>
          )}
          {canExportAudit && (
            <button
              type="button"
              disabled={runningHealth}
              onClick={async () => { setRunningHealth(true); await onRunHealthCheck(); setRunningHealth(false) }}
              className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50"
            >
              {runningHealth ? 'Running…' : 'Run health checks'}
            </button>
          )}
          {canExportAudit && (
            <button
              type="button"
              disabled={repairingChain}
              onClick={async () => { setRepairingChain(true); await onRepairChain(); setRepairingChain(false) }}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 text-[var(--text-secondary)]"
              title="Recompute audit log hash chain (fixes CC7.2 when chain is broken)"
            >
              {repairingChain ? 'Repairing…' : 'Repair chain'}
            </button>
          )}
        </div>
        {loading && !health ? (
          <div className="h-20 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
        ) : health?.controls?.length ? (
          <ul className="space-y-2">
            {health.controls.map((c) => (
              <li key={c.control_code} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--separator)] last:border-0">
                <span className="font-medium">{c.control_code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'healthy' ? 'bg-green-500/20 text-green-400' : c.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                  {c.status}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">Score: {c.score}</span>
                <span className="text-xs text-[var(--text-muted)]">{c.last_checked_at ? new Date(c.last_checked_at).toLocaleString() : ''}</span>
                {c.notes && <span className="text-xs text-[var(--text-muted)] w-full mt-1" title={c.notes}>{c.notes}</span>}
                {c.notes && String(c.notes).includes('No super_admin') && (
                  <span className="text-xs text-[var(--text-muted)] w-full mt-1 block">Ensure <code className="bg-[var(--surface-hover)] px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set in your deployment, then open Admin (or Settings) once so your allowlisted account is assigned super_admin.</span>
                )}
                <a href="#compliance-evidence" onClick={() => setEvidenceFilter(c.control_code)} className="text-xs text-[var(--accent-purple)] hover:underline">Evidence →</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No health data yet. Run health checks (or run migration 20260228000005) and call POST /api/admin/compliance/health/run.</p>
        )}
      </div>

      {/* Control Mapping */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Control mapping</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">SOC2, ISO 27001, GDPR controls mapped to system components and evidence sources.</p>
        {loading && controls.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : controls.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Run migration 20260228000004_control_framework_evidence_phase7.sql to seed controls.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--separator)]">
                  <th className="p-2 font-medium">Framework</th>
                  <th className="p-2 font-medium">Control</th>
                  <th className="p-2 font-medium">Description</th>
                  <th className="p-2 font-medium">Component</th>
                  <th className="p-2 font-medium">Evidence source</th>
                  {canExportAudit && <th className="p-2 font-medium">Generate</th>}
                </tr>
              </thead>
              <tbody>
                {controls.map((c) => (
                  <tr key={String(c.id)} className="border-b border-[var(--separator)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="p-2">{String(c.framework)}</td>
                    <td className="p-2 font-medium">{String(c.control_code)}</td>
                    <td className="p-2 text-[var(--text-secondary)] max-w-[200px] truncate" title={String(c.control_description ?? '')}>{String(c.control_description ?? '')}</td>
                    <td className="p-2">{String(c.system_component)}</td>
                    <td className="p-2 text-xs text-[var(--text-muted)] max-w-[240px] truncate" title={String(c.evidence_source ?? '')}>{String(c.evidence_source ?? '')}</td>
                    {canExportAudit && (
                      <td className="p-2">
                        <button
                          type="button"
                          disabled={generatingCode !== null}
                          onClick={() => onGenerateEvidence(String(c.control_code))}
                          className="px-2 py-1 rounded-lg bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-xs font-medium disabled:opacity-50"
                        >
                          {generatingCode === c.control_code ? 'Generating…' : 'Generate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evidence export / registry */}
      <div id="compliance-evidence" className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Evidence registry</h3>
        <p className="text-sm text-[var(--text-muted)] mb-3">Generated evidence records. Filter by control code.</p>
        <input
          type="text"
          placeholder="Filter by control code (e.g. CC7.2)"
          value={evidenceFilter}
          onChange={(e) => setEvidenceFilter(e.target.value)}
          className="input-field w-full max-w-xs mb-4"
        />
        {loading && evidence.length === 0 ? (
          <div className="h-24 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
        ) : filteredEvidence.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No evidence records yet. Use Generate on a control above.</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {filteredEvidence.slice(0, 50).map((e) => (
              <li key={String(e.id)} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--separator)] last:border-0 text-sm">
                <span className="font-medium">{String(e.control_code)}</span>
                <span className="text-[var(--text-muted)]">{String(e.evidence_type)} · {String(e.reference ?? '')}</span>
                <span className="text-xs text-[var(--text-muted)]">{e.generated_at ? new Date(String(e.generated_at)).toLocaleString() : ''}</span>
              </li>
            ))}
            {filteredEvidence.length > 50 && <p className="text-xs text-[var(--text-muted)]">… and {filteredEvidence.length - 50} more</p>}
          </ul>
        )}
      </div>

      {/* Quarterly review log */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Quarterly governance review log</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">Log governance reviews for compliance (e.g. 2025-Q1).</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Review period (e.g. 2025-Q1)"
            value={reviewPeriod}
            onChange={(e) => setReviewPeriod(e.target.value)}
            className="input-field max-w-[180px]"
          />
          <textarea
            placeholder="Summary (optional)"
            value={reviewSummary}
            onChange={(e) => setReviewSummary(e.target.value)}
            className="input-field min-w-[240px] min-h-[80px]"
            rows={2}
          />
          <button
            type="button"
            disabled={!reviewPeriod.trim() || submittingReview}
            onClick={async () => {
              setSubmittingReview(true)
              await onAddReview(reviewPeriod.trim(), reviewSummary.trim())
              setReviewPeriod('')
              setReviewSummary('')
              setSubmittingReview(false)
            }}
            className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50"
          >
            {submittingReview ? 'Saving…' : 'Log review'}
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No governance reviews logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={String(r.id)} className="py-2 border-b border-[var(--separator)] last:border-0">
                <p className="font-medium">{String(r.review_period)}</p>
                {r.summary != null && r.summary !== '' && <p className="text-sm text-[var(--text-secondary)] mt-1">{String(r.summary)}</p>}
                <p className="text-xs text-[var(--text-muted)]">{r.created_at ? new Date(String(r.created_at)).toLocaleString() : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({
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
}: {
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
  /** Phase 12: central 403 handler (refetch roles, redirect to first allowed tab) */
  on403?: () => void
}) {
  const [configDraft, setConfigDraft] = useState<Record<string, string>>(appConfig)
  const [saving, setSaving] = useState(false)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceSegment, setAnnounceSegment] = useState('all')
  const [adminUsers, setAdminUsers] = useState<Array<{ admin_user_id: string; email: string | null; name: string | null; roles: string[] }>>([])
  const [rolesList, setRolesList] = useState<Array<{ id: string; name: string; description: string | null }>>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [roleActionLoading, setRoleActionLoading] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [adminSessions, setAdminSessions] = useState<Array<{ id: string; session_id: string; ip_address: string | null; user_agent: string | null; country: string | null; city: string | null; created_at: string; last_seen_at: string; is_current?: boolean }>>([])
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
        setAdminSessionsError('You don’t have permission to view active sessions.')
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

  useEffect(() => { setConfigDraft(appConfig) }, [appConfig])
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
        <a href="/settings/security" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-[var(--accent-purple)] text-white hover:opacity-90 transition-opacity">
          Open app Settings → 2FA
        </a>
      </div>

      {/* Active Sessions (Phase 6) */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl">
        <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
        <p className="text-sm text-[var(--text-muted)] mb-3">Admin sessions for this account. Revoke any session you don’t recognize.</p>
        <button type="button" onClick={loadAdminSessions} disabled={adminSessionsLoading} className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-3 disabled:opacity-50">
          {adminSessionsLoading ? 'Loading…' : 'Refresh'}
        </button>
        {adminSessionsError && (
          <p className="text-sm text-[var(--error)] mb-3">{adminSessionsError}</p>
        )}
        {!adminSessionsError && adminSessions.length === 0 && !adminSessionsLoading && (
          <p className="text-sm text-[var(--text-muted)]">No active sessions, or run migration for admin_sessions.</p>
        )}
        {!adminSessionsError && adminSessions.length > 0 && (
          <div className="space-y-3">
            {adminSessions.map((s) => (
              <div
                key={s.id}
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${s.is_current ? 'border-[var(--accent-purple)]/50 bg-[var(--accent-purple)]/5' : 'border-[var(--separator)] bg-[var(--surface-hover)]/30'}`}
              >
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {s.ip_address ?? 'Unknown IP'}
                    {s.is_current && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]">Current</span>}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Last activity: {new Date(s.last_seen_at).toLocaleString()}
                    {s.country && ` · ${s.city ? `${s.city}, ` : ''}${s.country}`}
                  </p>
                  {s.user_agent && <p className="text-xs text-[var(--text-muted)] truncate max-w-md" title={s.user_agent}>{s.user_agent}</p>}
                </div>
                {canManageRoles && !s.is_current && (
                  <button
                    type="button"
                    disabled={revokingId === s.id}
                    onClick={async () => {
                      setRevokingId(s.id)
                      try {
                        const res = await fetch(`/api/admin/sessions/${s.id}/revoke`, { method: 'POST', credentials: 'include' })
                        const data = await res.json().catch(() => ({}))
                        if (res.ok) void loadAdminSessions()
                        else if (res.status === 403 && showToast) showToast('You don\'t have permission to revoke sessions.', 'error')
                        else if (showToast) showToast((data?.error as string) || 'Failed to revoke session', 'error')
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
            <input id="admin-config-signups-open" name="signups_open" type="checkbox" checked={configDraft.signups_open !== 'false'} onChange={e => setConfigDraft(prev => ({ ...prev, signups_open: e.target.checked ? 'true' : 'false' }))} className="rounded" />
            <span>Signups open</span>
          </label>
          <label className="flex items-center gap-3" htmlFor="admin-config-verification-open">
            <input id="admin-config-verification-open" name="verification_requests_open" type="checkbox" checked={configDraft.verification_requests_open !== 'false'} onChange={e => setConfigDraft(prev => ({ ...prev, verification_requests_open: e.target.checked ? 'true' : 'false' }))} className="rounded" />
            <span>Verification requests open</span>
          </label>
          <label className="flex items-center gap-3" htmlFor="admin-config-maintenance-mode">
            <input id="admin-config-maintenance-mode" name="maintenance_mode" type="checkbox" checked={configDraft.maintenance_mode === 'true'} onChange={e => setConfigDraft(prev => ({ ...prev, maintenance_mode: e.target.checked ? 'true' : 'false' }))} className="rounded" />
            <span>Maintenance mode</span>
          </label>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1" htmlFor="admin-maintenance-banner">Maintenance banner (shown to all users)</label>
            <input id="admin-maintenance-banner" name="maintenance_banner" type="text" value={configDraft.maintenance_banner ?? ''} onChange={e => setConfigDraft(prev => ({ ...prev, maintenance_banner: e.target.value }))} placeholder="Optional message" className="input-field w-full" />
          </div>
          {configSaveSuccess && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/40 text-[var(--success)] text-sm flex items-center justify-between gap-2">
              <span>{configSaveSuccess}</span>
              {clearConfigSaveSuccess && <button type="button" onClick={clearConfigSaveSuccess} className="font-medium hover:underline" aria-label="Dismiss">×</button>}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleSaveConfig} disabled={saving || !onSaveConfig} className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save config'}
            </button>
            {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm disabled:opacity-50">Refresh</button>}
          </div>
        </div>
      </div>

      {/* Announcements */}
      {onAnnounce && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Send announcement</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">Queue a push/email to users. Wire your provider in api/admin/announce/route.ts.</p>
          {announceSuccess && (
            <div className="mb-3 p-3 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/40 text-[var(--success)] text-sm flex items-center justify-between gap-2">
              <span>{announceSuccess}</span>
              <button type="button" onClick={clearAnnounceSuccess} className="font-medium hover:underline" aria-label="Dismiss">×</button>
            </div>
          )}
          <label className="block text-sm text-[var(--text-muted)] mb-1" htmlFor="admin-announce-title">Title</label>
          <input id="admin-announce-title" name="announce_title" type="text" value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} placeholder="Title" className="input-field w-full mb-2" />
          <label className="block text-sm text-[var(--text-muted)] mb-1" htmlFor="admin-announce-message">Message</label>
          <textarea id="admin-announce-message" name="announce_body" value={announceBody} onChange={e => setAnnounceBody(e.target.value)} placeholder="Message" className="input-field w-full mb-2 min-h-[80px]" />
          <label className="block text-sm text-[var(--text-muted)] mb-1" htmlFor="admin-announce-segment">Audience</label>
          <select id="admin-announce-segment" name="announce_segment" value={announceSegment} onChange={e => setAnnounceSegment(e.target.value)} className="input-field w-full mb-3" aria-label="Announcement audience">
            <option value="all">All users</option>
            <option value="verified">Verified only</option>
          </select>
          <button type="button" onClick={async () => { await onAnnounce(announceTitle, announceBody, announceSegment); setAnnounceTitle(''); setAnnounceBody('') }} className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium">
            Send announcement
          </button>
        </div>
      )}

      {/* Blocked users overview */}
      {onLoadBlocked && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Blocked users (platform)</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">Who blocked whom. Load to refresh.</p>
          <button type="button" onClick={onLoadBlocked} disabled={blockedLoading} className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-3 disabled:opacity-50">
            {blockedLoading ? 'Loading…' : 'Load blocked list'}
          </button>
          {blockedUsers.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {blockedUsers.slice(0, 50).map((b: Record<string, unknown>) => (
                <div key={String(b.id)} className="text-sm py-1 border-b border-[var(--separator)]">
                  @{String(b.blocker_username ?? b.blocker_id)} blocked @{String(b.blocked_username ?? b.blocked_id)}
                </div>
              ))}
              {blockedUsers.length > 50 && <p className="text-xs text-[var(--text-muted)]">… and {blockedUsers.length - 50} more</p>}
            </div>
          )}
        </div>
      )}

      {/* Admin users & roles - super_admin only */}
      {isSuperAdmin && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Admin users & roles</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">Assign or remove roles. Only super_admin can manage.</p>
          {roleError && (
            <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-sm flex items-center justify-between gap-2">
              <span>{roleError}</span>
              <button type="button" onClick={() => setRoleError(null)} className="font-medium hover:underline" aria-label="Dismiss">×</button>
            </div>
          )}
          <button type="button" onClick={loadAdminUsersAndRoles} disabled={adminUsersLoading} className="px-4 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--separator)] text-sm mb-4 disabled:opacity-50">
            {adminUsersLoading ? 'Loading…' : 'Refresh list'}
          </button>
          {adminUsers.length === 0 && !adminUsersLoading ? (
            <p className="text-sm text-[var(--text-muted)]">No admin users with roles yet. Allowlisted admins get super_admin on first login.</p>
          ) : (
            <div className="space-y-4">
              {adminUsers.map((au) => (
                <div key={au.admin_user_id} className="p-4 rounded-xl border border-[var(--separator)] bg-[var(--surface-hover)]/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-medium">{au.name || au.email || au.admin_user_id.slice(0, 8)}</span>
                    <span className="text-xs text-[var(--text-muted)]">{au.admin_user_id.slice(0, 8)}…</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {au.roles.map((r) => (
                      <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] text-sm">
                        {r}
                        <button
                          type="button"
                          disabled={roleActionLoading !== null || (r === 'super_admin' && au.admin_user_id === currentUserId)}
                          onClick={async () => {
                            setRoleActionLoading(au.admin_user_id + r)
                            try {
                              const res = await fetch(`/api/admin/admin-users/${encodeURIComponent(au.admin_user_id)}/remove-role?role_name=${encodeURIComponent(r)}`, { method: 'DELETE', credentials: 'include' })
                              const data = await res.json().catch(() => ({}))
                              if (res.ok) await loadAdminUsersAndRoles()
                              else setRoleError(typeof data?.error === 'string' ? data.error : 'Failed to remove role')
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
                          const res = await fetch(`/api/admin/admin-users/${encodeURIComponent(au.admin_user_id)}/assign-role`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ role_name: roleName }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (res.ok) await loadAdminUsersAndRoles()
                          else setRoleError(typeof data?.error === 'string' ? data.error : 'Failed to assign role')
                        } finally {
                          setRoleActionLoading(null)
                        }
                      }}
                      aria-label="Assign role"
                    >
                      <option value="">+ Assign role</option>
                      {rolesList.filter((ro) => !au.roles.includes(ro.name)).map((ro) => (
                        <option key={ro.id} value={ro.name}>{ro.name}</option>
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
            <button type="button" onClick={() => setActiveTab('audit')} className="text-[var(--accent-purple)] hover:underline">
              View audit log →
            </button>
          )}
        </div>
      </div>
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

function AdminSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--separator)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--separator)]">
            <th className="text-left p-3"><div className="h-4 w-24 bg-[var(--surface-hover)] rounded animate-pulse" /></th>
            <th className="text-left p-3"><div className="h-4 w-20 bg-[var(--surface-hover)] rounded animate-pulse" /></th>
            <th className="text-left p-3"><div className="h-4 w-16 bg-[var(--surface-hover)] rounded animate-pulse" /></th>
            <th className="text-left p-3"><div className="h-4 w-20 bg-[var(--surface-hover)] rounded animate-pulse" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-[var(--separator)]">
              <td className="p-3"><div className="h-4 w-32 bg-[var(--surface-hover)]/80 rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-4 w-28 bg-[var(--surface-hover)]/80 rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-4 w-24 bg-[var(--surface-hover)]/80 rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-4 w-28 bg-[var(--surface-hover)]/80 rounded animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================
// COMPONENTS
// ============================================

function StatCard({ title, value, icon, color, trend }: { 
  title: string; value: number | string; icon: string; color: string; trend: string 
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{title}</p>
      <p className="text-xs mt-2" style={{ color }}>{trend}</p>
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

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img 
        src={url} 
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div 
      className="rounded-full bg-[var(--surface)] flex items-center justify-center text-lg"
      style={{ width: size, height: size }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function ApplicationCard({
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

  return (
    <div
      className="bg-[var(--surface)] border border-[var(--separator)] p-4 rounded-xl shadow-[var(--shadow-soft)] hover:border-[var(--accent-purple)]/30 transition-colors cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-3 min-w-0 flex-1">
          <Avatar url={app.profile_image_url} name={app.name} size={48} />
          <div className="min-w-0 flex-1">
            {/* Primary: name + status + date */}
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <p className="font-semibold text-[var(--text)] truncate">{app.name || 'No name'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(app.status)}`}>
                {getStatusLabel(app.status)}
              </span>
              {(claimedByMe || claimedByOther) && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-500/20 text-blue-400">
                  {claimedByMe ? 'Claimed by you' : 'Claimed by another moderator'}
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                {app.application_date ? new Date(app.application_date).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            {/* Secondary: @username · email */}
            <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">@{app.username} · {app.email}</p>
            {/* Tertiary: niche, referrer, followers as compact tags */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-[var(--text-muted)]">
              {app.niche && <span className="text-[var(--accent-purple)]">{app.niche}</span>}
              {app.referrer_username && <span>Referred by {app.referrer_username}</span>}
              {app.follower_count != null && app.follower_count > 0 && (
                <span>{app.follower_count.toLocaleString()} followers</span>
              )}
            </div>
          </div>
        </div>

        {isPending && (
          <div className="flex gap-2 flex-shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
            {!claimedByMe && !claimedByOther && onClaim && (
              <button type="button" onClick={onClaim} disabled={claiming} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm">Claim</button>
            )}
            {claimedByMe && onRelease && (
              <button type="button" onClick={onRelease} disabled={claiming} className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-sm">Release</button>
            )}
            <button
              type="button"
              onClick={onWaitlist}
              disabled={!canAct || isLoading}
              className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm font-medium disabled:opacity-50"
            >
              Waitlist
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={!canAct || isLoading}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm font-medium disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={!canAct || isLoading}
              className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ApplicationDetailModal({
  app, onClose, onApprove, onReject, onWaitlist, onSuspend, isLoading, canAct = true, canActReason
}: {
  app: Application
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onSuspend: () => void
  isLoading: boolean
  canAct?: boolean
  canActReason?: string
}) {
  const statusUpper = (app.status || '').toUpperCase()
  const _isPending = ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'].includes(statusUpper)
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = useModalFocusTrap(dialogRef, onClose)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 overflow-hidden"
      onClick={e => e.target === e.currentTarget && handleClose()}
      role="presentation"
      style={{ padding: '1rem' }}
    >
      <div
        ref={dialogRef}
        className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full flex flex-col shadow-[var(--shadow-card)] border border-[var(--separator)]"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: 'min(75vh, calc(100vh - 2rem))',
          width: '100%',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header: always visible */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--separator)] flex-shrink-0 bg-[var(--surface)] rounded-t-2xl">
          <h2 id="application-detail-title" className="text-xl font-bold text-[var(--text)]">Application Details</h2>
          <button type="button" onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] text-2xl transition-colors" aria-label="Close">×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="text-center mb-6">
            <Avatar url={app.profile_image_url} name={app.name} size={100} />
            <h3 className="text-xl font-bold mt-4 text-[var(--text)]">{app.name}</h3>
            <p className="text-[var(--text-secondary)]">@{app.username}</p>
            <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${getStatusColor(app.status)}`}>
              {getStatusLabel(app.status)}
            </span>
          </div>

          <div className="space-y-3 mb-6">
            <DetailRow icon="📧" label="Email" value={app.email} />
            <DetailRow icon="📱" label="Phone" value={app.phone || 'Not provided'} />
            <DetailRow icon="🏷️" label="Niche" value={app.niche || 'Not set'} />
            <DetailRow icon="📸" label="Instagram" value={app.instagram_username || 'Not linked'} />
            <DetailRow icon="👥" label="Followers" value={app.follower_count?.toLocaleString() || 'Unknown'} />
            <DetailRow icon="👋" label="Referred by" value={app.referrer_username || 'None'} />
            <DetailRow icon="📅" label="Applied" value={app.application_date ? new Date(app.application_date).toLocaleDateString() : 'N/A'} />
          </div>

          {app.bio && (
            <div className="mb-4">
              <p className="text-sm text-[var(--text-muted)] mb-1">Bio</p>
              <p className="text-[var(--text)] bg-[var(--surface-hover)] p-3 rounded-xl">{app.bio}</p>
            </div>
          )}

          {app.why_join && (
            <div className="mb-4">
              <p className="text-sm text-[var(--text-muted)] mb-1">Why do you want to join?</p>
              <p className="text-[var(--text)] bg-[var(--surface-hover)] p-3 rounded-xl">{app.why_join}</p>
            </div>
          )}

          {app.what_to_offer && (
            <div className="mb-4">
              <p className="text-sm text-[var(--text-muted)] mb-1">What do you have to offer?</p>
              <p className="text-[var(--text)] bg-[var(--surface-hover)] p-3 rounded-xl">{app.what_to_offer}</p>
            </div>
          )}

          {app.collaboration_goals && (
            <div className="mb-4">
              <p className="text-sm text-[var(--text-muted)] mb-1">Collaboration goals</p>
              <p className="text-[var(--text)] bg-[var(--surface-hover)] p-3 rounded-xl">{app.collaboration_goals}</p>
            </div>
          )}
        </div>

        {/* Sticky footer: actions always visible */}
        <div className="p-4 border-t border-[var(--separator)] flex-shrink-0 bg-[var(--surface)] rounded-b-2xl">
          <p className="text-xs text-[var(--text-muted)] mb-3">Change status</p>
          {!canAct && canActReason && (
            <p className="text-sm text-amber-500/90 mb-2" role="status">{canActReason}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={!canAct || isLoading || statusUpper === 'APPROVED'}
              className="flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/40"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={!canAct || isLoading || statusUpper === 'REJECTED'}
              className="flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onWaitlist}
              disabled={!canAct || isLoading || statusUpper === 'WAITLISTED'}
              className="flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/40"
            >
              Waitlist
            </button>
            <button
              type="button"
              onClick={onSuspend}
              disabled={!canAct || isLoading || statusUpper === 'SUSPENDED'}
              className="flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/40"
            >
              Suspend
            </button>
          </div>
          <button type="button" onClick={handleClose} className="mt-3 w-full py-2 rounded-xl bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text)] text-sm font-medium">
            Close
          </button>
        </div>
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

function getStatusColor(status: string): string {
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

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 604800)}w ago`
}