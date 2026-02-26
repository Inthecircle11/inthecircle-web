'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface CreateChallengeModalProps {
  onClose: () => void
  onCreated: () => void
}

const DURATION_OPTIONS = [7, 14, 30]
const MAX_PARTICIPANTS_OPTIONS = [3, 5, 10]
const DAILY_TIME_LIMIT_OPTIONS = [10, 15, 30]

interface CreatedChallenge {
  id: string
  name: string
  invite_code: string | null
}

export default function CreateChallengeModal({ onClose, onCreated }: CreateChallengeModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(7)
  const [maxParticipants, setMaxParticipants] = useState(5)
  const [dailyTimeLimit, setDailyTimeLimit] = useState(15)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdChallenge, setCreatedChallenge] = useState<CreatedChallenge | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please enter a challenge name')
      return
    }

    setIsCreating(true)
    setError(null)
    const supabase = createClient()

    try {
      const { data: challengeId, error: rpcError } = await supabase.rpc('create_challenge', {
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_duration_days: selectedDuration,
        p_max_participants: maxParticipants,
        p_daily_time_limit: dailyTimeLimit,
      })

      if (rpcError) throw rpcError

      if (challengeId) {
        // Fetch the created challenge to get invite_code
        const { data: challenge, error: fetchError } = await supabase
          .from('creator_challenges')
          .select('id, name, invite_code')
          .eq('id', challengeId)
          .single()

        if (!fetchError && challenge) {
          setCreatedChallenge({
            id: challenge.id,
            name: challenge.name,
            invite_code: challenge.invite_code,
          })
        } else {
          setCreatedChallenge({
            id: challengeId,
            name: name.trim(),
            invite_code: null,
          })
        }
      } else {
        throw new Error('No challenge ID returned')
      }
    } catch (err) {
      console.error('Failed to create challenge:', err)
      setError(err instanceof Error ? err.message : 'Failed to create challenge')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopyCode() {
    if (createdChallenge?.invite_code) {
      await navigator.clipboard.writeText(createdChallenge.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDone() {
    onCreated()
    onClose()
  }

  // Success view
  if (createdChallenge) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] p-6 animate-scale-in">
          <div className="text-center">
            {/* Success icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--success)]/20 flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>

            <h2 className="text-[22px] font-bold mb-2">Challenge Created!</h2>
            <p className="text-[var(--text-secondary)] text-[15px] mb-6">
              Invite friends to join your challenge
            </p>

            {/* Invite code card */}
            {createdChallenge.invite_code && (
              <div className="p-5 mb-6 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)]">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Invite Code
                </p>
                <p className="text-[28px] font-black tracking-widest text-[var(--premium-gold)] mb-4">
                  {createdChallenge.invite_code}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[14px] font-semibold text-[var(--premium-gold)] bg-[var(--premium-gold)]/15 hover:bg-[var(--premium-gold)]/25 transition-colors"
                >
                  {copied ? (
                    <>
                      <span className="text-[var(--success)]">✓</span>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Code
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={handleDone}
              className="btn-primary w-full py-3"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Form view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] p-6 my-8 animate-scale-in">
        <h2 className="text-[20px] font-bold mb-2">Create Challenge</h2>
        <p className="text-[var(--text-secondary)] text-[14px] mb-6">
          Start a challenge and invite friends to stay consistent together
        </p>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-secondary)] mb-2">
              Challenge Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 7-Day Content Sprint"
              className="input-field w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-secondary)] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this challenge about?"
              rows={3}
              className="input-field w-full resize-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-secondary)] mb-3">
              Duration
            </label>
            <div className="grid grid-cols-3 gap-3">
              {DURATION_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setSelectedDuration(days)}
                  className={`py-4 rounded-[var(--radius-sm)] font-bold text-center transition-colors ${
                    selectedDuration === days
                      ? 'bg-[var(--premium-gold)] text-black'
                      : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span className="block text-[22px]">{days}</span>
                  <span className="text-[12px] font-medium opacity-90">days</span>
                </button>
              ))}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[14px] font-semibold text-[var(--text-secondary)]">
                Max Friends
              </label>
              <span className="text-[14px] font-bold text-[var(--premium-gold)]">
                {maxParticipants} people
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MAX_PARTICIPANTS_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMaxParticipants(count)}
                  className={`py-3 rounded-[var(--radius-sm)] font-bold transition-colors ${
                    maxParticipants === count
                      ? 'bg-[var(--premium-gold)] text-black'
                      : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Time Limit */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[14px] font-semibold text-[var(--text-secondary)]">
                Daily Time Limit
              </label>
              <span className="text-[14px] font-bold text-[var(--premium-gold)]">
                {dailyTimeLimit} min
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DAILY_TIME_LIMIT_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDailyTimeLimit(mins)}
                  className={`py-3 rounded-[var(--radius-sm)] font-bold transition-colors ${
                    dailyTimeLimit === mins
                      ? 'bg-[var(--premium-gold)] text-black'
                      : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-2">
              Remind participants they only have {dailyTimeLimit} minutes to create content
            </p>
          </div>
        </div>

        {error && (
          <p className="text-[var(--error)] text-[13px] mt-4 text-center">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[var(--text-secondary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="flex-1 btn-primary py-3 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <span>✨</span>
                Create Challenge
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
