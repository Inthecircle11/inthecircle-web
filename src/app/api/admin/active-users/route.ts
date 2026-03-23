/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

interface ActiveUser {
  user_id: string
  last_seen: string
  full_name: string | null
  name: string | null
  username: string | null
  email: string | null
  profile_image_url: string | null
  niche: string | null
  account_type: string | null
  location: string | null
  about: string | null
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

  // Fetch users active in the specified window from user_presence
  const { data: presenceData, error: presenceError } = await supabase
    .from('user_presence')
    .select('user_id, last_seen, is_online, updated_at')
    .gte('last_seen', cutoffTime)
    .order('last_seen', { ascending: false })
    .limit(100)
  
  if (presenceError) {
    console.error('[active-users] Failed to fetch presence:', presenceError)
    console.error('[active-users] Error details:', JSON.stringify(presenceError, null, 2))
    return NextResponse.json({
      ok: true,
      data: {
        concurrent: 0,
        active_hour: 0,
        active_today: 0,
        users: [],
      },
      fetched_at: new Date().toISOString(),
      error: presenceError.message,
    })
  }

  // Get unique user IDs
  const uniqueUserIds = [...new Set((presenceData || []).map((s: any) => s.user_id))]
  
  // Fetch profile data for these users
  let usersData: any[] = []
  if (uniqueUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, username, email, profile_image_url, niche, account_type, location, about')
      .in('id', uniqueUserIds)
    
    if (!profilesError && profiles) {
      // Map presence to profiles
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
      usersData = (presenceData || []).map((presence: any) => ({
        user_id: presence.user_id,
        last_seen: presence.last_seen,
        profiles: profileMap.get(presence.user_id) || {}
      }))
    }
  }

  // Fetch aggregate counts in parallel from user_presence
  const cutoff5min = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const cutoff60min = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [concurrentRes, activeHourRes, activeTodayRes] = await Promise.allSettled([
    supabase
      .from('user_presence')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen', cutoff5min),
    supabase
      .from('user_presence')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen', cutoff60min),
    supabase
      .from('user_presence')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen', cutoff24h),
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
      name: profile.name || null,
      username: profile.username || null,
      email: profile.email || null,
      profile_image_url: profile.profile_image_url || null,
      niche: profile.niche || null,
      account_type: profile.account_type || null,
      location: profile.location || null,
      about: profile.about || null,
      minutes_ago: minutesAgo,
    }
  })
  
  // Remove duplicates by user_id, keeping the most recent
  const uniqueUsers = Array.from(
    users.reduce((map, user) => {
      const existing = map.get(user.user_id)
      if (!existing || user.minutes_ago < existing.minutes_ago) {
        map.set(user.user_id, user)
      }
      return map
    }, new Map<string, ActiveUser>()).values()
  )

  return NextResponse.json({
    ok: true,
    data: {
      concurrent: getConcurrentCount(),
      active_hour: getActiveHourCount(),
      active_today: getActiveTodayCount(),
      users: uniqueUsers,
    },
    fetched_at: new Date().toISOString(),
  })
}
