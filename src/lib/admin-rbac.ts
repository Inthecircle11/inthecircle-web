/**
 * RBAC permission keys. Enforced server-side only.
 * Role hierarchy is encoded in the permission map (higher roles get more permissions).
 */
export const ADMIN_PERMISSIONS = {
  read_applications: 'read_applications',
  mutate_applications: 'mutate_applications',   // single approve/reject/waitlist/suspend
  bulk_applications: 'bulk_applications',         // bulk reject/suspend
  read_reports: 'read_reports',
  resolve_reports: 'resolve_reports',
  read_data_requests: 'read_data_requests',
  update_data_requests: 'update_data_requests',
  read_audit: 'read_audit',
  export_audit: 'export_audit',
  read_users: 'read_users',
  export_user: 'export_user',       // GDPR export single user
  ban_users: 'ban_users',
  delete_users: 'delete_users',
  anonymize_users: 'anonymize_users',
  read_blocked_users: 'read_blocked_users',
  read_config: 'read_config',
  manage_config: 'manage_config',
  announce: 'announce',
  manage_roles: 'manage_roles',
  active_sessions: 'active_sessions',
  read_risk: 'read_risk',
  resolve_escalations: 'resolve_escalations',
  request_approval: 'request_approval',
  approve_approval: 'approve_approval',
} as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS]

export const ROLE_NAMES = [
  'viewer',
  'moderator',
  'supervisor',
  'compliance',
  'super_admin',
] as const

export type AdminRoleName = (typeof ROLE_NAMES)[number]

const viewerPerms: readonly AdminPermission[] = [
  ADMIN_PERMISSIONS.read_applications,
  ADMIN_PERMISSIONS.read_reports,
  ADMIN_PERMISSIONS.read_data_requests,
  ADMIN_PERMISSIONS.read_audit,
  ADMIN_PERMISSIONS.read_users,
  ADMIN_PERMISSIONS.read_blocked_users,
  ADMIN_PERMISSIONS.read_config,
  ADMIN_PERMISSIONS.read_risk,
]

/** Permission matrix: each role gets the union of permissions listed. */
const ROLE_PERMISSIONS: Record<AdminRoleName, readonly AdminPermission[]> = {
  viewer: [
    ADMIN_PERMISSIONS.read_applications,
    ADMIN_PERMISSIONS.read_reports,
    ADMIN_PERMISSIONS.read_data_requests,
    ADMIN_PERMISSIONS.read_audit,
    ADMIN_PERMISSIONS.read_users,
    ADMIN_PERMISSIONS.read_blocked_users,
    ADMIN_PERMISSIONS.read_config,
  ],
  moderator: [
    ...viewerPerms,
    ADMIN_PERMISSIONS.mutate_applications,
    ADMIN_PERMISSIONS.resolve_reports,
    ADMIN_PERMISSIONS.request_approval,
  ],
  supervisor: [
    ...viewerPerms,
    ADMIN_PERMISSIONS.mutate_applications,
    ADMIN_PERMISSIONS.resolve_reports,
    ADMIN_PERMISSIONS.bulk_applications,
    ADMIN_PERMISSIONS.export_user,
    ADMIN_PERMISSIONS.ban_users,
    ADMIN_PERMISSIONS.resolve_escalations,
    ADMIN_PERMISSIONS.request_approval,
    ADMIN_PERMISSIONS.approve_approval,
  ],
  compliance: [
    ADMIN_PERMISSIONS.read_audit,
    ADMIN_PERMISSIONS.export_audit,
    ADMIN_PERMISSIONS.read_data_requests,
    ADMIN_PERMISSIONS.read_reports,
    ADMIN_PERMISSIONS.read_risk,
    ADMIN_PERMISSIONS.active_sessions,
  ],
  super_admin: Object.values(ADMIN_PERMISSIONS),
}

/** Set of permission strings for fast lookup per role. */
const rolePermissionSets: Record<AdminRoleName, Set<AdminPermission>> = {} as Record<
  AdminRoleName,
  Set<AdminPermission>
>
for (const role of ROLE_NAMES) {
  rolePermissionSets[role] = new Set(ROLE_PERMISSIONS[role])
}

export function getPermissionsForRole(role: AdminRoleName): Set<AdminPermission> {
  return rolePermissionSets[role] ?? new Set()
}

export function hasPermission(roleNames: AdminRoleName[], permission: AdminPermission): boolean {
  for (const name of roleNames) {
    if (rolePermissionSets[name]?.has(permission)) return true
  }
  return false
}

export function isSuperAdmin(roleNames: AdminRoleName[]): boolean {
  return roleNames.includes('super_admin')
}
