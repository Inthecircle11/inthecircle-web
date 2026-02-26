import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasPermission, type AdminPermission, type AdminRoleName } from '@/lib/admin-rbac'
import { ensureAdminSessionAndTouch } from '@/lib/admin-sessions'

function parseEnvList(env: string | undefined): string[] {
  if (!env || typeof env !== 'string') return []
  return env
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export type AdminAuthResult =
  | { response: NextResponse }
  | { authorized: true; user: { id: string; email: string | null }; supabase: SupabaseClient; roles: AdminRoleName[]; sessionId?: string }

/** Load role names for an admin user. Uses RLS (user can read own rows). */
export async function getAdminRoles(
  supabase: SupabaseClient,
  adminUserId: string
): Promise<AdminRoleName[]> {
  const { data, error } = await supabase
    .from('admin_user_roles')
    .select('admin_roles(name)')
    .eq('admin_user_id', adminUserId)
  if (error) return []
  const names: AdminRoleName[] = []
  const validNames: AdminRoleName[] = ['viewer', 'moderator', 'supervisor', 'compliance', 'super_admin']
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const role = r.admin_roles
    const name = Array.isArray(role) ? (role[0] as Record<string, unknown>)?.name : (role as Record<string, unknown> | null)?.name
    if (typeof name === 'string' && validNames.includes(name as AdminRoleName)) names.push(name as AdminRoleName)
  }
  return names
}

/** Backfill: assign super_admin to allowlisted user with no roles. Uses service role. */
async function backfillSuperAdminIfNeeded(userId: string): Promise<void> {
  const service = getServiceRoleClient()
  if (!service) return
  // Ensure super_admin role exists (idempotent)
  await service
    .from('admin_roles')
    .upsert(
      { name: 'super_admin', description: 'Full access including delete/anonymize and role management' },
      { onConflict: 'name' }
    )
  const { data: roleRow } = await service
    .from('admin_roles')
    .select('id')
    .eq('name', 'super_admin')
    .single()
  if (!roleRow?.id) return
  await service.from('admin_user_roles').upsert(
    { admin_user_id: userId, role_id: roleRow.id },
    { onConflict: 'admin_user_id,role_id' }
  )
}

/** Decode JWT payload (no verify) to read amr. Returns array of auth methods or empty. */
function getAmrFromSession(session: { access_token?: string } | null): string[] {
  if (!session?.access_token) return []
  try {
    const parts = session.access_token.split('.')
    if (parts.length < 2) return []
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as { amr?: string[] }
    return Array.isArray(payload.amr) ? payload.amr : []
  } catch {
    return []
  }
}

/** Use in API routes: returns { authorized, user, supabase, roles, sessionId? } or a JSON error response. Pass req for session governance (touch last_seen, revoked check, create session). */
export async function requireAdmin(req?: NextRequest): Promise<AdminAuthResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  if (!user) {
    return { response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const adminUserIds = parseEnvList(process.env.ADMIN_USER_IDS)
  const adminEmails = parseEnvList(process.env.ADMIN_EMAILS)
  const isAllowlisted =
    (user.id && adminUserIds.includes(user.id.toLowerCase())) ||
    (user.email && adminEmails.includes(user.email.toLowerCase()))

  if (!isAllowlisted) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (process.env.ADMIN_REQUIRE_MFA === 'true') {
    const amr = getAmrFromSession(session)
    if (!amr.includes('mfa') && !amr.includes('otp')) {
      return { response: NextResponse.json({ error: 'MFA required for admin access' }, { status: 403 }) }
    }
  }

  let roles = await getAdminRoles(supabase, user.id)
  if (roles.length === 0) {
    await backfillSuperAdminIfNeeded(user.id)
    roles = await getAdminRoles(supabase, user.id)
    if (roles.length === 0) roles = ['super_admin'] as AdminRoleName[]
  }

  const auditUser = { id: user.id, email: user.email ?? null }

  if (req) {
    const sessionResult = await ensureAdminSessionAndTouch(req, supabase, auditUser)
    if ('response' in sessionResult) return sessionResult
    return {
      authorized: true,
      user: auditUser,
      supabase,
      roles,
      sessionId: sessionResult.sessionId,
    }
  }

  return {
    authorized: true,
    user: auditUser,
    supabase,
    roles,
  }
}

/** Call after requireAdmin(). Returns 403 response if permission missing. */
export function requirePermission(
  result: AdminAuthResult,
  permission: AdminPermission
): NextResponse | null {
  if ('response' in result) return result.response
  if (hasPermission(result.roles, permission)) return null
  return NextResponse.json(
    { error: 'Insufficient permission', permission },
    { status: 403 }
  )
}

/** Call after requireAdmin(). Returns 403 if user does not have any of the given roles. */
export function requireRole(
  result: AdminAuthResult,
  allowedRoles: AdminRoleName[]
): NextResponse | null {
  if ('response' in result) return result.response
  const hasRole = result.roles.some((r) => allowedRoles.includes(r))
  if (hasRole) return null
  return NextResponse.json(
    { error: 'Insufficient role', required: allowedRoles },
    { status: 403 }
  )
}
