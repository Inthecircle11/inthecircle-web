'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

interface BlockedUser {
  id: string
  blocked_user_id: string
  blocked_at: string
  profile: {
    id: string
    name: string | null
    username: string | null
    profile_image_url: string | null
  } | null
}

export default function BlockedUsersPage() {
  const router = useRouter()
  const { user } = useApp()
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [unblocking, setUnblocking] = useState<string | null>(null)

  const loadBlockedUsers = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('blocked_users')
      .select(`
        id,
        blocked_user_id,
        blocked_at,
        profile:profiles!blocked_user_id(id, name, username, profile_image_url)
      `)
      .eq('blocker_id', user.id)
      .order('blocked_at', { ascending: false })

    // Transform data - handle profile as single object
    interface BlockedUserData {
      id: string
      blocked_user_id: string
      blocked_at: string
      profile: { id: string; name: string | null; username: string | null; profile_image_url: string | null } | { id: string; name: string | null; username: string | null; profile_image_url: string | null }[] | null
    }
    const transformed = (data as BlockedUserData[] || []).map((item: BlockedUserData) => ({
      id: item.id,
      blocked_user_id: item.blocked_user_id,
      blocked_at: item.blocked_at,
      profile: Array.isArray(item.profile) ? item.profile[0] : item.profile
    }))

    setBlockedUsers(transformed)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) {
      router.push('/signup')
      return
    }
    queueMicrotask(() => loadBlockedUsers())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleUnblock(blockedUserId: string) {
    if (!user || unblocking) return
    setUnblocking(blockedUserId)
    const supabase = createClient()

    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_user_id', blockedUserId)

      setBlockedUsers(prev => prev.filter(b => b.blocked_user_id !== blockedUserId))
    } catch (err) {
      console.error('Error unblocking user:', err)
    }
    setUnblocking(null)
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!user) {
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
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
          <Link
            href="/settings"
            className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-[17px] font-semibold">Blocked Users</h1>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No blocked users</h2>
            <p className="text-[var(--text-secondary)] max-w-xs mx-auto text-[15px]">
              You haven&apos;t blocked anyone yet. Blocked users won&apos;t be able to see your profile or message you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[var(--text-muted)] text-sm mb-4">
              {blockedUsers.length} blocked {blockedUsers.length === 1 ? 'user' : 'users'}
            </p>
            {blockedUsers.map(blocked => (
              <div
                key={blocked.id}
                className="flex items-center gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {blocked.profile?.profile_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={blocked.profile.profile_image_url}
                      alt={blocked.profile.name || 'User'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] font-bold text-lg">
                      {(blocked.profile?.name || blocked.profile?.username || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">
                    {blocked.profile?.name || blocked.profile?.username || 'Unknown User'}
                  </p>
                  {blocked.profile?.username && (
                    <p className="text-[var(--text-muted)] text-sm truncate">
                      @{blocked.profile.username}
                    </p>
                  )}
                  <p className="text-[var(--text-muted)] text-xs mt-1">
                    Blocked on {formatDate(blocked.blocked_at)}
                  </p>
                </div>

                {/* Unblock button */}
                <button
                  onClick={() => handleUnblock(blocked.blocked_user_id)}
                  disabled={unblocking === blocked.blocked_user_id}
                  className="px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors disabled:opacity-50"
                >
                  {unblocking === blocked.blocked_user_id ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
