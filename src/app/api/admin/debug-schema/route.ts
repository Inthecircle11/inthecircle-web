import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req)
    if (!adminCheck.ok) {
      return NextResponse.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status })
    }

    const supabase = getServiceRoleClient()
    const results: any = {}

    // Query 1: Recent analytics_sessions
    console.log('[DEBUG-SCHEMA] Querying recent analytics_sessions...')
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('analytics_sessions')
      .select('created_at')
      .gte('created_at', tenMinutesAgo)

    if (sessionsError) {
      results.recent_sessions_error = sessionsError.message
    } else {
      const count = recentSessions?.length || 0
      const maxDate = recentSessions && recentSessions.length > 0
        ? recentSessions.reduce((max, s) => {
            const d = new Date(s.created_at)
            return d > max ? d : max
          }, new Date(0))
        : null
      
      results.recent_sessions = {
        count,
        max_created_at: maxDate ? maxDate.toISOString() : null
      }
    }

    // Query 2: analytics_sessions columns
    console.log('[DEBUG-SCHEMA] Querying analytics_sessions columns...')
    const { data: analyticsColumns, error: analyticsColError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'analytics_sessions')
      .order('ordinal_position')

    if (analyticsColError) {
      results.analytics_sessions_columns_error = analyticsColError.message
    } else {
      results.analytics_sessions_columns = analyticsColumns?.map(c => c.column_name) || []
    }

    // Query 3: profiles columns
    console.log('[DEBUG-SCHEMA] Querying profiles columns...')
    const { data: profilesColumns, error: profilesColError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'profiles')
      .order('ordinal_position')

    if (profilesColError) {
      results.profiles_columns_error = profilesColError.message
    } else {
      results.profiles_columns = profilesColumns?.map(c => c.column_name) || []
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: any) {
    console.error('[DEBUG-SCHEMA ERROR]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Failed to fetch schema info' }, { status: 500 })
  }
}
