'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import { Logo } from '@/components/Logo'
import { OptimizedAvatar } from '@/components/OptimizedAvatar'
import { FeedSkeleton } from '@/components/Skeleton'
import { IconPlus, IconRefresh, IconMeet, IconCollab, IconAsk, IconAvailable, IconHeart, IconComment, IconShare, IconEye } from '@/components/Icons'
import Link from 'next/link'

const CreateIntentModal = dynamic(() => import('@/components/CreateIntentModal'), { ssr: false })
const CommentsModal = dynamic(() => import('@/components/CommentsModal'), { ssr: false })

interface Intent {
  id: string
  author_id: string
  author_name: string
  author_username: string
  author_image_url: string | null
  intent_type: string | null
  content: string
  created_at: string
  view_count: number
  comment_count?: number
  response_count?: number
  like_count?: number
}

export default function FeedPage() {
  const { user, profile } = useApp()
  const [intents, setIntents] = useState<Intent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [likedIntents, setLikedIntents] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'meet', label: 'Meet', Icon: IconMeet },
    { id: 'collaborate', label: 'Collab', Icon: IconCollab },
    { id: 'ask', label: 'Ask', Icon: IconAsk },
    { id: 'availability', label: 'Available', Icon: IconAvailable },
  ]

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      // Load intents
      let query = supabase
        .from('intents')
        .select('id, author_id, author_name, author_username, author_image_url, intent_type, content, created_at, view_count')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (activeFilter !== 'all') {
        query = query.ilike('intent_type', activeFilter)
      }

      const { data, error: queryError } = await query
      
      if (queryError) {
        setError(`Database error: ${queryError.message}`)
        setIntents([])
        setLoading(false)
        return
      }
      if (!data || data.length === 0) {
        setIntents([])
        setLoading(false)
        return
      }

      const intentIds = data.map((i: Intent) => i.id)
      
      // Load likes for these intents (in parallel)
      const [likesResult, userLikesResult] = await Promise.all([
        supabase
          .from('intent_likes')
          .select('intent_id')
          .in('intent_id', intentIds),
        user ? supabase
          .from('intent_likes')
          .select('intent_id')
          .in('intent_id', intentIds)
          .eq('user_id', user.id) : Promise.resolve({ data: [] })
      ])
      
      // Count likes per intent
      const likeCountMap: Record<string, number> = {}
      likesResult.data?.forEach((like: { intent_id: string }) => {
        likeCountMap[like.intent_id] = (likeCountMap[like.intent_id] || 0) + 1
      })
      
      // Set user's liked intents
      if (user && userLikesResult.data) {
        const liked = new Set<string>(userLikesResult.data.map((l: { intent_id: string }) => l.intent_id))
        setLikedIntents(liked)
      }
      
      // Set intents with like counts
      const intentsWithLikes = data.map((i: Intent) => ({
        ...i,
        like_count: likeCountMap[i.id] || 0,
        comment_count: 0,
        response_count: 0
      }))
      setIntents(intentsWithLikes)
      setLoading(false)
      
      // Load comment/response counts in background (non-blocking)
      try {
        const { data: counts } = await supabase.rpc('get_intent_counts', { p_intent_ids: intentIds })
        if (counts) {
          const countMap: Record<string, { comment_count: number; response_count: number }> = {}
          counts.forEach((c: { intent_id: string; comment_count: number; response_count: number }) => {
            countMap[c.intent_id] = { comment_count: Number(c.comment_count) || 0, response_count: Number(c.response_count) || 0 }
          })
          
          setIntents(prev => prev.map(i => ({
            ...i,
            comment_count: countMap[i.id]?.comment_count ?? i.comment_count ?? 0,
            response_count: countMap[i.id]?.response_count ?? i.response_count ?? 0
          })))
        }
      } catch {
        // RPC might not exist, that's ok
      }
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [activeFilter, user])

  useEffect(() => {
    queueMicrotask(() => loadFeed())
  }, [loadFeed])
  
  useEffect(() => {
    const supabase = createClient()
    let debounceTimer: ReturnType<typeof setTimeout>
    const ch = supabase
      .channel('feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          setImageVersion(v => v + 1)
          loadFeed()
        }, 500)
      })
      .subscribe()
    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(ch)
    }
  }, [loadFeed])

  async function handleLike(intentId: string) {
    if (!user) return
    const supabase = createClient()
    const isLiked = likedIntents.has(intentId)

    // Optimistic update
    setLikedIntents(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(intentId)
      else next.add(intentId)
      return next
    })
    
    // Update like count in local state
    setIntents(prev => prev.map(i => {
      if (i.id === intentId) {
        return { ...i, like_count: (i.like_count || 0) + (isLiked ? -1 : 1) }
      }
      return i
    }))

    try {
      if (isLiked) {
        // Remove like
        await supabase
          .from('intent_likes')
          .delete()
          .eq('intent_id', intentId)
          .eq('user_id', user.id)
      } else {
        // Add like
        await supabase
          .from('intent_likes')
          .insert({ intent_id: intentId, user_id: user.id })
      }
    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to like intent:', err)
      loadFeed()
    }
  }

  function formatTimeAgo(dateStr: string): string {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    if (s < 604800) return `${Math.floor(s / 86400)}d`
    return `${Math.floor(s / 604800)}w`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-6">
          <FeedSkeleton />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            <h1 className="text-headline text-[var(--text)]">Community</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadFeed()}
                disabled={loading}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-smooth disabled:opacity-50"
                aria-label="Refresh"
              >
                <IconRefresh className={loading ? 'animate-spin' : ''} size={20} />
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--accent-purple)] text-white hover:bg-[var(--accent-purple-alt)] transition-smooth shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
                aria-label="Create intent"
              >
                <IconPlus size={20} />
              </button>
            </div>
          </div>
          
          {/* Filter chips */}
          <div className="flex gap-2 pb-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {filters.map(filter => {
              const FilterIcon = 'Icon' in filter ? filter.Icon : null
              return (
                <button
                  type="button"
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-footnote font-semibold whitespace-nowrap transition-smooth min-h-[44px] ${
                    activeFilter === filter.id
                      ? 'bg-[var(--accent-purple)] text-white shadow-[0_2px_10px_rgba(99,102,241,0.3)]'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-[var(--separator)]'
                  }`}
                >
                  {FilterIcon && <FilterIcon className={activeFilter === filter.id ? 'text-white' : 'text-[var(--text-muted)]'} />}
                  {filter.label}
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

        {intents.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-28 h-28 mx-auto mb-8 rounded-2xl bg-[var(--surface)]/80 border border-[var(--separator)] flex items-center justify-center shadow-[var(--shadow-soft)] p-4">
              <Logo size="3xl" />
            </div>
            <h2 className="text-display text-[var(--text)] mb-3">Welcome to the circle</h2>
            <p className="text-[var(--text-secondary)] mb-10 max-w-sm mx-auto text-callout leading-relaxed">
              {activeFilter !== 'all' 
                ? `No ${filters.find(f => f.id === activeFilter)?.label.toLowerCase()} intents yet. Be the first to share!`
                : 'Share what you’re looking for—meetups, collabs, or questions—and connect with creators.'
              }
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-gradient inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold min-h-[48px] shadow-[0_4px_20px_rgba(99,102,241,0.35)]"
            >
              <IconPlus size={20} />
              Share Your Intent
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            {intents.map((intent, index) => (
              <IntentCard 
                key={intent.id} 
                intent={intent} 
                staggerIndex={index}
                formatTimeAgo={formatTimeAgo} 
                imageVersion={imageVersion}
                user={user}
                profile={profile}
                likedIntents={likedIntents}
                onLike={handleLike}
                onCommentAdded={loadFeed}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Intent Modal */}
      {user && (
        <CreateIntentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadFeed}
          user={user}
          profile={profile}
        />
      )}
    </div>
  )
}

function IntentCard({ 
  intent, 
  formatTimeAgo, 
  staggerIndex = 0,
  imageVersion,
  user,
  profile,
  likedIntents,
  onLike,
  onCommentAdded
}: { 
  intent: Intent
  staggerIndex?: number
  formatTimeAgo: (d: string) => string
  imageVersion: number
  user: { id: string; email?: string } | null
  profile: { name?: string | null; username?: string | null; profile_image_url?: string | null } | null
  likedIntents: Set<string>
  onLike: (intentId: string) => void
  onCommentAdded: () => void
}) {
  const [showComments, setShowComments] = useState(false)
  const isLiked = user && likedIntents.has(intent.id)
  
  const intentTypeLabels: Record<string, { Icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
    meet: { Icon: IconMeet, label: 'Meet', color: 'bg-blue-500/20 text-blue-400' },
    collaborate: { Icon: IconCollab, label: 'Collab', color: 'bg-purple-500/20 text-purple-400' },
    ask: { Icon: IconAsk, label: 'Ask', color: 'bg-amber-500/20 text-amber-400' },
    availability: { Icon: IconAvailable, label: 'Available', color: 'bg-green-500/20 text-green-400' },
  }
  
  const intentInfo = intent.intent_type ? intentTypeLabels[intent.intent_type.toLowerCase()] : null

  return (
    <>
      <article 
        className="card-interactive p-5 rounded-2xl animate-fade-in-up" 
        style={{ animationDelay: `${Math.min(staggerIndex, 10) * 45}ms` }}
      >
        <div className="flex items-start gap-4">
          <Link href={`/user/${intent.author_username || intent.author_id}`} className="flex-shrink-0">
            {intent.author_image_url ? (
              <OptimizedAvatar
                src={`${intent.author_image_url}${intent.author_image_url.includes('?') ? '&' : '?'}t=${imageVersion}`}
                alt={intent.author_name || intent.author_username || 'Creator'}
                size={48}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold text-lg">
                {(intent.author_name || intent.author_username || '?')[0]?.toUpperCase()}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/user/${intent.author_username || intent.author_id}`}
                className="text-body font-semibold hover:text-[var(--accent-purple)] transition-colors"
              >
                {intent.author_name || intent.author_username || 'Unknown'}
              </Link>
              {intent.author_username && (
                <span className="text-[var(--text-muted)] text-footnote">@{intent.author_username}</span>
              )}
              <span className="text-[var(--text-muted)] text-footnote">· {formatTimeAgo(intent.created_at)}</span>
            </div>
            
            {intentInfo && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium mt-2 ${intentInfo.color}`}>
                <intentInfo.Icon className="shrink-0" />
                {intentInfo.label}
              </span>
            )}
            
            <p className="mt-3 text-[var(--text)] text-body leading-relaxed whitespace-pre-wrap break-words">
              {intent.content}
            </p>
            
            <div className="flex items-center gap-5 mt-4">
              <button 
                onClick={() => user && onLike(intent.id)}
                className={`flex items-center gap-1.5 text-footnote min-h-[44px] min-w-[44px] -ml-2 pl-2 rounded-lg justify-center transition-colors ${isLiked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-red-500'}`}
              >
                <IconHeart size={18} filled={!!isLiked} />
                <span>{intent.like_count ?? 0}</span>
              </button>
              <button 
                onClick={() => setShowComments(true)}
                className="flex items-center gap-1.5 text-[var(--text-muted)] text-footnote min-h-[44px] min-w-[44px] -ml-2 pl-2 rounded-lg justify-center hover:text-[var(--accent-purple)] transition-colors"
              >
                <IconComment size={18} />
                <span>{intent.comment_count ?? 0}</span>
              </button>
              <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-footnote min-h-[44px] items-center">
                <IconShare size={18} />
                <span>{intent.response_count ?? 0}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-footnote">
                <IconEye size={18} />
                <span>{intent.view_count || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* Comments Modal */}
      {user && (
        <CommentsModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          intentId={intent.id}
          intentContent={intent.content}
          authorName={intent.author_name}
          user={user}
          profile={profile}
          onCommentAdded={onCommentAdded}
        />
      )}
    </>
  )
}
