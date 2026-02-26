'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

const CreateChallengeModal = dynamic(() => import('@/components/CreateChallengeModal'), { ssr: false })

interface Challenge {
  id: string
  name: string
  description: string | null
  created_by: string
  duration_days: number
  max_participants: number
  daily_time_limit_minutes: number | null
  status: string
  start_date: string | null
  end_date: string | null
  invite_code: string | null
  created_at: string
  participant_count?: number
  is_joined?: boolean
  my_progress?: {
    current_streak: number
    total_completions: number
  }
}

interface ChallengesHubProps {
  embedded?: boolean
  onClose?: () => void
}

export default function ChallengesHub({ embedded, onClose }: ChallengesHubProps) {
  const { user } = useApp()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'discover' | 'my'>('discover')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joiningError, setJoiningError] = useState<string | null>(null)

  const loadChallenges = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { data: participations } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('user_id', user.id)

      type Participation = { challenge_id: string; current_streak?: number; total_completions?: number }
      const participationMap = new Map<string, Participation>(participations?.map((p: Participation) => [p.challenge_id, p]) || [])
      const joinedChallengeIds = new Set(participations?.map((p: Participation) => p.challenge_id) || [])

      const { data: activeChallenges, error } = await supabase
        .from('creator_challenges')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      let myChallengesData: Challenge[] = []
      if (joinedChallengeIds.size > 0) {
        const { data } = await supabase
          .from('creator_challenges')
          .select('*')
          .in('id', Array.from(joinedChallengeIds))
          .order('created_at', { ascending: false })
        myChallengesData = data || []
      }

      const enrichedDiscover = (activeChallenges || []).map((c: Challenge) => ({
        ...c,
        is_joined: joinedChallengeIds.has(c.id),
        my_progress: participationMap.get(c.id) ? {
          current_streak: participationMap.get(c.id)?.current_streak || 0,
          total_completions: participationMap.get(c.id)?.total_completions || 0,
        } : undefined
      }))

      const enrichedMy = myChallengesData.map((c: Challenge) => ({
        ...c,
        is_joined: true,
        my_progress: participationMap.get(c.id) ? {
          current_streak: participationMap.get(c.id)?.current_streak || 0,
          total_completions: participationMap.get(c.id)?.total_completions || 0,
        } : undefined
      }))

      setChallenges(enrichedDiscover.filter((c: Challenge) => !c.is_joined))
      setMyChallenges(enrichedMy)
    } catch (err) {
      console.error('Failed to load challenges:', err)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadChallenges()
  }, [user, loadChallenges])

  async function joinChallenge(challengeId: string) {
    if (!user) return
    const supabase = createClient()
    try {
      await supabase.from('challenge_participants').insert({
        challenge_id: challengeId,
        user_id: user.id,
        status: 'active',
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
      })
      loadChallenges()
    } catch (err) {
      console.error('Failed to join challenge:', err)
    }
  }

  async function joinWithCode() {
    if (!user || !joinCode.trim()) return
    setJoiningError(null)
    const supabase = createClient()
    try {
      const { data: challenge, error } = await supabase
        .from('creator_challenges')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .single()

      if (error || !challenge) {
        setJoiningError('Invalid invite code')
        return
      }

      const { data: existing } = await supabase
        .from('challenge_participants')
        .select('id')
        .eq('challenge_id', challenge.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setJoiningError('You already joined this challenge')
        return
      }

      await joinChallenge(challenge.id)
      setShowJoinModal(false)
      setJoinCode('')
      setActiveTab('my')
    } catch (err) {
      setJoiningError('Failed to join challenge')
    }
  }

  async function leaveChallenge(challengeId: string) {
    if (!user) return
    const supabase = createClient()
    try {
      await supabase
        .from('challenge_participants')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
      loadChallenges()
    } catch (err) {
      console.error('Failed to leave challenge:', err)
    }
  }

  function getDaysRemaining(endDate: string | null): number {
    if (!endDate) return 0
    const end = new Date(endDate)
    const now = new Date()
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
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
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            {embedded && onClose ? (
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface-hover)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="w-9" />
            )}
            <h1 className="text-[17px] font-semibold">Challenges</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 rounded-full bg-[var(--premium-gold)] text-black text-[13px] font-semibold hover:opacity-90"
              >
                Create
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-3 py-1.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--surface-hover)]"
              >
                Join with Code
              </button>
            </div>
          </div>

          <div className="segmented-control mb-3">
            <button
              className={activeTab === 'discover' ? 'active' : ''}
              onClick={() => setActiveTab('discover')}
            >
              Discover
            </button>
            <button
              className={activeTab === 'my' ? 'active' : ''}
              onClick={() => setActiveTab('my')}
            >
              My Challenges {myChallenges.length > 0 && `(${myChallenges.length})`}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {activeTab === 'discover' ? (
          challenges.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
                <span className="text-5xl">🏆</span>
              </div>
              <h2 className="text-[22px] font-bold mb-2">No challenges available</h2>
              <p className="text-[var(--text-secondary)] max-w-xs mx-auto text-[15px]">
                Check back later or create your own
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {challenges.map(challenge => (
                <div
                  key={challenge.id}
                  className="p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-[17px]">{challenge.name}</h3>
                      {challenge.description && (
                        <p className="text-[var(--text-secondary)] text-[14px] mt-1 line-clamp-2">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-[12px] font-medium">
                      {challenge.duration_days} days
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-4 text-[var(--text-muted)] text-[13px]">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      {challenge.participant_count || 0} / {challenge.max_participants}
                    </span>
                    {challenge.daily_time_limit_minutes && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {challenge.daily_time_limit_minutes} min/day
                      </span>
                    )}
                    {challenge.end_date && (
                      <span>{getDaysRemaining(challenge.end_date)} days left</span>
                    )}
                  </div>
                  <button
                    onClick={() => joinChallenge(challenge.id)}
                    className="btn-primary w-full py-3"
                  >
                    Join Challenge
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          myChallenges.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
                <span className="text-5xl">💪</span>
              </div>
              <h2 className="text-[22px] font-bold mb-2">No active challenges</h2>
              <p className="text-[var(--text-secondary)] mb-8 max-w-xs mx-auto text-[15px]">
                Join a challenge to start building your creative habits
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="btn-primary px-8 py-4"
              >
                Discover Challenges
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myChallenges.map(challenge => (
                <div
                  key={challenge.id}
                  className="p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-[17px]">{challenge.name}</h3>
                      {challenge.description && (
                        <p className="text-[var(--text-secondary)] text-[14px] mt-1 line-clamp-2">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                    {challenge.end_date && (
                      <span className="px-3 py-1 rounded-full bg-[var(--warning)]/15 text-[var(--warning)] text-[12px] font-medium">
                        {getDaysRemaining(challenge.end_date)}d left
                      </span>
                    )}
                  </div>
                  {challenge.my_progress && (
                    <div className="flex items-center gap-6 p-4 mb-4 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                      <div className="text-center">
                        <p className="text-[24px] font-bold text-[var(--accent-purple)]">
                          🔥 {challenge.my_progress.current_streak}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">Day Streak</p>
                      </div>
                      <div className="w-px h-10 bg-[var(--separator)]" />
                      <div className="text-center">
                        <p className="text-[24px] font-bold">
                          {challenge.my_progress.total_completions}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">Completed</p>
                      </div>
                      <div className="w-px h-10 bg-[var(--separator)]" />
                      <div className="text-center">
                        <p className="text-[24px] font-bold">
                          {Math.round((challenge.my_progress.total_completions / challenge.duration_days) * 100)}%
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">Progress</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => leaveChallenge(challenge.id)}
                      className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[var(--text-secondary)] bg-[var(--bg)] hover:bg-[var(--surface-hover)]"
                    >
                      Leave
                    </button>
                    <Link
                      href="/sprint"
                      className="flex-1 btn-primary py-3 text-center"
                    >
                      Complete Today
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {showCreateModal && user && (
        <CreateChallengeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadChallenges()
            setActiveTab('my')
          }}
        />
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] p-6 animate-scale-in">
            <h2 className="text-[20px] font-bold mb-2">Join with Code</h2>
            <p className="text-[var(--text-secondary)] text-[14px] mb-6">
              Enter the invite code to join a private challenge
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="input-field w-full text-center text-[18px] tracking-widest mb-4"
              maxLength={8}
            />
            {joiningError && (
              <p className="text-[var(--error)] text-[13px] text-center mb-4">{joiningError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowJoinModal(false)
                  setJoinCode('')
                  setJoiningError(null)
                }}
                className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[var(--text-secondary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={joinWithCode}
                disabled={!joinCode.trim()}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
