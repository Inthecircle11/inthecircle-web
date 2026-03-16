/**
 * Analytics event taxonomy. Separate from admin_audit_log.
 * Use these constants for event_name to keep BI and queries consistent.
 */

// =============================================================================
// APP EVENTS (product users)
// =============================================================================

export const APP_EVENTS = {
  // Lifecycle
  app_open: 'app_open',
  session_start: 'session_start',
  session_end: 'session_end',
  session_heartbeat: 'session_heartbeat',
  login: 'login',
  logout: 'logout',

  // Signup & onboarding
  signup_started: 'signup_started',
  signup_completed: 'signup_completed',
  onboarding_started: 'onboarding_started',
  onboarding_completed: 'onboarding_completed',

  // Engagement
  feature_viewed: 'feature_viewed',
  feature_clicked: 'feature_clicked',
  form_started: 'form_started',
  form_completed: 'form_completed',

  // Conversion
  purchase_started: 'purchase_started',
  purchase_completed: 'purchase_completed',

  // Activation (first meaningful action in product)
  first_core_action: 'first_core_action',

  // Retention trigger (action that typically predicts return)
  return_visit: 'return_visit',

  // Errors
  error_occurred: 'error_occurred',
} as const

export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS]

// Activation: event that counts as "activated" (e.g. first profile complete, first match)
export const ACTIVATION_EVENTS: AppEventName[] = [
  APP_EVENTS.onboarding_completed,
  APP_EVENTS.first_core_action,
]

// Core actions (high-value in-app actions)
export const CORE_ACTION_EVENTS: AppEventName[] = [
  APP_EVENTS.feature_clicked,
  APP_EVENTS.form_completed,
  APP_EVENTS.purchase_completed,
  APP_EVENTS.first_core_action,
]

// Retention trigger: events that indicate user is engaged (for return within 7d)
export const RETENTION_TRIGGER_EVENTS: AppEventName[] = [
  APP_EVENTS.feature_viewed,
  APP_EVENTS.feature_clicked,
  APP_EVENTS.form_completed,
  APP_EVENTS.return_visit,
]

// =============================================================================
// ADMIN EVENTS (admin panel users)
// =============================================================================

export const ADMIN_EVENTS = {
  admin_login: 'admin_login',
  admin_logout: 'admin_logout',
  admin_tab_opened: 'admin_tab_opened',
  admin_tab_time_spent: 'admin_tab_time_spent',
  admin_action_performed: 'admin_action_performed',
  admin_application_reviewed: 'admin_application_reviewed',
  admin_report_resolved: 'admin_report_resolved',
  admin_data_request_updated: 'admin_data_request_updated',
  admin_user_deleted: 'admin_user_deleted',
  admin_user_anonymized: 'admin_user_anonymized',
  admin_bulk_action: 'admin_bulk_action',
  admin_role_changed: 'admin_role_changed',
  admin_session_revoked: 'admin_session_revoked',
  admin_export_triggered: 'admin_export_triggered',
  admin_approval_requested: 'admin_approval_requested',
  admin_approval_approved: 'admin_approval_approved',
  admin_approval_rejected: 'admin_approval_rejected',
  admin_session_start: 'admin_session_start',
  admin_session_end: 'admin_session_end',
} as const

export type AdminEventName = (typeof ADMIN_EVENTS)[keyof typeof ADMIN_EVENTS]

// =============================================================================
// FEATURE NAMES (for feature_name column)
// =============================================================================

export const APP_FEATURES = {
  signup: 'signup',
  login: 'login',
  onboarding: 'onboarding',
  feed: 'feed',
  explore: 'explore',
  profile: 'profile',
  matches: 'matches',
  inbox: 'inbox',
  search: 'search',
  settings: 'settings',
  connect: 'connect',
  portfolio: 'portfolio',
  analytics: 'analytics',
  ideas: 'ideas',
  resources: 'resources',
  sprint: 'sprint',
  notifications: 'notifications',
} as const

export const ADMIN_FEATURES = {
  overview: 'overview',
  dashboard: 'dashboard',
  applications: 'applications',
  users: 'users',
  verifications: 'verifications',
  inbox: 'inbox',
  reports: 'reports',
  data_requests: 'data_requests',
  risk: 'risk',
  approvals: 'approvals',
  audit: 'audit',
  compliance: 'compliance',
  settings: 'settings',
  product_analytics: 'product_analytics',
} as const

// =============================================================================
// VALIDATION
// =============================================================================

const ALL_APP_EVENTS = new Set<string>(Object.values(APP_EVENTS))
const ALL_ADMIN_EVENTS = new Set<string>(Object.values(ADMIN_EVENTS))

export function isAppEvent(name: string): boolean {
  return ALL_APP_EVENTS.has(name)
}

export function isAdminEvent(name: string): boolean {
  return ALL_ADMIN_EVENTS.has(name)
}

export function isValidEventName(name: string, userType: 'app' | 'admin'): boolean {
  return userType === 'app' ? isAppEvent(name) : isAdminEvent(name)
}
