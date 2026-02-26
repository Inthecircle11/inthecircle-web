import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - Export one user's data (GDPR). Requires export_user. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.export_user)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const [
    { data: profile },
    { data: app },
    { data: intents },
    { data: threads },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('applications').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('intents').select('id, title, body, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
    supabase.from('message_threads').select('id, created_at, updated_at').or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profile ?? null,
    application: app ?? null,
    intents: intents ?? [],
    thread_count: (threads ?? []).length,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="user-export-${userId.slice(0, 8)}.json"`,
    },
  })
}
