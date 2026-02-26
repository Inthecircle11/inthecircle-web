'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import { OptimizedAvatar } from '@/components/OptimizedAvatar'
import { ExploreSkeleton } from '@/components/Skeleton'
import Link from 'next/link'

interface ConnectedAccount {
  platform?: string
  username?: string
  follower_count?: number
}

interface Creator {
  id: string
  username: string | null
  name: string | null
  about: string | null
  profile_image_url: string | null
  niche: string | null
  is_verified: boolean
  connected_accounts: ConnectedAccount[] | null
}

const MAX_FOLLOWERS = 999_999_999
function parseFollowerCount(val: unknown): number {
  if (val == null) return 0
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (!Number.isFinite(n) || n < 0 || n > MAX_FOLLOWERS) return 0
  return Math.floor(n)
}
function formatFollowerCount(n: number): string {
  const safe = parseFollowerCount(n)
  if (safe === 0) return '0'
  if (safe >= 1_000_000) return (safe / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (safe >= 1_000) return (safe / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(safe)
}

// Niche categories matching iOS app
const NICHES = [
  { value: 'All', icon: '✨' },
  { value: 'Lifestyle', icon: '❤️' },
  { value: 'Fashion', icon: '👕' },
  { value: 'Beauty', icon: '💄' },
  { value: 'Fitness', icon: '🏃' },
  { value: 'Food', icon: '🍴' },
  { value: 'Travel', icon: '✈️' },
  { value: 'Tech', icon: '💻' },
  { value: 'Gaming', icon: '🎮' },
  { value: 'Music', icon: '🎵' },
  { value: 'Art', icon: '🎨' },
  { value: 'Business', icon: '💼' },
]

export default function ExplorePage() {
  const { user } = useApp()
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [imageVersion, setImageVersion] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCreators = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, username, name, about, profile_image_url, niche, is_verified, connected_accounts')
        .limit(100)
      if (queryError) {
        setError(`Database error: ${queryError.message}`)
        setCreators([])
      } else {
        let filtered: Creator[] = (data as Creator[] | null) || []
        if (user) filtered = filtered.filter((p: Creator) => p.id !== user.id)
        if (selectedNiche && selectedNiche !== 'All') {
          filtered = filtered.filter((p: Creator) => p.niche?.toLowerCase().includes(selectedNiche.toLowerCase()))
        }
        setCreators(filtered)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [user, selectedNiche])

  useEffect(() => {
    if (user !== undefined) queueMicrotask(() => loadCreators())
  }, [user, selectedNiche, loadCreators])

  // Real-time sync
  useEffect(() => {
    const supabase = createClient()
    let debounceTimer: ReturnType<typeof setTimeout>
    const ch = supabase
      .channel('explore-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          setImageVersion(v => v + 1)
          loadCreators()
        }, 500)
      })
      .subscribe()
    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(ch)
    }
  }, [loadCreators])

  const filteredCreators = creators.filter(c => {
    if (!searchText) return true
    const s = searchText.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.username?.toLowerCase().includes(s) || c.about?.toLowerCase().includes(s) || c.niche?.toLowerCase().includes(s)
  })

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header - iOS style with large title */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4">
          <h1 className="text-[28px] font-bold mb-4">Explore</h1>
          
          {/* Search bar - iOS style */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search creators..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="input-field w-full pl-12"
            />
          </div>
          
          {/* Niche chips - iOS style horizontal scroll */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
            {NICHES.map(niche => {
              const isSelected = (niche.value === 'All' && !selectedNiche) || selectedNiche === niche.value
              return (
                <button
                  key={niche.value}
                  onClick={() => setSelectedNiche(niche.value === 'All' ? null : niche.value)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--button-text-on-accent)]'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--separator)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <span>{niche.icon}</span>
                  <span>{niche.value}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-sm)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <ExploreSkeleton />
        ) : filteredCreators.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--text-secondary)] text-[17px]">
              {searchText ? 'No creators match your search' : selectedNiche ? 'No creators in this niche' : 'No creators found'}
            </p>
            <p className="text-[15px] text-[var(--text-muted)] mt-2">
              {searchText ? 'Try a different search term' : 'Check back later'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCreators.map((creator, index) => (
              <CreatorCard key={creator.id} creator={creator} imageVersion={imageVersion} staggerIndex={index} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function CreatorCard({ creator, imageVersion, staggerIndex = 0 }: { creator: Creator; imageVersion: number; staggerIndex?: number }) {
  const totalFollowers = (creator.connected_accounts || []).reduce((s, a) => s + parseFollowerCount(a.follower_count), 0)
  
  return (
    <Link
      href={`/user/${creator.username || creator.id}`}
      className="block p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-smooth animate-fade-in-up group"
      style={{ animationDelay: `${Math.min(staggerIndex, 12) * 40}ms` }}
    >
      <div className="flex flex-col items-center text-center min-w-0 w-full">
        {/* Avatar with ring on hover */}
        <div className="relative mb-3">
          {creator.profile_image_url ? (
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-[var(--accent-purple)] transition-all">
              <OptimizedAvatar
                src={`${creator.profile_image_url}${creator.profile_image_url.includes('?') ? '&' : '?'}t=${imageVersion}`}
                alt={creator.name || creator.username || 'Creator'}
                size={80}
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] text-2xl font-bold ring-2 ring-transparent group-hover:ring-[var(--accent-purple)] transition-all">
              {(creator.name || creator.username || '?')[0]?.toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Name with verified badge */}
        <div className="flex items-center gap-1.5 mb-1 min-w-0 w-full justify-center">
          <span className="font-semibold text-[15px] truncate">{creator.name || creator.username || 'Unknown'}</span>
          {creator.is_verified && (
            <svg className="w-4 h-4 text-[var(--verified)] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
            </svg>
          )}
        </div>
        
        {creator.username && (
          <p className="text-[var(--text-muted)] text-[13px] truncate max-w-full">@{creator.username}</p>
        )}
        
        {/* Niche badge */}
        {creator.niche && (
          <span className="mt-2 px-3 py-1 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] text-[11px] font-medium">
            {creator.niche}
          </span>
        )}
        
        {totalFollowers > 0 && (
          <p className="mt-1.5 text-[var(--text-muted)] text-[12px] font-medium">
            {formatFollowerCount(totalFollowers)} followers
          </p>
        )}
        
        {creator.about && (
          <p className="mt-2 text-[var(--text-secondary)] text-[12px] line-clamp-2">{creator.about}</p>
        )}
      </div>
    </Link>
  )
}
