'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

const ChallengesHub = dynamic(() => import('@/components/ChallengesHub'), { ssr: false })

// SF Symbol to web icon mapping
const SF_SYMBOL_MAP: Record<string, string> = {
  // Product
  'eye.slash.fill': '👁️',
  'gift.fill': '🎁',
  'creditcard.fill': '💳',
  'square.stack.3d.up.fill': '📚',
  'dollarsign.circle.fill': '💵',
  'hands.sparkles.fill': '✨',
  'bag.fill': '🛍️',
  'questionmark.circle.fill': '❓',
  'heart.fill': '❤️',
  'wrench.and.screwdriver.fill': '🔧',
  'arrow.left.arrow.right': '↔️',
  'gift.circle.fill': '🎁',
  'desktopcomputer': '🖥️',
  'face.smiling.inverse': '😊',
  'arrow.up.arrow.down': '↕️',
  // Location
  'eye.trianglebadge.exclamationmark': '👁️',
  'brain.head.profile': '🧠',
  'moon.fill': '🌙',
  'car.fill': '🚗',
  'arrow.up.circle.fill': '⬆️',
  'mappin.and.ellipse': '📍',
  'building.2.fill': '🏙️',
  'rectangle.on.rectangle.angled': '🪞',
  'window.vertical.closed': '🪟',
  'square.stack.3d.down.right': '📦',
  'lightbulb.fill': '💡',
  'rectangle.compress.vertical': '📐',
  'figure.walk.motion': '🚶',
  'map.fill': '🗺️',
  'heart.circle.fill': '💖',
  // Style
  'play.fill': '▶️',
  'exclamationmark.bubble.fill': '💬',
  'arrow.uturn.backward': '↩️',
  'sparkles': '✨',
  'questionmark.diamond.fill': '💎',
  'lock.fill': '🔒',
  'eye.fill': '👁️',
  'timer': '⏱️',
  'sun.and.horizon.fill': '🌅',
  'camera.aperture': '📸',
  'plus.magnifyingglass': '🔍',
  'xmark.circle.fill': '❌',
  'ear.fill': '👂',
  'circle.grid.3x3.fill': '⚏',
  'sun.max.trianglebadge.exclamationmark': '☀️',
  'book.fill': '📖',
  'lightbulb.max.fill': '💡',
  'face.smiling.fill': '😊',
  'hare.fill': '🐰',
  'person.2.wave.2.fill': '👥',
  'music.note.list': '🎵',
  'arrow.triangle.branch': '🔀',
  'person.fill.checkmark': '✅',
  'hand.thumbsup.fill': '👍',
  'square.grid.3x3.topleft.filled': '📊',
  // Technical
  'hand.raised.fill': '✋',
  'sun.max.fill': '☀️',
  'record.circle': '🔴',
  'square.dashed': '⬜',
  'rotate.3d': '🔄',
  'square.3.layers.3d': '📚',
  'rectangle.portrait.on.rectangle.portrait': '🖼️',
  'shadow': '🌑',
  'magnifyingglass': '🔍',
  'arrow.left.and.right': '↔️',
  'rectangle.split.2x1': '⬛',
  'clock.fill': '🕐',
  // Emotion
  'heart.slash.fill': '💔',
  'face.dashed.fill': '😐',
  'exclamationmark.triangle.fill': '⚠️',
  'hand.thumbsdown.fill': '👎',
  'person.crop.circle.badge.questionmark': '❓',
  'bubble.left.and.bubble.right.fill': '💬',
  'flame.fill': '🔥',
  'arrow.triangle.2.circlepath': '🔄',
  'exclamationmark.2': '‼️',
  'arrow.right.circle.fill': '➡️',
  'star.fill': '⭐',
  'clock.arrow.circlepath': '🕐',
  'battery.100.bolt': '🔋',
  'paintbrush.fill': '🖌️',
  'theatermasks.fill': '🎭',
  'bolt.fill': '⚡',
  'checkmark.seal.fill': '✅',
  'memories': '📷',
  'eyes': '👀',
  // Time
  'sunrise.fill': '🌅',
  'moon.stars.fill': '🌙',
  'clock.badge.checkmark.fill': '🕐',
  'clock.arrow.2.circlepath': '🔄',
  'bolt.circle.fill': '⚡',
  'pause.fill': '⏸️',
  'arrow.clockwise': '🔄',
  'bed.double.fill': '🛏️',
  // Generic
  'wand.and.stars': '✨',
  'person.3.fill': '👥',
  'tray.full.fill': '📥',
  'link': '🔗',
  'mic.fill': '🎤',
  'checkmark.circle.fill': '✅',
  'xmark': '✕',
}

