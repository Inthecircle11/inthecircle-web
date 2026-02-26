'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

interface Idea {
  id: string
  user_id: string
  idea_text: string
  constraint_1: string
  constraint_2: string
  constraint_3: string
  completed_in_seconds: number | null
  is_saved: boolean
  shared_to_board: boolean
  created_at: string
  ai_virality_score: number | null
  ai_brand_score: number | null
  ai_originality_score: number | null
  ai_overall_score: number | null
  ai_suggestion: string | null
}

export default function IdeasPage() {
  const { user } = useApp()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [filter, setFilter] = useState<'all' | 'saved' | 'shared'>('all')

  const loadIdeas = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      let query = supabase
        .from('creator_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (filter === 'saved') {
        query = query.eq('is_saved', true)
      } else if (filter === 'shared') {
        query = query.eq('shared_to_board', true)
      }

      const { data, error } = await query

      if (error) throw error
      setIdeas(data || [])
    } catch (err) {
      console.error('Failed to load ideas:', err)
    }
    setLoading(false)
  }, [user, filter])

  useEffect(() => {
    if (user) loadIdeas()
  }, [user, loadIdeas])

  async function deleteIdea(ideaId: string) {
    const supabase = createClient()
    await supabase.from('creator_ideas').delete().eq('id', ideaId)
    setIdeas(prev => prev.filter(i => i.id !== ideaId))
    setSelectedIdea(null)
  }

  async function shareIdea(idea: Idea) {
    if (!user) return
    const supabase = createClient()

    try {
      // Share to community board
      await supabase.from('shared_sprint_ideas').insert({
        idea_id: idea.id,
        user_id: user.id,
        idea_text: idea.idea_text,
        constraint_1: idea.constraint_1,
        constraint_2: idea.constraint_2,
        constraint_3: idea.constraint_3,
        completed_in_seconds: idea.completed_in_seconds,
        likes_count: 0,
        comments_count: 0,
        is_featured: false,
      })

      // Update the idea
      await supabase
        .from('creator_ideas')
        .update({ shared_to_board: true })
        .eq('id', idea.id)

      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, shared_to_board: true } : i))
      setSelectedIdea(null)
    } catch (err) {
      console.error('Failed to share idea:', err)
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/sprint" className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </Link>
              <h1 className="text-[17px] font-semibold">Ideas Bank</h1>
            </div>
            <span className="text-[var(--text-muted)] text-[14px]">{ideas.length} ideas</span>
          </div>

          {/* Filter tabs */}
          <div className="segmented-control mb-3">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All
            </button>
            <button className={filter === 'saved' ? 'active' : ''} onClick={() => setFilter('saved')}>
              Saved
            </button>
            <button className={filter === 'shared' ? 'active' : ''} onClick={() => setFilter('shared')}>
              Shared
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {ideas.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <span className="text-5xl">💡</span>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No ideas yet</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xs mx-auto text-[15px]">
              Complete creativity sprints to build your ideas bank
            </p>
            <Link href="/sprint" className="btn-primary px-8 py-4">
              Start a Sprint
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map(idea => (
              <button
                key={idea.id}
                onClick={() => setSelectedIdea(idea)}
                className="w-full text-left p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] transition-all"
              >
                <p className="text-[15px] text-[var(--text)] line-clamp-2 mb-3">
                  {idea.idea_text}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {idea.constraint_1 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] text-[11px]">
                      {idea.constraint_1}
                    </span>
                  )}
                  {idea.constraint_2 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] text-[11px]">
                      {idea.constraint_2}
                    </span>
                  )}
                  {idea.constraint_3 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] text-[11px]">
                      {idea.constraint_3}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)] text-[12px]">
                    {formatDate(idea.created_at)}
                    {idea.completed_in_seconds && ` · ${idea.completed_in_seconds}s`}
                  </span>
                  <div className="flex items-center gap-2">
                    {idea.shared_to_board && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--success)]/20 text-[var(--success)] text-[11px] font-medium">
                        Shared
                      </span>
                    )}
                    {idea.ai_overall_score && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] text-[11px] font-medium">
                        Score: {idea.ai_overall_score.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Idea Detail Modal */}
      {selectedIdea && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl max-h-[90vh] flex flex-col animate-slide-up sm:animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
              <h2 className="text-[17px] font-semibold">Idea Details</h2>
              <button
                onClick={() => setSelectedIdea(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[15px] text-[var(--text)] whitespace-pre-wrap mb-4">
                {selectedIdea.idea_text}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {selectedIdea.constraint_1 && (
                  <span className="px-3 py-1 rounded-full bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-[12px]">
                    {selectedIdea.constraint_1}
                  </span>
                )}
                {selectedIdea.constraint_2 && (
                  <span className="px-3 py-1 rounded-full bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-[12px]">
                    {selectedIdea.constraint_2}
                  </span>
                )}
                {selectedIdea.constraint_3 && (
                  <span className="px-3 py-1 rounded-full bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-[12px]">
                    {selectedIdea.constraint_3}
                  </span>
                )}
              </div>

              {/* AI Scores */}
              {selectedIdea.ai_overall_score && (
                <div className="mb-6 p-4 rounded-[var(--radius-sm)] bg-[var(--surface)]">
                  <p className="text-[12px] text-[var(--text-muted)] font-medium uppercase tracking-wider mb-3">AI Analysis</p>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedIdea.ai_virality_score && (
                      <div>
                        <p className="text-[20px] font-bold text-[var(--accent-purple)]">{selectedIdea.ai_virality_score}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">Virality</p>
                      </div>
                    )}
                    {selectedIdea.ai_brand_score && (
                      <div>
                        <p className="text-[20px] font-bold text-[var(--accent-purple)]">{selectedIdea.ai_brand_score}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">Brand Fit</p>
                      </div>
                    )}
                    {selectedIdea.ai_originality_score && (
                      <div>
                        <p className="text-[20px] font-bold text-[var(--accent-purple)]">{selectedIdea.ai_originality_score}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">Originality</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[20px] font-bold text-[var(--accent-purple)]">{selectedIdea.ai_overall_score.toFixed(0)}</p>
                      <p className="text-[12px] text-[var(--text-muted)]">Overall</p>
                    </div>
                  </div>
                  {selectedIdea.ai_suggestion && (
                    <p className="mt-4 text-[13px] text-[var(--text-secondary)] italic">
                      "{selectedIdea.ai_suggestion}"
                    </p>
                  )}
                </div>
              )}

              <div className="text-[var(--text-muted)] text-[13px]">
                Created {formatDate(selectedIdea.created_at)}
                {selectedIdea.completed_in_seconds && ` · Completed in ${selectedIdea.completed_in_seconds}s`}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--separator)] flex gap-3">
              <button
                onClick={() => deleteIdea(selectedIdea.id)}
                className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[var(--error)] bg-[var(--error)]/10 hover:bg-[var(--error)]/20 transition-colors"
              >
                Delete
              </button>
              {!selectedIdea.shared_to_board && (
                <button
                  onClick={() => shareIdea(selectedIdea)}
                  className="flex-1 btn-primary py-3"
                >
                  Share to Community
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
