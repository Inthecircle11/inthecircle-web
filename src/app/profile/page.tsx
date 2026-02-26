'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useApp, profileImageUrl, type ConnectedAccount } from '@/components/AppShell'
import Link from 'next/link'

const MFAEnroll = dynamic(() => import('@/components/MFAEnroll'), { ssr: false })

interface UserIntent {
  id: string
  content: string
  created_at: string
  view_count: number
}

interface Stats {
  posts: number
  connections: number
  followers: number
}

const MAX_DISPLAY_FOLLOWERS = 999_999_999

function parseFollowerCount(val: unknown): number {
  if (val == null) return 0
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (!Number.isFinite(n) || n < 0 || n > MAX_DISPLAY_FOLLOWERS) return 0
  return Math.floor(n)
}

function getTotalFollowers(connectedAccounts: ConnectedAccount[] | null): number {
  if (!connectedAccounts || !Array.isArray(connectedAccounts)) return 0
  return connectedAccounts.reduce((sum, acc) => sum + parseFollowerCount(acc.follower_count), 0)
}

function formatFollowerCount(n: number): string {
  const safe = Math.floor(parseFollowerCount(n))
  if (safe === 0) return '0'
  if (safe >= 1_000_000) {
    const m = safe / 1_000_000
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')) + 'M'
  }
  if (safe >= 1_000) {
    const k = safe / 1_000
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')) + 'K'
  }
  return String(safe)
}