function getIconForConstraint(sfSymbol: string | null): string {
  if (!sfSymbol) return '⚡'
  return SF_SYMBOL_MAP[sfSymbol] || '⚡'
}

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  emotion: '#EF4444',
  location: '#22C55E',
  style: '#F59E0B',
  product: '#8B5CF6',
  time: '#3B82F6',
  technical: '#14B8A6',
}

interface Constraint {
  id: string
  constraint_text: string
  category: string
  icon: string | null
}

interface Streak {
  current_streak: number
  longest_streak: number
  total_ideas_generated: number
  last_completed_date: string | null
}

interface SavedIdea {
  id: string
  idea_text: string
  constraint_1: string
  constraint_2: string
  constraint_3: string
  completed_in_seconds: number | null
  created_at: string
  shared_to_board: boolean
  ai_overall_score: number | null
}

type SprintState = 'start' | 'game' | 'timeUp' | 'success'

export default function SprintPage() {
  const { user } = useApp()
  const router = useRouter()
  const [state, setState] = useState<SprintState>('start')
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [currentConstraints, setCurrentConstraints] = useState<Constraint[]>([])
  const [secondsRemaining, setSecondsRemaining] = useState(60)
  const [ideaText, setIdeaText] = useState('')
  const [streak, setStreak] = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedIdea, setSavedIdea] = useState('')
  const [completedInSeconds, setCompletedInSeconds] = useState<number | null>(null)
  const [useAIConstraints, setUseAIConstraints] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Modal states
  const [showIdeasBank, setShowIdeasBank] = useState(false)
  const [showChallenges, setShowChallenges] = useState(false)
  const [userIdeas, setUserIdeas] = useState<SavedIdea[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiEvaluation, setAiEvaluation] = useState<{
    virality: { score: number; reason: string }
    brandAppeal: { score: number; reason: string }
    originality: { score: number; reason: string }
    overallScore: number
    suggestion: string
  } | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  
  
  // Delete/share states
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null)
  const [sharingIdeaId, setSharingIdeaId] = useState<string | null>(null)
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const totalSeconds = 60

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load constraints and streak
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErrorMessage(null)
    const supabase = createClient()

    try {
      // Load constraints
      const { data: constraintsData, error: constraintsError } = await supabase
        .from('creativity_constraints')
        .select('*')
        .eq('is_active', true)

      if (constraintsError) {
        console.error('Failed to load constraints:', constraintsError)
        setErrorMessage('Failed to load constraints. Please refresh.')
      } else {
        setConstraints(constraintsData || [])
        if (!constraintsData || constraintsData.length === 0) {
          setErrorMessage('No constraints available. Please try again later.')
        }
      }

      // Load streak
      const { data: streakData } = await supabase
        .from('creativity_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setStreak(streakData || null)
    } catch (err) {
      console.error('Failed to load data:', err)
      setErrorMessage('Something went wrong. Please refresh.')
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  // Evaluate idea with AI
  const evaluateIdea = useCallback(async (ideaTextToEval: string, constraintTexts: string[]) => {
    if (!user) return null
    setIsEvaluating(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.functions.invoke('evaluate-idea', {
        body: {
          idea_text: ideaTextToEval,
          constraints: constraintTexts,
          creator_niche: 'Content creator',
          user_id: user.id
        }
      })

      if (error) {
        console.error('AI evaluation error:', error)
        return null
      }

      if (data?.ok && data?.evaluation) {
        setAiEvaluation(data.evaluation)
        return data.evaluation
      }
      return null
    } catch (err) {
      console.error('Failed to evaluate idea:', err)
      return null
    } finally {
      setIsEvaluating(false)
    }
  }, [user])

  // Generate random constraints from different categories
  const generateRandomConstraints = useCallback((): Constraint[] => {
    if (constraints.length < 3) return []
    
    const categories = ['emotion', 'location', 'style', 'product', 'time', 'technical']
    const shuffledCategories = [...categories].sort(() => Math.random() - 0.5)
    const result: Constraint[] = []
    const usedCategories: Set<string> = new Set()

    for (const cat of shuffledCategories) {
      if (result.length >= 3) break
      const inCategory = constraints.filter(c => c.category === cat)
      if (inCategory.length > 0 && !usedCategories.has(cat)) {
        const pick = inCategory[Math.floor(Math.random() * inCategory.length)]
        result.push(pick)
        usedCategories.add(cat)
      }
    }

    // Fallback if we couldn't get 3 from different categories
    while (result.length < 3) {
      const pick = constraints[Math.floor(Math.random() * constraints.length)]
      if (!result.find(r => r.id === pick.id)) {
        result.push(pick)
      }
    }

    return result.slice(0, 3)
  }, [constraints])

  // Generate AI constraints
  const generateAIConstraintsFromAPI = useCallback(async (): Promise<Constraint[]> => {
    if (!user) return []
    setGeneratingAI(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.functions.invoke('generate-constraints', {
        body: {
          creator_niche: 'Content creator',
          content_type: 'short-form video',
          past_constraints: [],
          difficulty: 'medium',
          user_id: user.id
        }
      })

      if (error) {
        console.error('AI constraints error:', error)
        return generateRandomConstraints()
      }

      if (data?.ok && data?.constraints) {
        // Convert AI constraints to our format
        const aiConstraints: Constraint[] = data.constraints.map((c: { constraint_text: string; category: string; icon: string }, i: number) => ({
          id: `ai-${i}`,
          constraint_text: c.constraint_text,
          category: c.category,
          icon: c.icon
        }))
        return aiConstraints.slice(0, 3)
      }
      return generateRandomConstraints()
    } catch (err) {
      console.error('Failed to generate AI constraints:', err)
      return generateRandomConstraints()
    } finally {
      setGeneratingAI(false)
    }
  }, [user, generateRandomConstraints])

  // Load user's saved ideas
  const loadUserIdeas = useCallback(async () => {
    if (!user) return
    setLoadingIdeas(true)
    const supabase = createClient()

    try {
      const { data } = await supabase
        .from('creator_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setUserIdeas(data || [])
    } catch (err) {
      console.error('Failed to load ideas:', err)
    }
    setLoadingIdeas(false)
  }, [user])

  // Delete an idea
  const deleteIdea = async (ideaId: string) => {
    if (!user) return
    setDeletingIdeaId(ideaId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('creator_ideas')
        .delete()
        .eq('id', ideaId)
        .eq('user_id', user.id)

      if (error) throw error

      setUserIdeas(prev => prev.filter(i => i.id !== ideaId))
      showToast('Idea deleted', 'success')
    } catch (err) {
      console.error('Failed to delete idea:', err)
      showToast('Failed to delete idea', 'error')
    }
    setDeletingIdeaId(null)
  }

  // Share idea to community
  const shareIdea = async (ideaId: string) => {
    if (!user) return
    setSharingIdeaId(ideaId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('creator_ideas')
        .update({ shared_to_board: true })
        .eq('id', ideaId)
        .eq('user_id', user.id)

      if (error) throw error

      setUserIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, shared_to_board: true } : i))
      showToast('Idea shared to community!', 'success')
    } catch (err) {
      console.error('Failed to share idea:', err)
      showToast('Failed to share idea', 'error')
    }
    setSharingIdeaId(null)
  }

  // Start sprint
  async function startSprint() {
    if (constraints.length < 3) {
      showToast('Not enough constraints loaded', 'error')
      return
    }
    
    setIdeaText('')
    setSecondsRemaining(totalSeconds)
    setCompletedInSeconds(null)
    setSavedIdea('')
    setAiEvaluation(null)
    setErrorMessage(null)
    
    // Generate constraints (AI or random)
    let selected: Constraint[]
    if (useAIConstraints) {
      selected = await generateAIConstraintsFromAPI()
    } else {
      selected = generateRandomConstraints()
    }
    
    if (selected.length < 3) {
      showToast('Failed to generate constraints', 'error')
      return
    }
    
    setCurrentConstraints(selected)
    startTimeRef.current = Date.now()
    setState('game')

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          // Go to timeUp state
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          setCompletedInSeconds(elapsed)
          setState('timeUp')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Save idea
  async function saveIdea() {
    if (!user || !ideaText.trim() || saving) return
    if (timerRef.current) clearInterval(timerRef.current)
    
    setSaving(true)
    const supabase = createClient()
    const elapsed = completedInSeconds || Math.floor((Date.now() - startTimeRef.current) / 1000)

    try {
      // Save the idea
      const { error: insertError } = await supabase.from('creator_ideas').insert({
        user_id: user.id,
        idea_text: ideaText.trim(),
        constraint_1: currentConstraints[0]?.constraint_text || '',
        constraint_2: currentConstraints[1]?.constraint_text || '',
        constraint_3: currentConstraints[2]?.constraint_text || '',
        completed_in_seconds: elapsed,
        is_saved: true,
        shared_to_board: false,
      })

      if (insertError) {
        throw insertError
      }

      // Update or create streak
      const today = new Date().toISOString().split('T')[0]
      const { data: existingStreak } = await supabase
        .from('creativity_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (existingStreak) {
        const lastDate = existingStreak.last_completed_date?.split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        
        let newStreak = existingStreak.current_streak
        if (lastDate === yesterday) {
          newStreak += 1
        } else if (lastDate !== today) {
          newStreak = 1
        }

        await supabase
          .from('creativity_streaks')
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(newStreak, existingStreak.longest_streak),
            total_ideas_generated: existingStreak.total_ideas_generated + 1,
            last_completed_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        setStreak({
          ...existingStreak,
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, existingStreak.longest_streak),
          total_ideas_generated: existingStreak.total_ideas_generated + 1,
        })
      } else {
        await supabase.from('creativity_streaks').insert({
          user_id: user.id,
          current_streak: 1,
          longest_streak: 1,
          total_ideas_generated: 1,
          last_completed_date: today,
        })

        setStreak({
          current_streak: 1,
          longest_streak: 1,
          total_ideas_generated: 1,
          last_completed_date: today,
        })
      }

      setSavedIdea(ideaText.trim())
      setState('success')
      showToast('Idea saved!', 'success')
      
      // Start AI evaluation in background
      const constraintTexts = currentConstraints.map(c => c.constraint_text)
      evaluateIdea(ideaText.trim(), constraintTexts)
    } catch (err) {
      console.error('Failed to save idea:', err)
      showToast('Failed to save idea. Please try again.', 'error')
    }
    setSaving(false)
  }

  // Reset to start
  function resetToStart() {
    if (timerRef.current) clearInterval(timerRef.current)
    setState('start')
    setIdeaText('')
    setCurrentConstraints([])
    setSecondsRemaining(totalSeconds)
    setCompletedInSeconds(null)
    setSavedIdea('')
    setAiEvaluation(null)
    setIsEvaluating(false)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Timer progress (0 to 1)
  const timerProgress = secondsRemaining / totalSeconds
  const isUrgent = secondsRemaining <= 10

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#0A0A0F] text-white">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl font-semibold text-[14px] shadow-lg transition-all ${
          toast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header - matches iOS: back (chevron) | title | Bank */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          {state === 'game' ? (
            <>
              <button
                onClick={resetToStart}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              >
                <span className="text-white text-lg">✕</span>
              </button>
              <span className="text-[17px] font-semibold">Creativity Sprint</span>
              <button
                onClick={() => { setShowIdeasBank(true); loadUserIdeas() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-500 text-[13px] font-semibold"
              >
                <span>📥</span> Bank
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[17px] font-semibold">Creativity Sprint</span>
              <button
                onClick={() => { setShowIdeasBank(true); loadUserIdeas() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-500 text-[13px] font-semibold"
              >
                <span>📥</span> Bank
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Error Message */}
        {errorMessage && state === 'start' && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-[14px] text-center">
            {errorMessage}
            <button 
              onClick={loadData}
              className="block mx-auto mt-2 text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* State: Start */}
        {state === 'start' && (
          <div className="space-y-6">
            {/* Top bar: Challenges (left) + My Ideas (right) - matches iOS */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowChallenges(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-400 text-[13px] font-semibold"
              >
                <span>👥</span> Challenges
              </button>
              <button
                onClick={() => { setShowIdeasBank(true); loadUserIdeas() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-500 text-[13px] font-semibold"
              >
                <span>📥</span> My Ideas
              </button>
            </div>

            {/* Streak Card */}
            {streak && streak.current_streak > 0 ? (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.08] border border-white/10">
                <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center flex-col">
                  <span className="text-xl">🔥</span>
                  <span className="text-orange-500 text-xs font-bold">{streak.current_streak}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[18px] font-bold">{streak.current_streak} Day Streak</p>
                  <p className="text-white/60 text-[14px]">{streak.total_ideas_generated} ideas generated</p>
                </div>
                {streak.longest_streak > 0 && (
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-white/40">BEST</p>
                    <p className="text-[20px] font-bold text-amber-500">{streak.longest_streak}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.08] border border-amber-500/20">
                <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <span className="text-2xl opacity-60">🔥</span>
                </div>
                <div className="flex-1">
                  <p className="text-[18px] font-bold">Start Your Streak!</p>
                  <p className="text-white/60 text-[14px]">Complete your first sprint</p>
                </div>
              </div>
            )}

            {/* Hero Section */}
            <div className="text-center py-6">
              <div className="relative w-[120px] h-[120px] mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-amber-500/15" />
                <div className="absolute inset-[-15px] rounded-full bg-amber-500/8" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[50px]">💡</span>
                </div>
              </div>

              <h1 className="text-[28px] font-bold mb-1">60-Second</h1>
              <h2 className="text-[28px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent mb-4">
                Creativity Sprint
              </h2>
              <p className="text-white/70 text-[15px] leading-relaxed">
                3 random constraints. 60 seconds.<br />
                One brilliant video idea.
              </p>
            </div>

            {/* AI Constraints Toggle */}
            <button
              onClick={() => setUseAIConstraints(!useAIConstraints)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                useAIConstraints 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-white/[0.08] border-white/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                useAIConstraints ? 'bg-amber-500/20' : 'bg-white/10'
              }`}>
                <span className={useAIConstraints ? 'text-amber-500' : 'text-white/60'}>🧠</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold">AI Constraints</p>
                <p className={`text-[12px] ${useAIConstraints ? 'text-amber-500' : 'text-white/40'}`}>
                  {useAIConstraints ? 'Personalized to your niche' : 'Turn on for smart constraints'}
                </p>
              </div>
              <div className={`w-11 h-[26px] rounded-full relative transition-colors ${
                useAIConstraints ? 'bg-amber-500' : 'bg-white/20'
              }`}>
                <div className={`absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all ${
                  useAIConstraints ? 'left-[23px]' : 'left-[3px]'
                }`} />
              </div>
            </button>

            {/* Info text */}
            <div className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full mx-auto w-fit ${
              useAIConstraints ? 'bg-amber-500/10' : 'bg-white/5'
            }`}>
              <span className={useAIConstraints ? 'text-amber-500' : 'text-white/40'}>
                {useAIConstraints ? '✨' : 'ℹ️'}
              </span>
              <span className="text-white/40 text-[12px]">
                {useAIConstraints 
                  ? 'AI generates constraints + scores your ideas' 
                  : 'Random constraints from our curated library'
                }
              </span>
            </div>

            {/* Start Button */}
            <button
              onClick={startSprint}
              disabled={constraints.length < 3 || generatingAI}
              className="w-full py-[18px] rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-[18px] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:shadow-none"
            >
              {generatingAI ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <span>{useAIConstraints ? '🧠' : '▶️'}</span>
                  {useAIConstraints ? 'Start AI Sprint' : 'Start Sprint'}
                </>
              )}
            </button>
          </div>
        )}

        {/* State: Game */}
        {state === 'game' && (
          <div className="space-y-6">
            {/* Timer */}
            <div className="flex justify-center">
              <div className="relative w-[150px] h-[150px]">
                {/* Outer glow */}
                <div className={`absolute inset-[-10px] rounded-full transition-transform ${
                  isUrgent ? 'bg-red-500/10 scale-110' : 'bg-green-500/10'
                }`} />
                
                {/* Background track */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="75"
                    cy="75"
                    r="54"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="75"
                    cy="75"
                    r="54"
                    fill="none"
                    stroke={isUrgent ? '#EF4444' : '#22C55E'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - timerProgress)}`}
                    className="transition-all duration-1000 linear"
                  />
                </svg>
                
                {/* Timer text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-[38px] font-bold ${isUrgent ? 'text-red-500' : 'text-green-500'}`}>
                    {secondsRemaining}
                  </span>
                  <span className="text-white/40 text-[12px]">seconds</span>
                </div>
              </div>
            </div>

            {/* Constraints */}
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-white/40 tracking-[1.2px]">YOUR CONSTRAINTS</p>
              
              {currentConstraints.map((constraint, index) => (
                <div
                  key={constraint.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.08] border border-amber-500/20"
                >
                  {/* Number badge */}
                  <span className="w-[26px] h-[26px] rounded-full bg-amber-500 text-black text-[13px] font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  
                  {/* Icon */}
                  <span className="text-amber-500 text-lg w-5 flex justify-center flex-shrink-0">
                    {getIconForConstraint(constraint.icon)}
                  </span>
                  
                  {/* Text */}
                  <span className="flex-1 text-[14px] font-medium line-clamp-2">
                    {constraint.constraint_text}
                  </span>
                  
                  {/* Category badge */}
                  <span 
                    className="px-2 py-1 rounded-full text-[9px] font-bold uppercase flex-shrink-0"
                    style={{ 
                      backgroundColor: `${CATEGORY_COLORS[constraint.category] || '#F59E0B'}20`,
                      color: CATEGORY_COLORS[constraint.category] || '#F59E0B'
                    }}
                  >
                    {constraint.category}
                  </span>
                </div>
              ))}
            </div>

            {/* Idea Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-white/40 tracking-[1.2px]">YOUR VIDEO IDEA</p>
                <p className="text-[11px] text-white/30">Type your idea below</p>
              </div>
              
              <div className="relative">
                <textarea
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder="Your brilliant idea goes here..."
                  autoFocus
                  className="w-full h-[120px] p-4 pr-16 rounded-2xl bg-white/[0.05] border border-white/10 text-[16px] placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
                />
                
                {/* Mic button (disabled with tooltip) */}
                <button 
                  className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-white/20 flex items-center justify-center cursor-not-allowed group"
                  onClick={() => showToast('Voice input not available on web', 'error')}
                >
                  <span className="text-white/50 text-lg">🎤</span>
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveIdea}
              disabled={!ideaText.trim() || saving}
              className={`w-full py-[18px] rounded-2xl font-bold text-[18px] flex items-center justify-center gap-2 transition-all ${
                ideaText.trim()
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_8px_16px_rgba(245,158,11,0.4)]'
                  : 'bg-white/10 text-white/30'
              }`}
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>✅</span>
                  Save Idea
                </>
              )}
            </button>
          </div>
        )}

        {/* State: Time's Up */}
        {state === 'timeUp' && (
          <div className="text-center py-8 space-y-6">
            {/* Animated clock icon */}
            <div className="relative w-[160px] h-[160px] mx-auto">
              <div className="absolute inset-0 rounded-full bg-red-500/15 animate-pulse" />
              <div className="absolute inset-[-20px] rounded-full bg-red-500/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[70px]">⏰</span>
              </div>
            </div>

            <div>
              <h2 className="text-[32px] font-bold mb-2">Time&apos;s Up!</h2>
              <p className="text-white/60 text-[16px]">Don&apos;t worry - creativity takes practice!</p>
            </div>

            {/* Show what they wrote */}
            {ideaText.trim() && (
              <div className="space-y-4">
                <p className="text-white/50 text-[14px] font-semibold">You wrote:</p>
                <p className="text-white/70 text-[15px] italic px-8 line-clamp-3">
                  &ldquo;{ideaText.trim()}&rdquo;
                </p>
                
                <button
                  onClick={saveIdea}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-green-500/15 text-green-500 font-semibold disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>✅</span>
                  )}
                  Save This Idea Anyway
                </button>
              </div>
            )}

            {/* Try Again Button */}
            <button
              onClick={resetToStart}
              className="w-full py-[18px] rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-[17px] flex items-center justify-center gap-2 shadow-[0_8px_16px_rgba(245,158,11,0.4)]"
            >
              <span>🔄</span>
              Try Again
            </button>
          </div>
        )}

        {/* State: Success */}
        {state === 'success' && (
          <div className="text-center py-8 space-y-6">
            {/* Success animation */}
            <div className="relative w-[120px] h-[120px] mx-auto">
              <div className="absolute inset-0 rounded-full bg-green-500/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[64px]">✅</span>
              </div>
            </div>

            <div>
              <h2 className="text-[34px] font-bold mb-2">Idea Saved!</h2>
              {streak && (
                <div className="flex items-center justify-center gap-1.5 text-orange-500 font-semibold text-[18px]">
                  <span>🔥</span>
                  <span>{streak.current_streak} day streak</span>
                </div>
              )}
            </div>

            {/* Idea preview */}
            <p className="text-white/60 text-[17px] italic px-8 line-clamp-3">
              &ldquo;{savedIdea}&rdquo;
            </p>

            {/* AI Analysis */}
            <div className="p-5 rounded-2xl bg-white/[0.08]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">✨</span>
                  <span className="text-[20px] font-bold">AI Analysis</span>
                </div>
                {aiEvaluation && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-bold text-amber-500">{aiEvaluation.overallScore.toFixed(1)}</span>
                    <span className="text-white/40">/10</span>
                  </div>
                )}
              </div>
              
              {isEvaluating ? (
                <div className="flex items-center gap-3 justify-center py-5">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white/50 text-[16px]">Analyzing your idea...</span>
                </div>
              ) : aiEvaluation ? (
                <div className="space-y-4">
                  {/* Score cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 text-center p-4 rounded-xl bg-red-500/10">
                      <div className="relative w-[70px] h-[70px] mx-auto mb-2">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="5" />
                          <circle cx="35" cy="35" r="30" fill="none" stroke="#EF4444" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            strokeDashoffset={`${2 * Math.PI * 30 * (1 - aiEvaluation.virality.score / 10)}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[24px] font-bold text-red-500">
                          {aiEvaluation.virality.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-white/50 text-[14px]">
                        <span>🔥</span> Viral
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center p-4 rounded-xl bg-green-500/10">
                      <div className="relative w-[70px] h-[70px] mx-auto mb-2">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="5" />
                          <circle cx="35" cy="35" r="30" fill="none" stroke="#22C55E" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            strokeDashoffset={`${2 * Math.PI * 30 * (1 - aiEvaluation.brandAppeal.score / 10)}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[24px] font-bold text-green-500">
                          {aiEvaluation.brandAppeal.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-white/50 text-[14px]">
                        <span>💵</span> Brand
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center p-4 rounded-xl bg-purple-500/10">
                      <div className="relative w-[70px] h-[70px] mx-auto mb-2">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="5" />
                          <circle cx="35" cy="35" r="30" fill="none" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            strokeDashoffset={`${2 * Math.PI * 30 * (1 - aiEvaluation.originality.score / 10)}`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[24px] font-bold text-purple-500">
                          {aiEvaluation.originality.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-white/50 text-[14px]">
                        <span>✨</span> Original
                      </div>
                    </div>
                  </div>
                  
                  {/* AI Suggestion */}
                  {aiEvaluation.suggestion && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10">
                      <span className="text-amber-500 mt-0.5">💡</span>
                      <p className="text-white/70 text-[15px] text-left">{aiEvaluation.suggestion}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 justify-center py-5">
                  <span className="text-white/30">✨</span>
                  <span className="text-white/30 text-[16px]">AI analysis unavailable</span>
                </div>
              )}
            </div>

            {/* Do Another Sprint Button */}
            <button
              onClick={resetToStart}
              className="w-full py-[18px] rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-[18px] flex items-center justify-center gap-2 shadow-[0_8px_16px_rgba(245,158,11,0.4)]"
            >
              <span>🔄</span>
              Do Another Sprint
            </button>
          </div>
        )}
      </main>

      {/* Ideas Bank Modal */}
      {showIdeasBank && (
        <div className="fixed inset-0 z-50 bg-black/95 overflow-auto">
          <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-black/95 backdrop-blur-xl border-b border-white/10">
              <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
                <button
                  onClick={() => setShowIdeasBank(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <span className="text-white text-sm">✕</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">📥</span>
                  <span className="text-[17px] font-semibold">Ideas Bank</span>
                </div>
                <div className="w-8" />
              </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 pb-24">
              {loadingIdeas ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userIdeas.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-[100px] h-[100px] mx-auto mb-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="text-[44px] opacity-50">📥</span>
                  </div>
                  <h3 className="text-[22px] font-bold mb-2">No Ideas Yet</h3>
                  <p className="text-white/40 text-[15px]">
                    Complete a Creativity Sprint<br />to save your first idea!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stats header */}
                  {streak && streak.total_ideas_generated > 0 && (
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 text-center p-4 rounded-xl bg-white/[0.08]">
                        <div className="flex items-center justify-center gap-1.5 text-amber-500">
                          <span>💡</span>
                          <span className="text-[24px] font-bold">{streak.total_ideas_generated}</span>
                        </div>
                        <p className="text-white/40 text-[12px]">Total Ideas</p>
                      </div>
                      <div className="flex-1 text-center p-4 rounded-xl bg-white/[0.08]">
                        <div className="flex items-center justify-center gap-1.5 text-orange-500">
                          <span>🔥</span>
                          <span className="text-[24px] font-bold">{streak.longest_streak}</span>
                        </div>
                        <p className="text-white/40 text-[12px]">Best Streak</p>
                      </div>
                    </div>
                  )}

                  {/* Ideas list */}
                  {userIdeas.map((idea) => (
                    <div key={idea.id} className="p-4 rounded-2xl bg-white/[0.05] border border-white/8">
                      {/* Constraints */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[idea.constraint_1, idea.constraint_2, idea.constraint_3].filter(Boolean).map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15">
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-white text-[12px] font-semibold line-clamp-1 max-w-[100px]">{c}</span>
                          </div>
                        ))}
                        
                        {idea.shared_to_board && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 text-green-500 text-[10px] font-semibold">
                            <span>🌐</span> Shared
                          </div>
                        )}
                      </div>
                      
                      {/* Idea text */}
                      <p className="text-[15px] text-white leading-relaxed mb-3 line-clamp-3">
                        {idea.idea_text}
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center gap-3 text-white/40 text-[12px]">
                        {idea.completed_in_seconds && (
                          <span className={`px-2 py-1 rounded-full ${
                            idea.completed_in_seconds <= 30 
                              ? 'bg-green-500/15 text-green-500' 
                              : 'bg-amber-500/15 text-amber-500'
                          }`}>
                            ⏱️ {idea.completed_in_seconds}s
                          </span>
                        )}
                        
                        {idea.ai_overall_score && (
                          <span className="px-2 py-1 rounded-full bg-purple-500/15 text-purple-400">
                            ✨ {idea.ai_overall_score.toFixed(1)}
                          </span>
                        )}
                        
                        <span>{new Date(idea.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                        {!idea.shared_to_board && (
                          <button
                            onClick={() => shareIdea(idea.id)}
                            disabled={sharingIdeaId === idea.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/15 text-green-500 text-[13px] font-semibold disabled:opacity-50"
                          >
                            {sharingIdeaId === idea.id ? (
                              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>🌐</span> Share
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => deleteIdea(idea.id)}
                          disabled={deletingIdeaId === idea.id}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-[13px] font-semibold disabled:opacity-50"
                        >
                          {deletingIdeaId === idea.id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>🗑️</span> Delete
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* Challenges Sheet - matches iOS ChallengeHubView */}
      {showChallenges && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-auto animate-slide-up">
          <ChallengesHub
            embedded
            onClose={() => setShowChallenges(false)}
          />
        </div>
      )}
    </div>
  )
}
