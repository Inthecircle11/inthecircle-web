'use client'

import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getAdminBase } from '@/lib/admin'
import { Logo } from '@/components/Logo'
import Navigation from './Navigation'

const MFAChallenge = dynamic(() => import('./MFAChallenge'), { ssr: false })

interface User {
  id: string
  email: string
}

export interface ConnectedAccount {
  platform?: string
  username?: string
  follower_count?: number
}

interface Profile {
  id: string
  username: string | null
  name: string | null
  about: string | null
  profile_image_url: string | null
  niche: string | null
  location?: string | null
  platforms?: string[] | null
  connected_accounts?: ConnectedAccount[] | null
  phone?: string | null
  is_verified: boolean
}

interface AppContextType {
  user: User | null
  profile: Profile | null
  unreadCount: number
  loading: boolean
  signingOut: boolean
  profileImageVersion: number
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextType>({
  user: null,
  profile: null,
  unreadCount: 0,
  loading: true,
  signingOut: false,
  profileImageVersion: 0,
  refreshProfile: async () => {},
  signOut: async () => {},
})

/** Append cache-bust param so profile image updates show in real-time (same URL, file overwritten) */
export function profileImageUrl(url: string | null | undefined, version?: number): string {
  if (!url?.trim()) return ''
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}t=${version ?? Date.now()}`
}

export const useApp = () => useContext(AppContext)

export default function AppShell({
  children,
  adminBasePath,
}: {
  children: React.ReactNode
  adminBasePath?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [profileImageVersion, setProfileImageVersion] = useState(0)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/signup', '/success', '/forgot-password', '/update-password']
  const isPublicRoute = publicRoutes.includes(pathname || '')

  // Admin route: /admin or obscure path (e.g. /m8k2p9q) — don't redirect to signup, show admin login instead
  const adminBase = adminBasePath ? `/${adminBasePath}` : getAdminBase()
  const isAdminRoute =
    pathname?.startsWith('/admin') ||
    pathname === adminBase ||
    (pathname?.startsWith(adminBase + '/') ?? false)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAuth() {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setUser(null)
        setProfile(null)
        if (!isPublicRoute && !isAdminRoute) {
          router.push('/signup')
        }
        return
      }

      const authUser = session.user
      setUser({ id: authUser.id, email: authUser.email || '' })

      const profilePromise = supabase
        .from('profiles')
        .select('id, username, name, about, profile_image_url, niche, location, platforms, connected_accounts, phone, is_verified')
        .eq('id', authUser.id)
        .single()

      const mfaPromise = !isPublicRoute
        ? supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        : Promise.resolve({ data: null, error: null })

      const [profileResult, mfaResult] = await Promise.all([profilePromise, mfaPromise])

      if (profileResult.data) setProfile(profileResult.data)

      if (mfaResult.data?.nextLevel === 'aal2' && mfaResult.data?.currentLevel !== mfaResult.data?.nextLevel) {
        setMfaRequired(true)
      }

      loadUnreadCount(authUser.id)
    } catch (err) {
      console.error('[AppShell] checkAuth error:', err)
      // Don't leave user stuck on Loading; they can retry or sign out
    } finally {
      setLoading(false)
    }
  }

  async function loadUnreadCount(userId: string) {
    const supabase = createClient()
    
    // Get threads where user is participant
    const { data: threads } = await supabase
      .from('message_threads')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    
    if (!threads || threads.length === 0) {
      setUnreadCount(0)
      return
    }
    
    const threadIds = threads.map((t: { id: string }) => t.id)
    
    // Count messages in those threads not sent by user and not seen
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('thread_id', threadIds)
      .neq('sender_id', userId)
      .is('seen_at', null)
    
    setUnreadCount(count || 0)
  }

  async function refreshProfile() {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, name, about, profile_image_url, niche, location, platforms, connected_accounts, phone, is_verified')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data)
  }

  const signingOutRef = useRef(false)
  const signOut = useCallback(async () => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      router.push('/signup')
    } finally {
      signingOutRef.current = false
      setSigningOut(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time subscriptions: unread count + profile sync (debounced for performance)
  useEffect(() => {
    if (!user) return

    const supabase = createClient()
    let messageDebounce: NodeJS.Timeout
    
    // Debounced handler to avoid excessive reloads
    const handleMessageChange = () => {
      clearTimeout(messageDebounce)
      messageDebounce = setTimeout(() => loadUnreadCount(user.id), 1000)
    }

    // Only listen for messages where we're the recipient (more targeted)
    const ch1 = supabase
      .channel('app-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, handleMessageChange)
      .subscribe()

    const ch2 = supabase
      .channel('app-profile')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, () => {
        setProfileImageVersion(v => v + 1)
        refreshProfile()
      })
      .subscribe()

    return () => {
      clearTimeout(messageDebounce)
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // MFA challenge overlay - user has 2FA enrolled but needs to verify
  if (mfaRequired && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
        <Link href="/" className="text-2xl font-bold flex items-center justify-center gap-2 mb-2 gradient-text">
          <Logo size="sm" />
          inthecircle
        </Link>
        <div className="max-w-md w-full mt-8">
          <MFAChallenge
            onSuccess={() => setMfaRequired(false)}
            onCancel={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              setMfaRequired(false)
              router.push('/signup')
            }}
          />
        </div>
      </div>
    )
  }

  // Don't show nav on public routes or admin
  const showNav = user && !isPublicRoute && !isAdminRoute

  return (
    <AppContext.Provider value={{ user, profile, unreadCount, loading, signingOut, profileImageVersion, refreshProfile, signOut }}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {showNav && (
        <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--separator)]">
          <div className="w-full max-w-4xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
            <Link href="/feed" className="text-xl font-bold gradient-text tracking-tight flex-shrink-0 flex items-center gap-2" data-app-logo>
              <Logo size="sm" />
              inthecircle
            </Link>
            <Navigation unreadCount={unreadCount} variant="desktop" />
          </div>
        </header>
      )}
      <div id="main-content" tabIndex={-1} className={showNav ? 'pt-14 pb-20 md:pb-0 app-content' : ''}>
        <div key={pathname || 'app'} className="min-h-full animate-page-enter">
          {children}
        </div>
      </div>
      {showNav && <Navigation unreadCount={unreadCount} variant="mobile" />}
    </AppContext.Provider>
  )
}
