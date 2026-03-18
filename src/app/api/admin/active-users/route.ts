import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 60 * 1000 // 1 minute cache

let cachedData: {
  concurrent: number
  active_hour: number
  active_today: number
  users: Array<{
    user_id: string
    last_seen: string
    full_name: string | null
    username: string | null
    profile_image_url: string | null
    niche: string | null
    account_type: string | null
    location: string | null
    minutes_ago: number
  }>
  fetched_at: string
} | null = null

let cacheTimestamp = 0

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req)
    if (!adminCheck.ok) {
      return NextResponse.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status })
    }

    const now = Date.now()
    if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, data: cachedData, fetched_at: cachedData.fetched_at })
    }

    const supabase = getServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Service role client not available' }, { status: 500 })
    }

    const window = parseInt(req.nextUrl.searchParams.get('window') || '5')
    const nowDate = new Date()
    const windowAgo = new Date(nowDate.getTime() - window * 60 * 1000)
    const oneHourAgo = new Date(nowDate.getTime() - 60 * 60 * 1000)
    const startOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())

    // Query analytics_sessions for active users
    const [concurrentResult, hourlyResult, dailyResult, recentResult] = await Promise.allSettled([
      // Concurrent (based on window parameter)
      supabase
        .from('analytics_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_activity_at', windowAgo.toISOString())
        .not('user_id', 'is', null),
      
      // Active this hour
      supabase
        .from('analytics_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_activity_at', oneHourAgo.toISOString())
        .not('user_id', 'is', null),
      
      // Active today
      supabase
        .from('analytics_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_activity_at', startOfDay.toISOString())
        .not('user_id', 'is', null),
      
      // Recent active users (based on window) with profile data
      supabase
        .from('analytics_sessions')
        .select('user_id, last_activity_at')
        .gte('last_activity_at', windowAgo.toISOString())
        .not('user_id', 'is', null)
        .order('last_activity_at', { ascending: false })
        .limit(20)
    ])

    const concurrent = concurrentResult.status === 'fulfilled' ? (concurrentResult.value.count ?? 0) : 0
    const active_hour = hourlyResult.status === 'fulfilled' ? (hourlyResult.value.count ?? 0) : 0
    const active_today = dailyResult.status === 'fulfilled' ? (dailyResult.value.count ?? 0) : 0

    let users: Array<{
      user_id: string
      last_seen: string
      full_name: string | null
      username: string | null
      profile_image_url: string | null
      niche: string | null
      account_type: string | null
      location: string | null
      minutes_ago: number
    }> = []

    if (recentResult.status === 'fulfilled' && recentResult.value.data && recentResult.value.data.length > 0) {
      const userIds = [...new Set(recentResult.value.data.map((s: any) => s.user_id).filter(Boolean))]
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, profile_image_url, niche, location')
          .in('id', userIds)
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
        
        users = recentResult.value.data
          .map((session: any) => {
            const profile = profileMap.get(session.user_id)
            const lastActivityDate = new Date(session.last_activity_at)
            const minutesAgo = Math.floor((nowDate.getTime() - lastActivityDate.getTime()) / (60 * 1000))
            
            return {
              user_id: session.user_id,
              last_seen: session.last_activity_at,
              full_name: profile?.name || null,
              username: profile?.username || null,
              profile_image_url: profile?.profile_image_url || null,
              niche: profile?.niche || null,
              account_type: null,
              location: profile?.location || null,
              minutes_ago: minutesAgo
            }
          })
          .filter((u: any) => u.full_name || u.username)
          .slice(0, 10)
      }
    }

    const fetchedAt = new Date().toISOString()
    cachedData = {
      concurrent,
      active_hour,
      active_today,
      users,
      fetched_at: fetchedAt
    }
    cacheTimestamp = now

    return NextResponse.json({ ok: true, data: cachedData, fetched_at: fetchedAt })
  } catch (e: any) {
    console.error('[ACTIVE-USERS ERROR]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch active users' }, { status: 500 })
  }
}
