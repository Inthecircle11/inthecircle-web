'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

interface Creator {
  id: string
  name: string | null
  username: string | null
  about: string | null
  niche: string | null
  location: string | null
  profile_image_url: string | null
  is_verified: boolean
  connected_accounts: { platform: string; username: string; follower_count: number }[] | null
  work_sample_urls: string[] | null
  collab_preferences: string[] | null
}

interface Match {
  id: string
  user_a_id: string
  user_b_id: string
  status: string
  created_at: string
}

const NICHES = [
  { id: 'All', label: 'All', icon: '' },
  { id: 'Lifestyle & Entertainment', label: 'Lifestyle & Entertainment', icon: '🎬' },
  { id: 'Food & Travel', label: 'Food & Travel', icon: '✈️' },
  { id: 'Fitness & Wellness', label: 'Fitness & Wellness', icon: '💪' },
  { id: 'Tech & Gaming', label: 'Tech & Gaming', icon: '🎮' },
  { id: 'Music & Art', label: 'Music & Art', icon: '🎵' },
  { id: 'Business & Finance', label: 'Business & Finance', icon: '💼' },
  { id: 'Education', label: 'Education', icon: '📚' },
  { id: 'Aviation', label: 'Aviation', icon: '✈️' },
]

export default function ConnectPage() {
  const { user, profile } = useApp()
  const [creators, setCreators] = useState<Creator[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set())
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedNiche, setSelectedNiche] = useState('All')
  const [showMatchModal, setShowMatchModal] = useState<Creator | null>(null)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)

  const loadCreators = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      // Get users we've already swiped on
      const { data: swipes } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', user.id)
      
      const swipedUserIds = new Set<string>(swipes?.map((s: { swiped_id: string }) => s.swiped_id) || [])
      setSwipedIds(swipedUserIds)

      // Get existing matches
      const { data: existingMatches } = await supabase
        .from('creator_matches')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      
      setMatches(existingMatches || [])
      const matchedIds = new Set<string>(existingMatches?.flatMap((m: Match) => [m.user_a_id, m.user_b_id]) || [])

      // Get creators to show
      let query = supabase
        .from('profiles')
        .select('id, name, username, about, niche, location, profile_image_url, is_verified, connected_accounts, work_sample_urls, collab_preferences')
        .neq('id', user.id)
        .limit(50)

      if (selectedNiche !== 'All') {
        query = query.eq('niche', selectedNiche)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Filter out already swiped and matched users
      const filteredCreators = (data || []).filter(
        (c: Creator) => !swipedUserIds.has(c.id) && !matchedIds.has(c.id)
      )
      
      setCreators(filteredCreators)
      setCurrentIndex(0)
    } catch (err) {
      console.error('Failed to load creators:', err)
    }
    setLoading(false)
  }, [user, selectedNiche])

  useEffect(() => {
    if (user) loadCreators()
  }, [user, loadCreators])

  async function handleSwipe(direction: 'left' | 'right') {
    if (!user || currentIndex >= creators.length) return
    
    const creator = creators[currentIndex]
    setSwipeDirection(direction)
    
    const supabase = createClient()

    try {
      // Record the swipe (use 'like' for right swipe, 'pass' for left)
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: creator.id,
        action: direction === 'right' ? 'like' : 'pass',
      })

      if (direction === 'right') {
        // Check if they've also liked us
        const { data: theirSwipe } = await supabase
          .from('swipes')
          .select('*')
          .eq('swiper_id', creator.id)
          .eq('swiped_id', user.id)
          .eq('action', 'like')
          .single()

        if (theirSwipe) {
          // It's a match!
          await supabase.from('creator_matches').insert({
            user_a_id: user.id,
            user_b_id: creator.id,
            is_super_match: false,
          })
          
          // Create notification for both users
          await supabase.from('notifications').insert([
            {
              user_id: user.id,
              type: 'match',
              title: 'New Match!',
              body: `You matched with ${creator.name || creator.username}!`,
              actor_user_id: creator.id,
              actor_name: creator.name,
              actor_username: creator.username,
              actor_avatar_url: creator.profile_image_url,
            },
            {
              user_id: creator.id,
              type: 'match',
              title: 'New Match!',
              body: `You matched with ${profile?.name || profile?.username}!`,
              actor_user_id: user.id,
              actor_name: profile?.name,
              actor_username: profile?.username,
              actor_avatar_url: profile?.profile_image_url,
            }
          ])
          
          setShowMatchModal(creator)
        }
      }

      // Move to next card after animation
      setTimeout(() => {
        setSwipeDirection(null)
        setCurrentIndex(prev => prev + 1)
      }, 300)

    } catch (err) {
      console.error('Failed to record swipe:', err)
      setSwipeDirection(null)
    }
  }

  function formatFollowers(accounts: Creator['connected_accounts']): string {
    if (!accounts || accounts.length === 0) return '0'
    const total = accounts.reduce((sum, acc) => sum + (acc.follower_count || 0), 0)
    if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`
    if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
    return String(total)
  }

  const currentCreator = creators[currentIndex]

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            <h1 className="text-[17px] font-semibold">Connect</h1>
            <Link
              href="/matches"
              className="flex items-center gap-2 text-[var(--accent-purple)] text-[14px] font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              {matches.length > 0 && <span>{matches.length}</span>}
            </Link>
          </div>
          
          {/* Niche filters */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {NICHES.map(niche => (
              <button
                key={niche.id}
                onClick={() => setSelectedNiche(niche.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                  selectedNiche === niche.id
                    ? 'bg-[var(--accent)] text-[var(--button-text-on-accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {niche.icon && <span>{niche.icon}</span>}
                {niche.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
        {!currentCreator ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <span className="text-5xl">🎯</span>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No more creators</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xs mx-auto text-[15px]">
              {selectedNiche !== 'All' 
                ? `No more ${selectedNiche} creators to discover right now`
                : "You've seen all available creators. Check back later!"
              }
            </p>
            <button
              onClick={() => {
                setSelectedNiche('All')
                loadCreators()
              }}
              className="btn-secondary px-8 py-4"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Swipe Card */}
            <div 
              className={`relative bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--separator)] overflow-hidden transition-all duration-300 ${
                swipeDirection === 'left' ? 'translate-x-[-120%] rotate-[-15deg] opacity-0' :
                swipeDirection === 'right' ? 'translate-x-[120%] rotate-[15deg] opacity-0' : ''
              }`}
            >
              {/* Cover Image or Gradient */}
              <div className="h-[300px] relative overflow-hidden">
                {currentCreator.profile_image_url ? (
                  <img
                    src={currentCreator.profile_image_url}
                    alt={currentCreator.name || 'Creator'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-purple-alt)] flex items-center justify-center">
                    <span className="text-8xl font-bold text-white/30">
                      {(currentCreator.name || currentCreator.username || '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" />
                
                {/* Match score badge */}
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-[var(--accent-purple)]/90 text-white text-[12px] font-bold">
                  {Math.floor(Math.random() * 30) + 70}% Match
                </div>
                
                {/* Verified badge */}
                {currentCreator.is_verified && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-[var(--verified)]/90 text-white text-[12px] font-bold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                    </svg>
                    Verified
                  </div>
                )}
              </div>
              
              {/* Creator Info */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[22px] font-bold flex items-center gap-2">
                      {currentCreator.name || currentCreator.username || 'Creator'}
                    </h2>
                    {currentCreator.username && (
                      <p className="text-[var(--text-muted)] text-[14px]">@{currentCreator.username}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-bold">{formatFollowers(currentCreator.connected_accounts)}</p>
                    <p className="text-[var(--text-muted)] text-[12px]">followers</p>
                  </div>
                </div>
                
                {currentCreator.niche && (
                  <span className="niche-badge mt-3 inline-flex">
                    {currentCreator.niche}
                  </span>
                )}
                
                {currentCreator.location && (
                  <p className="flex items-center gap-1.5 mt-3 text-[var(--text-secondary)] text-[14px]">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    {currentCreator.location}
                  </p>
                )}
                
                {currentCreator.about && (
                  <p className="mt-4 text-[var(--text-secondary)] text-[14px] leading-relaxed line-clamp-3">
                    {currentCreator.about}
                  </p>
                )}
                
                {/* Collab preferences */}
                {currentCreator.collab_preferences && currentCreator.collab_preferences.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentCreator.collab_preferences.slice(0, 4).map((pref, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] text-[12px]">
                        {pref}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Work samples */}
                {currentCreator.work_sample_urls && currentCreator.work_sample_urls.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {currentCreator.work_sample_urls.slice(0, 3).map((url, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-[var(--surface-hover)]">
                        <img src={url} alt="Work sample" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <button
                onClick={() => handleSwipe('left')}
                className="w-16 h-16 rounded-full bg-[var(--surface)] border-2 border-[var(--separator)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all active:scale-90"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <button
                onClick={() => handleSwipe('right')}
                className="w-20 h-20 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-white hover:bg-[var(--accent-purple-alt)] transition-all active:scale-90 shadow-lg shadow-[var(--accent-purple)]/30"
              >
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
            
            <p className="text-center text-[var(--text-muted)] text-[13px] mt-4">
              {creators.length - currentIndex - 1} more creators to discover
            </p>
          </>
        )}
      </main>

      {/* Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] p-8 text-center animate-scale-in">
            <div className="relative w-24 h-24 mx-auto mb-6">
              {/* Confetti effect placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl animate-bounce">🎉</span>
              </div>
            </div>
            
            <h2 className="text-[24px] font-bold mb-2">It&apos;s a Match!</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              You and {showMatchModal.name || showMatchModal.username} liked each other
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowMatchModal(null)}
                className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[var(--text-secondary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Keep Swiping
              </button>
              <Link
                href="/inbox"
                className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-white bg-[var(--accent-purple)] hover:bg-[var(--accent-purple-alt)] transition-colors"
              >
                Send Message
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
