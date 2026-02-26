'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

interface Match {
  id: string
  user_a_id: string
  user_b_id: string
  status: string
  created_at: string
  other_user?: {
    id: string
    name: string | null
    username: string | null
    profile_image_url: string | null
    niche: string | null
    is_verified: boolean
  }
}

export default function MatchesPage() {
  const { user } = useApp()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  const loadMatches = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { data: matchData, error } = await supabase
        .from('creator_matches')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get other user profiles
      type MatchData = { id: string; user_a_id: string; user_b_id: string; status: string; created_at: string }
      const otherUserIds = matchData?.map((m: MatchData) => m.user_a_id === user.id ? m.user_b_id : m.user_a_id) || []
      
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, profile_image_url, niche, is_verified')
          .in('id', otherUserIds)

        type ProfileData = { id: string; name: string | null; username: string | null; profile_image_url: string | null; niche: string | null; is_verified: boolean }
        const profileMap = new Map<string, ProfileData>(profiles?.map((p: ProfileData) => [p.id, p]) || [])
        
        const enrichedMatches = matchData?.map((m: MatchData) => ({
          ...m,
          other_user: profileMap.get(m.user_a_id === user.id ? m.user_b_id : m.user_a_id)
        })) || []
        
        setMatches(enrichedMatches)
      } else {
        setMatches([])
      }
    } catch (err) {
      console.error('Failed to load matches:', err)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadMatches()
  }, [user, loadMatches])

  function formatTimeAgo(dateStr: string): string {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

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
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href="/connect" className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-[17px] font-semibold">Your Matches</h1>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <span className="text-5xl">💫</span>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No matches yet</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xs mx-auto text-[15px]">
              Start connecting with creators to find your perfect match
            </p>
            <Link href="/connect" className="btn-primary px-8 py-4">
              Start Connecting
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map(match => (
              <Link
                key={match.id}
                href={`/user/${match.other_user?.username || match.other_user?.id}`}
                className="flex items-center gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] transition-all"
              >
                {match.other_user?.profile_image_url ? (
                  <img
                    src={match.other_user.profile_image_url}
                    alt={match.other_user.name || 'Match'}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-lg">
                    {(match.other_user?.name || match.other_user?.username || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[15px]">
                      {match.other_user?.name || match.other_user?.username || 'Creator'}
                    </h3>
                    {match.other_user?.is_verified && (
                      <svg className="w-4 h-4 text-[var(--verified)]" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                      </svg>
                    )}
                  </div>
                  {match.other_user?.niche && (
                    <p className="text-[var(--text-secondary)] text-[13px]">{match.other_user.niche}</p>
                  )}
                  <p className="text-[var(--text-muted)] text-[12px] mt-1">Matched {formatTimeAgo(match.created_at)}</p>
                </div>
                <Link
                  href="/inbox"
                  className="p-3 rounded-full bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/20 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </Link>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
