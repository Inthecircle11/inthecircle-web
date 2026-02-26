'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

interface Resource {
  id: string
  title: string
  description: string
  icon: string
  category: string
  content: string[]
}

const RESOURCES: Resource[] = [
  {
    id: 'brand-pitching',
    title: 'Brand Pitching Guide',
    description: 'Learn how to pitch yourself to brands effectively',
    icon: '📧',
    category: 'Outreach',
    content: [
      '1. Research the brand thoroughly before reaching out',
      '2. Personalize every pitch - mention specific campaigns you loved',
      '3. Lead with value - what can you offer them?',
      '4. Include your media kit and best work samples',
      '5. Keep it concise - max 3 paragraphs',
      '6. Follow up once after 5-7 days if no response',
      '7. Track your outreach in a spreadsheet',
      '',
      '📋 Pitch Template:',
      '',
      'Subject: [Your Name] x [Brand] Collaboration Idea',
      '',
      'Hi [Name],',
      '',
      'I\'ve been a fan of [Brand] since [specific moment/product]. Your recent [campaign/product launch] really resonated with me because [specific reason].',
      '',
      'I create [type of content] for my [X] followers who are passionate about [niche]. I\'d love to collaborate on [specific idea that benefits them].',
      '',
      'Here\'s my media kit: [link]',
      '',
      'Would you be open to a quick chat this week?',
      '',
      'Best,',
      '[Your name]',
    ]
  },
  {
    id: 'ugc-checklist',
    title: 'UGC Creator Checklist',
    description: 'Everything you need to start making UGC content',
    icon: '✅',
    category: 'Getting Started',
    content: [
      '📱 Equipment Essentials:',
      '• Smartphone with good camera (iPhone 12+ or similar)',
      '• Ring light or natural lighting setup',
      '• Tripod or phone mount',
      '• External microphone (optional but recommended)',
      '• Basic editing app (CapCut, InShot)',
      '',
      '📋 Before Every Shoot:',
      '• Read the brief 3x minimum',
      '• Research the brand\'s existing content style',
      '• Plan your shots and transitions',
      '• Prepare your backdrop/location',
      '• Test lighting and audio',
      '',
      '🎬 During Filming:',
      '• Film in 4K if possible',
      '• Record multiple takes',
      '• Get B-roll footage',
      '• Capture different angles',
      '• Check audio after each take',
      '',
      '✏️ Post-Production:',
      '• Edit to match brand guidelines',
      '• Add captions/subtitles',
      '• Color grade consistently',
      '• Export in required format',
      '• Send for review before deadline',
    ]
  },
  {
    id: 'pricing-guide',
    title: 'Pricing Your Content',
    description: 'How to price your content and negotiate rates',
    icon: '💰',
    category: 'Business',
    content: [
      '📊 Factors That Affect Pricing:',
      '• Follower count and engagement rate',
      '• Niche (some pay more than others)',
      '• Type of content (photo vs video)',
      '• Usage rights (organic vs paid ads)',
      '• Exclusivity period',
      '• Turnaround time',
      '',
      '💵 General Rate Guidelines:',
      '',
      'Nano (1K-10K followers):',
      '• Instagram Post: $50-$150',
      '• Instagram Reel: $100-$300',
      '• TikTok: $100-$250',
      '',
      'Micro (10K-50K followers):',
      '• Instagram Post: $150-$500',
      '• Instagram Reel: $300-$800',
      '• TikTok: $250-$600',
      '',
      'Mid-tier (50K-500K followers):',
      '• Instagram Post: $500-$2,000',
      '• Instagram Reel: $800-$3,000',
      '• TikTok: $600-$2,500',
      '',
      '🤝 Negotiation Tips:',
      '• Always ask for the budget first',
      '• Don\'t undersell yourself',
      '• Factor in time, not just deliverables',
      '• Add 20% for whitelisting/paid ads',
      '• Get payment terms in writing',
    ]
  },
  {
    id: 'media-kit',
    title: 'Media Kit Builder',
    description: 'Create a professional media kit that converts',
    icon: '📊',
    category: 'Tools',
    content: [
      '📄 What to Include:',
      '',
      '1. Cover Page',
      '• Professional photo',
      '• Name and handles',
      '• One-line bio/tagline',
      '',
      '2. About Section',
      '• Your story in 2-3 sentences',
      '• What makes you unique',
      '• Your content style',
      '',
      '3. Audience Demographics',
      '• Follower count per platform',
      '• Age breakdown',
      '• Gender split',
      '• Top locations',
      '• Engagement rate',
      '',
      '4. Content Examples',
      '• 3-5 best performing posts',
      '• Screenshots with metrics',
      '• Mix of content types',
      '',
      '5. Past Collaborations',
      '• Brand logos you\'ve worked with',
      '• Testimonials if available',
      '• Case study with results',
      '',
      '6. Services & Rates',
      '• What you offer',
      '• Starting rates (optional)',
      '• Package deals',
      '',
      '7. Contact Information',
      '• Email',
      '• Social handles',
      '• Website (if applicable)',
      '',
      '🎨 Design Tips:',
      '• Use Canva or Figma templates',
      '• Keep it on-brand with your aesthetic',
      '• Max 5-7 pages',
      '• Save as PDF',
      '• Update quarterly',
    ]
  },
  {
    id: 'email-templates',
    title: 'Email Templates',
    description: 'Ready-to-use templates for common scenarios',
    icon: '📝',
    category: 'Outreach',
    content: [
      '📧 FOLLOW-UP EMAIL:',
      '',
      'Subject: Following up: [Your Name] x [Brand]',
      '',
      'Hi [Name],',
      '',
      'I wanted to follow up on my previous email about a potential collaboration. I understand you\'re busy, so I\'ll keep this brief.',
      '',
      'I recently [achieved something/created content] that I think would resonate with [Brand]\'s audience. Would you have 15 minutes this week to chat?',
      '',
      'Best,',
      '[Your name]',
      '',
      '---',
      '',
      '📧 NEGOTIATION EMAIL:',
      '',
      'Subject: Re: Collaboration Details',
      '',
      'Hi [Name],',
      '',
      'Thank you for sharing the details! I\'m excited about this opportunity.',
      '',
      'Based on the scope (X deliverables, usage rights for X months, X-day turnaround), my rate would be $X.',
      '',
      'This includes:',
      '• [Deliverable 1]',
      '• [Deliverable 2]',
      '• [Revision rounds]',
      '',
      'I\'m happy to discuss if you have a different budget in mind.',
      '',
      'Best,',
      '[Your name]',
      '',
      '---',
      '',
      '📧 POST-CAMPAIGN EMAIL:',
      '',
      'Subject: [Campaign Name] Results + Thank You',
      '',
      'Hi [Name],',
      '',
      'Thank you for the opportunity to work with [Brand]! Here are the final results:',
      '',
      '• Views: X',
      '• Engagement: X%',
      '• [Other metrics]',
      '',
      'I\'d love to work together again. Let me know if you have any upcoming campaigns that might be a fit!',
      '',
      'Best,',
      '[Your name]',
    ]
  },
  {
    id: 'contract-tips',
    title: 'Contract Red Flags',
    description: 'What to look for before signing brand deals',
    icon: '⚠️',
    category: 'Legal',
    content: [
      '🚩 Red Flags to Watch For:',
      '',
      '1. Unlimited Usage Rights',
      '• Never agree to "in perpetuity"',
      '• Limit to 6-12 months max',
      '• Charge extra for paid ad usage',
      '',
      '2. Exclusivity Clauses',
      '• Avoid long exclusivity periods',
      '• If required, negotiate higher rates',
      '• Be specific about competitors',
      '',
      '3. Payment Terms',
      '• Net 30 is standard',
      '• Avoid Net 90 or longer',
      '• Request 50% upfront for new clients',
      '',
      '4. Revision Clauses',
      '• Limit revisions (2-3 rounds)',
      '• Define what counts as a revision',
      '• Charge for additional rounds',
      '',
      '5. Cancellation Terms',
      '• Kill fee if they cancel',
      '• At least 25-50% of agreed rate',
      '• Timeline for cancellation notice',
      '',
      '✅ What to Ensure:',
      '• Clear deliverables and deadlines',
      '• Specific content requirements',
      '• Approval process timeline',
      '• Payment schedule and method',
      '• Who owns the content',
      '• FTC disclosure requirements',
    ]
  },
]

