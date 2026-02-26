'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

interface AnalyticsData {
  profile_views: number
  post_impressions: number
  likes_received: number
  comments_received: number
  new_connections: number
  messages_received: number
}

interface DailyData {
  date: string
  profile_views: number
  post_impressions: number
  likes_received: number
}

interface TopViewer {
  viewer_id: string
  viewer_name: string | null
  viewer_username: string | null
  viewer_image: string | null
  view_count: number
}

export default function AnalyticsPage() {
  const { user, profile: _profile } = useApp()
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [totals, setTotals] = useState<AnalyticsData>({
    profile_views: 0,
    post_impressions: 0,
    likes_received: 0,
    comments_received: 0,
    new_connections: 0,
    messages_received: 0,
  })
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [topViewers, setTopViewers] = useState<TopViewer[]>([])
  const [loading, setLoading] = useState(true)
  const [previousTotals, setPreviousTotals] = useState<AnalyticsData | null>(null)

  const loadAnalytics = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    try {
      // Get daily analytics
      const { data: dailyAnalytics } = await supabase
        .from('analytics_daily')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (dailyAnalytics) {
        setDailyData(dailyAnalytics.map((d: { date: string; profile_views?: number; post_impressions?: number; likes_received?: number }) => ({
          date: d.date,
          profile_views: d.profile_views || 0,
          post_impressions: d.post_impressions || 0,
          likes_received: d.likes_received || 0,
        })))

        // Calculate totals
        const sums = dailyAnalytics.reduce((acc: AnalyticsData, d: { profile_views?: number; post_impressions?: number; likes_received?: number; comments_received?: number; new_connections?: number; messages_received?: number }) => ({
          profile_views: acc.profile_views + (d.profile_views || 0),
          post_impressions: acc.post_impressions + (d.post_impressions || 0),
          likes_received: acc.likes_received + (d.likes_received || 0),
          comments_received: acc.comments_received + (d.comments_received || 0),
          new_connections: acc.new_connections + (d.new_connections || 0),
          messages_received: acc.messages_received + (d.messages_received || 0),
        }), {
          profile_views: 0,
          post_impressions: 0,
          likes_received: 0,
          comments_received: 0,
          new_connections: 0,
          messages_received: 0,
        })
        setTotals(sums)
      }

      // Get previous period for comparison
      const prevStartDate = new Date(startDate)
      prevStartDate.setDate(prevStartDate.getDate() - days)
      
      const { data: prevAnalytics } = await supabase
        .from('analytics_daily')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', prevStartDate.toISOString().split('T')[0])
        .lt('date', startDate.toISOString().split('T')[0])

      if (prevAnalytics) {
        const prevSums = prevAnalytics.reduce((acc: AnalyticsData, d: { profile_views?: number; post_impressions?: number; likes_received?: number; comments_received?: number; new_connections?: number; messages_received?: number }) => ({
          profile_views: acc.profile_views + (d.profile_views || 0),
          post_impressions: acc.post_impressions + (d.post_impressions || 0),
          likes_received: acc.likes_received + (d.likes_received || 0),
          comments_received: acc.comments_received + (d.comments_received || 0),
          new_connections: acc.new_connections + (d.new_connections || 0),
          messages_received: acc.messages_received + (d.messages_received || 0),
        }), {
          profile_views: 0,
          post_impressions: 0,
          likes_received: 0,
          comments_received: 0,
          new_connections: 0,
          messages_received: 0,
        })
        setPreviousTotals(prevSums)
      }

      // Get top viewers
      const { data: views } = await supabase
        .from('profile_views')
        .select('viewer_id')
        .eq('profile_id', user.id)
        .gte('viewed_at', startDate.toISOString())

      if (views && views.length > 0) {
        // Count views per viewer
        const viewerCounts: Record<string, number> = {}
        views.forEach((v: { viewer_id?: string }) => {
          if (v.viewer_id) {
            viewerCounts[v.viewer_id] = (viewerCounts[v.viewer_id] || 0) + 1
          }
        })

        const topViewerIds = Object.entries(viewerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id)

        if (topViewerIds.length > 0) {
          const { data: viewerProfiles } = await supabase
            .from('profiles')
            .select('id, name, username, profile_image_url')
            .in('id', topViewerIds)

          type ViewerProfile = { id: string; name: string | null; username: string | null; profile_image_url: string | null }
          const profileMap = new Map<string, ViewerProfile>(viewerProfiles?.map((p: ViewerProfile) => [p.id, p]) || [])
          
          setTopViewers(topViewerIds.map((id: string) => ({
            viewer_id: id,
            viewer_name: profileMap.get(id)?.name || null,
            viewer_username: profileMap.get(id)?.username || null,
            viewer_image: profileMap.get(id)?.profile_image_url || null,
            view_count: viewerCounts[id],
          })))
        }
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    }
    setLoading(false)
  }, [user, timeRange])

  useEffect(() => {
    if (user) queueMicrotask(() => loadAnalytics())
  }, [user, loadAnalytics])

  function getPercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  // Simple bar chart
  const maxValue = Math.max(...dailyData.map(d => d.profile_views), 1)

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            <h1 className="text-[17px] font-semibold">Analytics</h1>
          </div>

          {/* Time range selector */}
          <div className="segmented-control mb-3">
            <button className={timeRange === '7d' ? 'active' : ''} onClick={() => setTimeRange('7d')}>
              7 Days
            </button>
            <button className={timeRange === '30d' ? 'active' : ''} onClick={() => setTimeRange('30d')}>
              30 Days
            </button>
            <button className={timeRange === '90d' ? 'active' : ''} onClick={() => setTimeRange('90d')}>
              90 Days
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Profile Views', value: totals.profile_views, key: 'profile_views' as const, icon: '👁️' },
            { label: 'Post Impressions', value: totals.post_impressions, key: 'post_impressions' as const, icon: '📊' },
            { label: 'Likes Received', value: totals.likes_received, key: 'likes_received' as const, icon: '❤️' },
            { label: 'Comments', value: totals.comments_received, key: 'comments_received' as const, icon: '💬' },
            { label: 'New Connections', value: totals.new_connections, key: 'new_connections' as const, icon: '🤝' },
            { label: 'Messages', value: totals.messages_received, key: 'messages_received' as const, icon: '✉️' },
          ].map(stat => {
            const change = previousTotals ? getPercentChange(stat.value, previousTotals[stat.key]) : 0
            return (
              <div
                key={stat.key}
                className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">{stat.label}</span>
                </div>
                <p className="text-[24px] font-bold">{formatNumber(stat.value)}</p>
                {previousTotals && (
                  <p className={`text-[12px] mt-1 ${
                    change > 0 ? 'text-[var(--success)]' : change < 0 ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
                  }`}>
                    {change > 0 ? '+' : ''}{change}% vs prev period
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Chart */}
        <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]">
          <h3 className="text-[15px] font-semibold mb-4">Profile Views Over Time</h3>
          {dailyData.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {dailyData.map((d, _i) => (
                <div
                  key={d.date}
                  className="flex-1 bg-[var(--accent-purple)] rounded-t-sm transition-all hover:bg-[var(--accent-purple-alt)]"
                  style={{ height: `${Math.max(4, (d.profile_views / maxValue) * 100)}%` }}
                  title={`${d.date}: ${d.profile_views} views`}
                />
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-center py-8">No data for this period</p>
          )}
          {dailyData.length > 0 && (
            <div className="flex justify-between mt-2 text-[11px] text-[var(--text-muted)]">
              <span>{dailyData[0]?.date}</span>
              <span>{dailyData[dailyData.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Top Viewers */}
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]">
          <h3 className="text-[15px] font-semibold mb-4">Top Viewers</h3>
          {topViewers.length > 0 ? (
            <div className="space-y-3">
              {topViewers.map((viewer, i) => (
                <div key={viewer.viewer_id} className="flex items-center gap-3">
                  <span className="w-6 text-[var(--text-muted)] text-[13px] text-center">{i + 1}</span>
                  {viewer.viewer_image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={viewer.viewer_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] font-bold">
                      {(viewer.viewer_name || viewer.viewer_username || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[14px] truncate">
                      {viewer.viewer_name || viewer.viewer_username || 'Anonymous'}
                    </p>
                    {viewer.viewer_username && (
                      <p className="text-[var(--text-muted)] text-[12px]">@{viewer.viewer_username}</p>
                    )}
                  </div>
                  <span className="text-[var(--accent-purple)] font-semibold text-[14px]">
                    {viewer.view_count} {viewer.view_count === 1 ? 'view' : 'views'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-center py-4">No viewer data available</p>
          )}
        </div>
      </main>
    </div>
  )
}