export default function ProfilePage() {
  const { user, profile, profileImageVersion, refreshProfile, signOut, signingOut } = useApp()
  const [intents, setIntents] = useState<UserIntent[]>([])
  const [stats, setStats] = useState<Stats>({ posts: 0, connections: 0, followers: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts')
  const [avatarError, setAvatarError] = useState(false)
  const [hasMFA, setHasMFA] = useState<boolean | null>(null)
  const [showMFAEnroll, setShowMFAEnroll] = useState(false)

  useEffect(() => {
    if (user) loadProfileData()
  }, [user])

  useEffect(() => {
    async function checkMFA() {
      if (!user) return
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      const totpCount = data?.totp?.length ?? 0
      setHasMFA(totpCount > 0)
    }
    if (user) checkMFA()
  }, [user])

  // Real-time sync
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const ch1 = supabase
      .channel('profile-intents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intents',
        filter: `author_id=eq.${user.id}`,
      }, () => loadProfileData())
      .subscribe()
    const ch2 = supabase
      .channel('profile-matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'creator_matches',
      }, (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const r = payload.new ?? payload.old
        if (r && ((r.user_a_id as string) === user.id || (r.user_b_id as string) === user.id)) {
          loadProfileData()
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [user])

  async function loadProfileData() {
    if (!user) return
    const supabase = createClient()
    const { data: intentsData } = await supabase
      .from('intents')
      .select('id, content, created_at, view_count')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setIntents(intentsData || [])
    const { count: connectionCount } = await supabase
      .from('creator_matches')
      .select('*', { count: 'exact', head: true })
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    setStats({
      posts: intentsData?.length || 0,
      connections: connectionCount || 0,
      followers: getTotalFollowers(profile?.connected_accounts ?? null)
    })
    setLoading(false)
  }

  useEffect(() => {
    if (profile) {
      setStats(prev => ({ ...prev, followers: getTotalFollowers(profile.connected_accounts ?? null) }))
      setAvatarError(false)
    }
  }, [profile])

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
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalFollowers = getTotalFollowers(profile?.connected_accounts ?? null)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="w-16" aria-hidden />
          <h1 className="text-[18px] font-bold tracking-tight">Profile</h1>
          <button
            type="button"
            onClick={() => signOut()}
            disabled={signingOut}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] text-[15px] font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto pb-24 md:pb-6">
        {/* Hero cover */}
        <div className="relative h-[160px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-purple)] via-[#7C3AED] to-[var(--accent-purple-alt)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/40 to-transparent" />
        </div>

        {/* Profile block */}
        <div className="px-4 md:px-6 -mt-[72px] relative">
          <div className="flex flex-col items-center text-center">
            {/* Avatar with gradient ring */}
            <div className="relative group">
              <div className="avatar-ring w-[120px] h-[120px]">
                {profile?.profile_image_url?.trim() && !avatarError ? (
                  <img
                    src={profileImageUrl(profile.profile_image_url, profileImageVersion)}
                    alt={profile.name || profile.username || 'Profile'}
                    className="w-full h-full object-cover rounded-full bg-[var(--bg)]"
                    onError={() => setAvatarError(true)}
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center text-[var(--accent-purple)] text-3xl font-bold bg-[var(--surface)]">
                    {(profile?.name || profile?.username || user?.email || '?')[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setAvatarError(false); refreshProfile() }}
                className="absolute bottom-1 right-1 p-2 rounded-full bg-[var(--surface)] border border-[var(--separator)] shadow-lg hover:bg-[var(--surface-hover)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Refresh profile picture"
                aria-label="Refresh profile picture"
              >
                <svg className="w-4 h-4 text-[var(--text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            {/* Name with verified badge */}
            <h2 className="mt-5 text-[22px] font-bold tracking-tight flex items-center gap-2 justify-center">
              {profile?.name || profile?.username || user?.email?.split('@')[0] || 'User'}
              {profile?.is_verified && (
                <svg className="w-5 h-5 text-[var(--verified)]" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                </svg>
              )}
            </h2>
            
            <p className="text-[var(--text-secondary)] text-[15px] mt-1">
              {profile?.username ? `@${profile.username}` : user?.email}
            </p>
            
            {/* Followers count */}
            <p className="mt-2 text-[17px]">
              <span className="font-bold text-[var(--text)]">{formatFollowerCount(totalFollowers)}</span>
              <span className="text-[var(--text-secondary)] font-medium ml-1">Followers</span>
            </p>
            
            {profile?.about && (
              <p className="mt-3 text-[var(--text-secondary)] text-[15px] max-w-sm leading-relaxed">
                {profile.about}
              </p>
            )}
            
            {/* Niche badge */}
            {profile?.niche && (
              <span className="niche-badge mt-4">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 18.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                {profile.niche}
              </span>
            )}
            
            {profile?.location && (
              <p className="mt-3 flex items-center gap-1.5 text-[var(--text-secondary)] text-[14px]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                {profile.location}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 w-full max-w-sm">
              <Link
                href="/profile/edit"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[var(--radius-sm)] font-semibold text-[14px] text-[var(--accent-purple)] bg-[var(--accent-purple)]/12 border border-[var(--accent-purple)]/30 hover:bg-[var(--accent-purple)]/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    navigator.share({
                      title: profile?.name || 'Profile',
                      url: typeof window !== 'undefined' ? window.location.href : '',
                      text: `Check out my profile on InTheCircle`,
                    }).catch(() => {})
                  } else {
                    navigator.clipboard?.writeText(typeof window !== 'undefined' ? window.location.href : '')
                  }
                }}
                className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-sm)] text-[var(--accent-purple)] bg-[var(--accent-purple)]/12 border border-[var(--accent-purple)]/30 hover:bg-[var(--accent-purple)]/20 transition-colors"
                aria-label="Share profile"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="flex justify-around py-6 mt-6 rounded-2xl bg-[var(--surface)]/80 border border-[var(--separator)] shadow-[var(--shadow-soft)]">
            <div className="text-center">
              <p className="text-[20px] font-bold">{stats.posts}</p>
              <p className="text-[var(--text-muted)] text-[12px] mt-1 font-medium">Posts</p>
            </div>
            <div className="w-px bg-[var(--separator)]" />
            <div className="text-center">
              <p className="text-[20px] font-bold">{stats.connections}</p>
              <p className="text-[var(--text-muted)] text-[12px] mt-1 font-medium">Connections</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 px-4 md:px-6">
          <div className="segmented-control">
            <button
              type="button"
              className={activeTab === 'posts' ? 'active' : ''}
              onClick={() => setActiveTab('posts')}
            >
              <svg className="w-4 h-4 mr-1.5 inline" fill={activeTab === 'posts' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6a4 4 0 014 4v1" />
              </svg>
              Posts
            </button>
            <button
              type="button"
              className={activeTab === 'about' ? 'active' : ''}
              onClick={() => setActiveTab('about')}
            >
              <svg className="w-4 h-4 mr-1.5 inline" fill={activeTab === 'about' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              About
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'posts' ? (
          <div className="px-4 md:px-6 py-6 space-y-4">
            {intents.length === 0 ? (
              <div className="text-center py-16 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]">
                <div className="w-20 h-20 mx-auto mb-5 rounded-[var(--radius-lg)] bg-[var(--surface-hover)] border border-[var(--separator)] flex items-center justify-center">
                  <span className="text-4xl">📝</span>
                </div>
                <p className="font-semibold text-[var(--text-secondary)] text-[17px]">No posts yet</p>
                <p className="text-[15px] text-[var(--text-muted)] mt-2">Share your first intent in the app</p>
              </div>
            ) : (
              intents.map(intent => (
                <article
                  key={intent.id}
                  className="p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <p className="text-[var(--text)] text-[15px] leading-relaxed whitespace-pre-wrap">
                    {intent.content}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-[var(--text-muted)] text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {intent.view_count || 0} {(intent.view_count || 0) === 1 ? 'view' : 'views'}
                    </span>
                    <span>·</span>
                    <span>{formatTimeAgo(intent.created_at)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="px-4 md:px-6 py-6 space-y-3">
            <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
              <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Email</p>
              <p className="text-[var(--text)] text-[15px]">{user?.email || 'Not set'}</p>
            </div>
            <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
              <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Username</p>
              <p className="text-[var(--text)] text-[15px]">{profile?.username ? `@${profile.username}` : 'Not set'}</p>
            </div>
            {profile?.phone && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Phone</p>
                <p className="text-[var(--text)] text-[15px]">{profile.phone}</p>
              </div>
            )}
            {profile?.location && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Location</p>
                <p className="text-[var(--text)] text-[15px]">{profile.location}</p>
              </div>
            )}
            {profile?.niche && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Niche</p>
                <p className="text-[var(--text)] text-[15px]">{profile.niche}</p>
              </div>
            )}
            {profile?.platforms && profile.platforms.length > 0 && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wider">Platforms</p>
                <p className="text-[var(--text)] text-[15px]">{profile.platforms.join(', ')}</p>
              </div>
            )}
            {profile?.connected_accounts && profile.connected_accounts.length > 0 && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[12px] text-[var(--text-muted)] font-medium mb-2 uppercase tracking-wider">Connected Accounts</p>
                <div className="space-y-2">
                  {profile.connected_accounts.map((acc, i) => (
                    <div key={i} className="flex items-center justify-between text-[14px]">
                      <span className="capitalize text-[var(--text)]">{acc.platform || 'Social'}</span>
                      <div className="flex items-center gap-2">
                        {acc.username && <span className="text-[var(--text-secondary)]">@{acc.username}</span>}
                        {parseFollowerCount(acc.follower_count) > 0 && (
                          <span className="text-[var(--accent-purple)] font-medium">
                            {formatFollowerCount(parseFollowerCount(acc.follower_count))} followers
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Two-factor authentication */}
            <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--separator)]">
              <p className="text-[12px] text-[var(--text-muted)] font-medium mb-2 uppercase tracking-wider">Two-factor authentication</p>
              <p className="text-[14px] text-[var(--text-secondary)] mb-3">
                {hasMFA === true
                  ? 'Authenticator app is enabled. Your account is protected.'
                  : 'Add an extra layer of security with an authenticator app.'}
              </p>
              {hasMFA === true ? (
                <p className="text-[13px] text-[var(--success)] font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                  </svg>
                  2FA enabled
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMFAEnroll(true)}
                  className="flex items-center gap-2 py-2 px-4 rounded-[var(--radius-sm)] text-[14px] font-semibold text-[var(--accent-purple)] bg-[var(--accent-purple)]/12 border border-[var(--accent-purple)]/30 hover:bg-[var(--accent-purple)]/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Enable 2FA
                </button>
              )}
            </div>
            
            {showMFAEnroll && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="max-w-md w-full max-h-[90vh] overflow-y-auto p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)]">
                  <MFAEnroll
                    onEnrolled={() => {
                      setShowMFAEnroll(false)
                      setHasMFA(true)
                    }}
                    onCancelled={() => setShowMFAEnroll(false)}
                  />
                </div>
              </div>
            )}
            
            <Link
              href="/profile/edit"
              className="btn-gradient flex items-center justify-center gap-2 mt-6 py-4 w-full rounded-[var(--radius-md)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit Profile
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
