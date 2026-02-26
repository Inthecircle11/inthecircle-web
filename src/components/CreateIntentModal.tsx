'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface CreateIntentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  user: {
    id: string
    email?: string
  }
  profile: {
    name?: string | null
    username?: string | null
    profile_image_url?: string | null
  } | null
}

// Match iOS IntentType raw values exactly (Meet, Collaborate, Ask, Availability)
const INTENT_TYPES = [
  { id: 'Meet', label: 'Meet', icon: '🤝', description: 'Looking to meet other creators' },
  { id: 'Collaborate', label: 'Collaborate', icon: '🎬', description: 'Open for collaborations' },
  { id: 'Ask', label: 'Ask', icon: '❓', description: 'Ask the community a question' },
  { id: 'Availability', label: 'Available', icon: '📅', description: 'Share your availability' },
]

const RATE_LIMIT_MINUTES = 30

export default function CreateIntentModal({ isOpen, onClose, onCreated, user, profile }: CreateIntentModalProps) {
  const [intentType, setIntentType] = useState<string>('Meet')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null)

  const maxLength = 500

  // Check rate limit on open (match iOS: 1 post per 30 min)
  async function checkRateLimit() {
    const supabase = createClient()
    const { data } = await supabase
      .from('intents')
      .select('created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data?.created_at) {
      const lastPost = new Date(data.created_at)
      const elapsed = (Date.now() - lastPost.getTime()) / 60000
      if (elapsed < RATE_LIMIT_MINUTES) {
        const until = new Date(lastPost.getTime() + RATE_LIMIT_MINUTES * 60000)
        setRateLimitedUntil(until)
        return false
      }
    }
    setRateLimitedUntil(null)
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || loading) return

    const canPost = await checkRateLimit()
    if (!canPost) return

    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { error: insertError } = await supabase
        .from('intents')
        .insert({
          author_id: user.id,
          author_name: profile?.name || profile?.username || user.email?.split('@')[0] || 'User',
          author_username: profile?.username || null,
          author_image_url: profile?.profile_image_url || null,
          intent_type: intentType,
          content: content.trim(),
          view_count: 0,
        })

      if (insertError) throw insertError

      setContent('')
      setIntentType('Meet')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create intent')
    }

    setLoading(false)
  }

  // Check rate limit when modal opens
  useEffect(() => {
    if (isOpen && user) checkRateLimit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] text-[15px] font-medium transition-colors"
          >
            Cancel
          </button>
          <h2 className="text-[18px] font-bold tracking-tight">New Intent</h2>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || loading || !!rateLimitedUntil}
            className="text-[var(--accent-purple)] hover:text-[var(--accent-purple-alt)] text-[15px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Posting...' : rateLimitedUntil ? 'Rate limited' : 'Post'}
          </button>
        </div>

        {/* Intent Type Selector */}
        <div className="px-5 py-4 border-b border-[var(--separator)]">
          <p className="text-[12px] text-[var(--text-muted)] font-medium uppercase tracking-wider mb-3">Intent Type</p>
          <div className="grid grid-cols-4 gap-2">
            {INTENT_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setIntentType(type.id)}
                className={`flex flex-col items-center p-3 rounded-[var(--radius-sm)] transition-all ${
                  intentType === type.id
                    ? 'bg-[var(--accent-purple)]/15 border-2 border-[var(--accent-purple)]'
                    : 'bg-[var(--surface)] border-2 border-transparent hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span className="text-2xl mb-1">{type.icon}</span>
                <span className={`text-[12px] font-medium ${intentType === type.id ? 'text-[var(--accent-purple)]' : 'text-[var(--text-secondary)]'}`}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            <div className="flex items-start gap-3">
              {profile?.profile_image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.profile_image_url}
                  alt="Your avatar"
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold flex-shrink-0">
                  {(profile?.name || profile?.username || user.email || '?')[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-[14px] mb-2">
                  {profile?.name || profile?.username || user.email?.split('@')[0]}
                </p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
                  placeholder={`What's your ${INTENT_TYPES.find(t => t.id === intentType)?.label.toLowerCase()} intent?`}
                  rows={5}
                  autoFocus
                  className="w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)] text-[15px] leading-relaxed resize-none focus:outline-none"
                />
              </div>
            </div>

            {rateLimitedUntil && (
              <div className="mt-4 p-3 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[13px]">
                One post per {RATE_LIMIT_MINUTES} minutes. Try again in {Math.ceil((rateLimitedUntil.getTime() - Date.now()) / 60000)} min.
              </div>
            )}
            {error && (
              <div className="mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-[13px]">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--separator)] flex items-center justify-between">
            <p className="text-[12px] text-[var(--text-muted)]">
              {INTENT_TYPES.find(t => t.id === intentType)?.description}
            </p>
            <span className={`text-[12px] ${content.length > maxLength * 0.9 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
              {content.length}/{maxLength}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
