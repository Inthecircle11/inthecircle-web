'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Comment {
  id: string
  intent_id: string
  author_id: string
  author_name: string
  author_username: string
  author_image_url: string | null
  content: string
  likes: number
  created_at: string
}

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  intentId: string
  intentContent: string
  authorName: string
  user: {
    id: string
    email?: string
  }
  profile: {
    name?: string | null
    username?: string | null
    profile_image_url?: string | null
  } | null
  onCommentAdded?: () => void
}

export default function CommentsModal({
  isOpen,
  onClose,
  intentId,
  intentContent,
  authorName,
  user,
  profile,
  onCommentAdded
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())

  const loadComments = useCallback(async () => {
    if (!intentId) return
    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error: queryError } = await supabase
        .from('intent_comments')
        .select('*')
        .eq('intent_id', intentId)
        .order('created_at', { ascending: true })

      if (queryError) throw queryError
      setComments(data || [])

      // Check which comments user has liked
      if (user && data && data.length > 0) {
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', data.map((c: Comment) => c.id))
        
        if (likes) {
          setLikedComments(new Set(likes.map((l: { comment_id: string }) => l.comment_id)))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments')
    }
    setLoading(false)
  }, [intentId, user])

  useEffect(() => {
    if (isOpen && intentId) {
      loadComments()
    }
  }, [isOpen, intentId, loadComments])

  // Real-time subscription
  useEffect(() => {
    if (!isOpen || !intentId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`comments-${intentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intent_comments',
        filter: `intent_id=eq.${intentId}`
      }, () => loadComments())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, intentId, loadComments])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    try {
      const { error: insertError } = await supabase
        .from('intent_comments')
        .insert({
          intent_id: intentId,
          author_id: user.id,
          author_name: profile?.name || profile?.username || user.email?.split('@')[0] || 'User',
          author_username: profile?.username || '',
          author_image_url: profile?.profile_image_url || null,
          content: newComment.trim(),
          likes: 0,
        })

      if (insertError) throw insertError

      setNewComment('')
      await loadComments()
      onCommentAdded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    }
    setSubmitting(false)
  }

  async function handleLikeComment(commentId: string) {
    const supabase = createClient()
    const isLiked = likedComments.has(commentId)

    try {
      if (isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
        
        setLikedComments(prev => {
          const next = new Set(prev)
          next.delete(commentId)
          return next
        })
        
        // Decrement like count
        await supabase.rpc('decrement_comment_likes', { p_comment_id: commentId })
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id })
        
        setLikedComments(prev => new Set(prev).add(commentId))
        
        // Increment like count
        await supabase.rpc('increment_comment_likes', { p_comment_id: commentId })
      }
      
      await loadComments()
    } catch (err) {
      console.error('Failed to like comment:', err)
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl max-h-[90vh] flex flex-col animate-slide-up sm:animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold">Comments</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Original Intent Preview */}
        <div className="px-5 py-3 border-b border-[var(--separator)] bg-[var(--surface)]/50">
          <p className="text-[13px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">{authorName}</span>
            {' · '}
            {intentContent.length > 100 ? intentContent.slice(0, 100) + '...' : intentContent}
          </p>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--text-muted)] text-[15px]">No comments yet</p>
              <p className="text-[var(--text-muted)] text-[13px] mt-1">Be the first to comment!</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                {comment.author_image_url ? (
                  <img
                    src={comment.author_image_url}
                    alt={comment.author_name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold text-sm flex-shrink-0">
                    {comment.author_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px]">{comment.author_name}</span>
                    {comment.author_username && (
                      <span className="text-[var(--text-muted)] text-[12px]">@{comment.author_username}</span>
                    )}
                    <span className="text-[var(--text-muted)] text-[12px]">· {formatTimeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-[14px] text-[var(--text)] mt-1 leading-relaxed">{comment.content}</p>
                  <button
                    onClick={() => handleLikeComment(comment.id)}
                    className={`flex items-center gap-1.5 mt-2 text-[12px] transition-colors ${
                      likedComments.has(comment.id)
                        ? 'text-[var(--error)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--error)]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={likedComments.has(comment.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    <span>{comment.likes || 0}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-3 bg-[var(--error)]/10 border-t border-[var(--error)]/30 text-[var(--error)] text-[13px]">
            {error}
          </div>
        )}

        {/* Comment Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--separator)] flex items-center gap-3">
          {profile?.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt="Your avatar"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold text-sm flex-shrink-0">
              {(profile?.name || profile?.username || user.email || '?')[0]?.toUpperCase()}
            </div>
          )}
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-[var(--surface)] border border-[var(--separator)] rounded-full px-4 py-2.5 text-[14px] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)]"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="text-[var(--accent-purple)] font-semibold text-[14px] disabled:opacity-40"
          >
            {submitting ? '...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  )
}