const CATEGORIES = ['All', 'Getting Started', 'Outreach', 'Business', 'Tools', 'Legal']

interface Note {
  id: string
  content: string
  created_at: string
  updated_at: string
}

export default function ResourcesPage() {
  const { user } = useApp()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  
  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!user) return
    setLoadingNotes(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    setNotes(data || [])
    setLoadingNotes(false)
  }, [user])

  // Load notes from Supabase
  useEffect(() => {
    if (user) queueMicrotask(() => loadNotes())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function saveNote() {
    if (!user || !noteContent.trim()) return
    setSavingNote(true)
    const supabase = createClient()

    try {
      if (editingNote) {
        // Update existing note
        await supabase
          .from('user_notes')
          .update({ content: noteContent.trim(), updated_at: new Date().toISOString() })
          .eq('id', editingNote.id)
      } else {
        // Create new note
        await supabase
          .from('user_notes')
          .insert({ user_id: user.id, content: noteContent.trim() })
      }
      
      await loadNotes()
      setShowNoteEditor(false)
      setEditingNote(null)
      setNoteContent('')
    } catch (err) {
      console.error('Error saving note:', err)
    }
    setSavingNote(false)
  }

  async function deleteNote(noteId: string) {
    if (!user) return
    const supabase = createClient()
    
    await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId)
    
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  function openNoteEditor(note?: Note) {
    setEditingNote(note || null)
    setNoteContent(note?.content || '')
    setShowNoteEditor(true)
  }

  const filteredResources = selectedCategory === 'All'
    ? RESOURCES
    : RESOURCES.filter(r => r.category === selectedCategory)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center">
            <h1 className="text-[17px] font-semibold">Creator Resources</h1>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[var(--accent)] text-[var(--button-text-on-accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {/* Quick Links */}
        <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-purple)]/20 to-[var(--accent-purple-alt)]/20 border border-[var(--accent-purple)]/30">
          <h3 className="font-semibold text-[15px] mb-2">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/sprint" className="px-3 py-1.5 rounded-full bg-[var(--accent-purple)] text-white text-[13px] font-medium">
              Start a Sprint ⚡
            </Link>
            <Link href="/portfolio" className="px-3 py-1.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--surface-hover)]">
              Update Portfolio
            </Link>
            <Link href="/analytics" className="px-3 py-1.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--surface-hover)]">
              View Analytics
            </Link>
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map(resource => (
            <button
              key={resource.id}
              onClick={() => setSelectedResource(resource)}
              className="text-left p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] transition-all"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{resource.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[15px] mb-1">{resource.title}</h3>
                  <p className="text-[var(--text-muted)] text-[13px] line-clamp-2">
                    {resource.description}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] text-[11px]">
                    {resource.category}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Personal Notes Section */}
        {user && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold">Your Notes</h2>
              <button
                onClick={() => openNoteEditor()}
                className="flex items-center gap-2 text-[var(--accent-purple)] text-[14px] font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Note
              </button>
            </div>
            
            {loadingNotes ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] text-center">
                <span className="text-4xl mb-4 block">📓</span>
                <p className="text-[var(--text-muted)] text-[14px]">
                  No notes yet. Save personal notes and ideas here.
                </p>
                <button
                  onClick={() => openNoteEditor()}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 mt-4"
                >
                  Create Your First Note
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] transition-colors group"
                  >
                    <p className="text-[var(--text)] text-[14px] whitespace-pre-wrap line-clamp-4">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--separator)]">
                      <span className="text-[var(--text-muted)] text-[12px]">
                        {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openNoteEditor(note)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Resource Detail Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl my-8 animate-scale-in">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--separator)] bg-[var(--bg)]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedResource.icon}</span>
                <h2 className="text-[17px] font-semibold">{selectedResource.title}</h2>
              </div>
              <button
                onClick={() => setSelectedResource(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <div className="prose prose-invert max-w-none">
                {selectedResource.content.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[14px] leading-relaxed ${
                      line === '' ? 'h-4' :
                      line.startsWith('•') ? 'pl-4 text-[var(--text-secondary)]' :
                      line.match(/^\d\./) ? 'font-medium' :
                      line.includes(':') && !line.startsWith('Subject') && !line.startsWith('Hi') && !line.startsWith('Best') ? 'font-semibold text-[var(--accent-purple)] mt-4' :
                      ''
                    }`}
                  >
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--separator)]">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(selectedResource.content.join('\n'))
                  alert('Copied to clipboard!')
                }}
                className="btn-primary w-full py-3"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Editor Modal */}
      {showNoteEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
              <button
                onClick={() => {
                  setShowNoteEditor(false)
                  setEditingNote(null)
                  setNoteContent('')
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <h2 className="text-[17px] font-semibold">
                {editingNote ? 'Edit Note' : 'New Note'}
              </h2>
              <button
                onClick={saveNote}
                disabled={savingNote || !noteContent.trim()}
                className="text-[var(--accent-purple)] hover:text-[var(--accent-purple-alt)] font-semibold text-[15px] disabled:opacity-50 transition-colors"
              >
                {savingNote ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="p-5">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full h-64 p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] text-[var(--text)] text-[15px] leading-relaxed resize-none focus:outline-none focus:border-[var(--accent-purple)] transition-colors"
                placeholder="Write your note here..."
                autoFocus
              />
              <p className="text-[var(--text-muted)] text-[12px] mt-2 text-right">
                {noteContent.length} characters
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
