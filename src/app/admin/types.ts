/**
 * Shared types for admin panel. Used by page, tabs, and hooks.
 */
import type { AdminPermission } from '@/lib/admin-rbac'

export interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
}

export interface Application {
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

export interface User {
  id: string
  name: string | null
  username: string | null
  email: string | null
  profile_image_url: string | null
  is_verified: boolean
  is_banned: boolean
  created_at: string | null
}

export interface VerificationRequest {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  requested_at: string
}

export interface RecentActivity {
  id: string
  type: string
  title: string
  subtitle: string
  timestamp: Date
  color: string
}

export interface InboxMessage {
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

export interface InboxThread {
  id: string
  user1_id: string | null
  user2_id: string | null
  created_at: string
  updated_at: string
}

export interface ConversationDisplay {
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

export interface LocationByCountry {
  country: string
  countryCode: string
  flag: string
  total: number
  cities: { city: string; count: number }[]
}

export type Tab =
  | 'overview'
  | 'dashboard'
  | 'applications'
  | 'users'
  | 'verifications'
  | 'inbox'
  | 'reports'
  | 'data-requests'
  | 'risk'
  | 'approvals'
  | 'audit'
  | 'compliance'
  | 'analytics'
  | 'settings'

export type AppFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'suspended'

export type TabPermissionMap = Record<Tab, AdminPermission>
