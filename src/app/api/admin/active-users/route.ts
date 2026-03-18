import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

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

/** GET - List active users from user_presence table. Requires active_sessions permission. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.active_sessions)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const url = new URL(req.url)
  const windowMinutes = parseInt(url.searchParams.get('window') || '5', 10)

  // Calculate the cutoff time
  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  // Fetch users active in the specified window
  const { data: usersData, error: usersError } = await supabase
    .from('user_presence')
    .select(`
      user_id,
      last_seen,
      is_online,
      updated_at,
      profiles!inner (
        name,
        username,
        profile_image_url,
        niche,
        account_type,
        location
      )
    `)
    .gt('last_seen', cutoffTime)
    .order('last_seen', { ascending: false })
    .limit(100)

  if (usersError) {
    console.error('[active-users] Failed to fetch users:', usersError)
    console.error('[active-users] Error details:', JSON.stringify(usersError, null, 2))
    // Return empty data instead of error to prevent UI breaking
    return NextResponse.json({
      ok: true,
      data: {
        concurrent: 0,
        active_hour: 0,
        active_today: 0,
        users: [],
      },
      fetched_at: new Date().toISOString(),
      error: usersError.message,
    })
  }

  // Fetch aggregate counts in parallel
  const cutoff5min = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const cutoff60min = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [concurrentRes, activeHourRes, activeTodayRes] = await Promise.allSettled([
    supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .gt('last_seen', cutoff5min),
    supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .gt('last_seen', cutoff60min),
    supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .gt('last_seen', cutoff24h),
  ])
  
  const getConcurrentCount = () => {
    if (concurrentRes.status === 'fulfilled' && !concurrentRes.value.error) {
      return concurrentRes.value.count ?? 0
    }
    return 0
  }
  
  const getActiveHourCount = () => {
    if (activeHourRes.status === 'fulfilled' && !activeHourRes.value.error) {
      return activeHourRes.value.count ?? 0
    }
    return 0
  }
  
  const getActiveTodayCount = () => {
    if (activeTodayRes.status === 'fulfilled' && !activeTodayRes.value.error) {
      return activeTodayRes.value.count ?? 0
    }
    return 0
  }

  // Transform the data
  const users: ActiveUser[] = (usersData ?? []).map((row: any) => {
    const profile = row.profiles || {}
    const lastSeenDate = new Date(row.last_seen)
    const minutesAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / 60000)

    return {
      user_id: row.user_id,
      last_seen: row.last_seen,
      full_name: profile.name || null,
      username: profile.username || null,
      profile_image_url: profile.profile_image_url || null,
      niche: profile.niche || null,
      account_type: profile.account_type || null,
      location: profile.location || null,
      minutes_ago: minutesAgo,
    }
  })

  return NextResponse.json({
    ok: true,
    data: {
      concurrent: getConcurrentCount(),
      active_hour: getActiveHourCount(),
      active_today: getActiveTodayCount(),
      users,
    },
    fetched_at: new Date().toISOString(),
  })
}
