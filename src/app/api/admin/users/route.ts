import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

const MAX_USERS = 500

/** GET - List users (profiles). Replaces admin_get_all_users RPC. Requires read_users. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_users)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, username, profile_image_url, is_verified, is_banned, created_at, location, niche')
    .order('created_at', { ascending: false })
    .limit(MAX_USERS)

  if (error) {
    console.error('[admin users]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name ?? null,
    username: p.username ?? null,
    email: null as string | null,
    profile_image_url: p.profile_image_url ?? null,
    is_verified: Boolean(p.is_verified),
    is_banned: Boolean(p.is_banned),
    created_at: p.created_at ?? null,
    location: p.location ?? null,
    niche: p.niche ?? null,
  }))

  return NextResponse.json({ users: list })
}
