import { NextRequest } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { adminSuccess, adminError, getAdminRequestId, adminErrorFromResponse } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_USERS = 500

/** GET - List users (profiles). Requires read_users. Supports pagination: ?page=1&limit=50 */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_users)
  if (forbidden) return adminErrorFromResponse(forbidden, requestId)

  const supabase = getServiceRoleClient()
  if (!supabase) return adminError('Server missing SUPABASE_SERVICE_ROLE_KEY', 500, requestId)

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(MAX_USERS, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT))
  const offset = (page - 1) * limit
  const search = req.nextUrl.searchParams.get('search')?.trim() || null

  if (search) {
    const searchLower = search.toLowerCase()
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const matchingUserIds = (authUsers?.users ?? [])
      .filter(u => u.email?.toLowerCase().includes(searchLower))
      .map(u => u.id)

    let profilesQuery = supabase
      .from('profiles')
      .select('id, name, username, email, profile_image_url, is_verified, is_banned, created_at, location, niche')
      .order('created_at', { ascending: false })

    const searchPattern = `%${search}%`
    if (matchingUserIds.length > 0) {
      profilesQuery = profilesQuery.or(`name.ilike.${searchPattern},username.ilike.${searchPattern},email.ilike.${searchPattern},id.in.(${matchingUserIds.join(',')})`)
    } else {
      profilesQuery = profilesQuery.or(`name.ilike.${searchPattern},username.ilike.${searchPattern},email.ilike.${searchPattern}`)
    }

    const { data: allMatches, error: searchError } = await profilesQuery
    if (searchError) {
      console.error(`[${requestId}]`, searchError)
      return adminError(searchError.message, 500, requestId)
    }

    const total = (allMatches ?? []).length
    const profiles = (allMatches ?? []).slice(offset, offset + limit)

    const list = profiles.map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name ?? null,
      username: p.username ?? null,
      email: (p.email != null && p.email !== '') ? String(p.email) : null,
      profile_image_url: p.profile_image_url ?? null,
      is_verified: Boolean(p.is_verified),
      is_banned: Boolean(p.is_banned),
      created_at: p.created_at ?? null,
      location: p.location ?? null,
      niche: p.niche ?? null,
    }))

    return adminSuccess({ users: list, total, page, limit }, requestId)
  }

  const profilesQuery = supabase
    .from('profiles')
    .select('id, name, username, email, profile_image_url, is_verified, is_banned, created_at, location, niche')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const countQuery = supabase.from('profiles').select('*', { count: 'exact', head: true })

  const [listResult, countResult] = await Promise.all([
    profilesQuery,
    countQuery,
  ])

  const { data: profiles, error } = listResult
  const totalCount = countResult.error ? null : (countResult.count ?? null)
  if (error) {
    console.error(`[${requestId}]`, error)
    return adminError(error.message, 500, requestId)
  }

  const list = (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name ?? null,
    username: p.username ?? null,
    email: (p.email != null && p.email !== '') ? String(p.email) : null,
    profile_image_url: p.profile_image_url ?? null,
    is_verified: Boolean(p.is_verified),
    is_banned: Boolean(p.is_banned),
    created_at: p.created_at ?? null,
    location: p.location ?? null,
    niche: p.niche ?? null,
  }))

  const total = totalCount != null && !countResult.error ? totalCount : list.length
  return adminSuccess({ users: list, total, page, limit }, requestId)
}
