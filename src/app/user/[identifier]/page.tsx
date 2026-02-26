'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp, type ConnectedAccount } from '@/components/AppShell'
import { IconChevronLeft, IconStar } from '@/components/Icons'
import Link from 'next/link'

interface UserIntent {
  id: string
  content: string
  created_at: string
  view_count: number
}

interface UserProfile {
  id: string
  username: string | null
  name: string | null
  about: string | null
  profile_image_url: string | null
  niche: string | null
  location: string | null
  platforms: string[] | null
  connected_accounts: ConnectedAccount[] | null
  is_verified: boolean
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
function getTotalFollowers(connectedAccounts: ConnectedAccount[] | null): number {
  if (!connectedAccounts || !Array.isArray(connectedAccounts)) return 0
  return connectedAccounts.reduce((sum, acc) => sum + parseFollowerCount(acc.follower_count), 0)
}

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser } = useApp()
  const identifier = params?.identifier as string

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [intents, setIntents] = useState<UserIntent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [imageVersion, setImageVersion] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (identifier) loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier])

  // Check connection status
  useEffect(() => {
    if (!currentUser || !profile || currentUser.id === profile.id) return
    checkConnectionStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, profile?.id])

  async function checkConnectionStatus() {
    if (!currentUser || !profile) return
    const supabase = createClient()
    
    // Check if there's a match
    const { data: match } = await supabase
      .from('creator_matches')
      .select('id')
      .or(`and(user_a_id.eq.${currentUser.id},user_b_id.eq.${profile.id}),and(user_a_id.eq.${profile.id},user_b_id.eq.${currentUser.id})`)
      .single()
    
    if (match) {
      setConnectionStatus('connected')
      return
    }
    
    // Check if we've already swiped
    const { data: swipe } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', currentUser.id)
      .eq('swiped_id', profile.id)
      .single()
    
    if (swipe) {
      setConnectionStatus('pending')
    } else {
      setConnectionStatus('none')
    }
  }

  async function handleConnect() {
    if (!currentUser || !profile || connecting) return
    setConnecting(true)
    const supabase = createClient()

    try {
      // Create a like swipe
      const { error: swipeError } = await supabase
        .from('swipes')
        .insert({
          swiper_id: currentUser.id,
          swiped_id: profile.id,
          action: 'like'
        })
      
      if (swipeError) throw swipeError

      // Check if they also liked us (creates a match)
      const { data: theirSwipe } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', profile.id)
        .eq('swiped_id', currentUser.id)
        .eq('action', 'like')
        .single()

      if (theirSwipe) {
        // Create a match!
        await supabase
          .from('creator_matches')
          .insert({
            user_a_id: currentUser.id,
            user_b_id: profile.id,
            is_super_match: false
          })
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('pending')
      }
    } catch (err) {
      console.error('Error connecting:', err)
    }
    setConnecting(false)
  }

  // Real-time sync when viewing another user's profile
  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    const ch1 = supabase
      .channel(`user-profile-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profile.id}`,
      }, () => {
        setImageVersion(v => v + 1)
        loadUser()
      })
      .subscribe()
    const ch2 = supabase
      .channel(`user-intents-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intents',
        filter: `author_id=eq.${profile.id}`,
      }, () => loadUser())
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function loadUser() {
    if (!identifier) return
    setLoading(true)
    setNotFound(false)
    setImageVersion(0)
    const supabase = createClient()

    try {
      let query = supabase
        .from('profiles')
        .select('id, username, name, about, profile_image_url, niche, location, platforms, connected_accounts, is_verified')

      if (isUuid(identifier)) {
        query = query.eq('id', identifier)
      } else {
        query = query.eq('username', identifier.replace(/^@/, ''))
      }

      const { data: profileData, error } = await query.single()

      if (error || !profileData) {
        setNotFound(true)
        setProfile(null)
        setIntents([])
        setLoading(false)
        return
      }

      setProfile(profileData)

      const { data: intentsData } = await supabase
        .from('intents')
        .select('id, content, created_at, view_count')
        .eq('author_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setIntents(intentsData || [])
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }

  function formatTimeAgo(dateStr: string): string {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    if (s < 604800) return `${Math.floor(s / 86400)}d`
    return new Date(dateStr).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-5xl">
          👤
        </div>
        <h2 className="text-title mb-2">Creator not found</h2>
        <p className="text-[var(--text-secondary)] text-body mb-8 text-center">This profile may not exist or has been removed.</p>
        <Link
          href="/explore"
          className="btn-gradient px-6 py-3 rounded-xl font-semibold min-h-[48px] inline-flex items-center justify-center"
        >
          Explore Creators
        </Link>
      </div>
    )
  }

  const totalFollowers = getTotalFollowers(profile.connected_accounts)
  const isOwnProfile = currentUser?.id === profile.id

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 md:relative bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface)] transition-colors"
            aria-label="Back"
          >
            <IconChevronLeft size={20} />
          </button>
          <h1 className="text-headline truncate max-w-[60%]">
            {profile.name || profile.username || 'Profile'}
          </h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
        {/* Hero cover - matches app 180px */}
        <div className="relative h-[180px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--gradient-start)] via-[#9333ea] to-[var(--gradient-end)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg)]/50 to-[var(--bg)]" />
        </div>

        {/* Profile block */}
        <div className="px-4 md:px-6 -mt-[55px] relative">
          <div className="flex flex-col items-center text-center">
            {/* Avatar with gradient ring */}
            <div className="relative flex items-center justify-center w-[110px] h-[110px]">
              <div
                className="absolute inset-0 rounded-full p-[5px]"
                style={{
                  background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                }}
              >
                <div className="w-full h-full rounded-full bg-[var(--bg)] overflow-hidden">
                  {profile.profile_image_url?.trim() && !avatarError ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${profile.profile_image_url}${profile.profile_image_url.includes('?') ? '&' : '?'}t=${imageVersion}`}
                      alt={profile.name || 'Profile'}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--accent)] text-3xl font-bold bg-gradient-to-br from-[var(--gradient-start)]/40 to-[var(--gradient-end)]/20">
                      {(profile.name || profile.username || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h2 className="mt-5 text-title flex items-center gap-2 justify-center">
              {profile.name || profile.username || 'Unknown'}
              {profile.is_verified && (
                <svg className="w-5 h-5 text-[var(--verified)] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                </svg>
              )}
            </h2>
            <p className="text-[var(--text-secondary)] text-footnote mt-1">
              {profile.username ? `@${profile.username}` : ''}
            </p>
            <p className="mt-2 text-callout font-bold text-[var(--text)]">
              <span>{formatFollowerCount(totalFollowers)}</span>
              <span className="text-[var(--text-secondary)] font-medium ml-1">Followers</span>
            </p>
            {profile.about && (
              <p className="mt-3 text-[var(--text-secondary)] text-body max-w-sm leading-relaxed">
                {profile.about}
              </p>
            )}
            {profile.niche && (
              <span className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-body font-medium text-white bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] shadow-[0_4px_12px_rgba(168,85,247,0.4)]">
                <IconStar className="w-4 h-4 shrink-0" />
                {profile.niche}
              </span>
            )}
            {profile.location && (
              <p className="mt-3 flex items-center gap-1.5 text-[var(--text-secondary)] text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                {profile.location}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-around py-5 mt-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="text-center">
              <p className="text-title">{intents.length}</p>
              <p className="text-[var(--text-muted)] text-caption mt-1 font-medium">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-title">{formatFollowerCount(totalFollowers)}</p>
              <p className="text-[var(--text-muted)] text-caption mt-1 font-medium">Followers</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        {currentUser && !isOwnProfile && (
          <div className="px-4 md:px-6 mt-6 flex gap-3">
            {connectionStatus === 'connected' ? (
              <>
                <Link
                  href="/inbox"
                  className="btn-gradient flex-1 flex items-center justify-center gap-2 py-4 font-semibold rounded-2xl min-h-[48px] shadow-[0_4px_20px_rgba(168,85,247,0.4)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Message
                </Link>
                <div className="flex items-center gap-2 px-4 py-4 rounded-2xl bg-[var(--success)]/20 text-[var(--success)]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                  </svg>
                  Connected
                </div>
              </>
            ) : connectionStatus === 'pending' ? (
              <div className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Connection Pending
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn-gradient flex-1 flex items-center justify-center gap-2 py-4 font-semibold rounded-2xl min-h-[48px] shadow-[0_4px_20px_rgba(168,85,247,0.4)] disabled:opacity-50"
              >
                {connecting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                )}
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        )}

        {/* Posts */}
        <div className="px-4 md:px-6 py-6 space-y-4">
          <h3 className="text-headline">Posts</h3>
          {intents.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
              <p className="text-body font-medium text-[var(--text-secondary)]">No posts yet</p>
              <p className="text-footnote text-[var(--text-muted)] mt-1">This creator hasn&apos;t shared anything yet</p>
            </div>
          ) : (
            intents.map(intent => (
              <article
                key={intent.id}
                className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-[var(--border-strong)] transition-colors"
              >
                <p className="text-[var(--text)] text-body leading-relaxed whitespace-pre-wrap">
                  {intent.content}
                </p>
                <div className="flex items-center gap-4 mt-4 text-[var(--text-muted)] text-caption">
                  <span>{intent.view_count || 0} {(intent.view_count || 0) === 1 ? 'view' : 'views'}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(intent.created_at)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
