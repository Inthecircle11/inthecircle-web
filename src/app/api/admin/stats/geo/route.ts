import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes cache

let cachedGeo: { data: Array<{ location: string; count: number }>; cached_at: string } | null = null
let cacheTimestamp = 0

export async function GET(req: NextRequest) {
  try {
    const result = await requireAdmin(req)
    if ('response' in result) return result.response

    const now = Date.now()
    if (cachedGeo && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, ...cachedGeo })
    }

    const supabase = getServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Service role client not available' }, { status: 500 })
    }

    // Fetch all profiles with location data (no limit, no filters)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('location')
      .not('location', 'is', null)
      .neq('location', '')
      .limit(10000)

    if (error) {
      console.error('[GEO ERROR]', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch location data' }, { status: 500 })
    }

    // Aggregate in JavaScript
    const locationCounts: Record<string, number> = {}
    for (const row of profiles || []) {
      if (row.location) {
        const loc = row.location.trim()
        locationCounts[loc] = (locationCounts[loc] || 0) + 1
      }
    }

    // Convert to array, sort by count, take top 10
    const geoResult = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const cachedAt = new Date().toISOString()
    cachedGeo = {
      data: geoResult,
      cached_at: cachedAt
    }
    cacheTimestamp = now

    return NextResponse.json({ ok: true, data: geoResult, cached_at: cachedAt })
  } catch (e: any) {
    console.error('[GEO ERROR]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch geographic data' }, { status: 500 })
  }
}
