'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

const AddPortfolioEntryModal = dynamic(() => import('@/components/AddPortfolioEntryModal'), { ssr: false })

interface PortfolioEntry {
  id: string
  user_id: string
  entry_kind: string
  title: string
  brand_name: string | null
  brief: string
  role: string | null
  start_date: string | null
  end_date: string | null
  tags: string[] | null
  links: { url: string; label: string }[] | null
  visibility: string
  featured_rank: number | null
  sort_order: number
  cover_media_id: string | null
  created_at: string
  media?: PortfolioMedia[]
  metrics?: PortfolioMetric[]
}

interface PortfolioMedia {
  id: string
  entry_id: string
  media_type: string
  storage_path: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  sort_order: number
}

interface PortfolioMetric {
  id: string
  entry_id: string
  metric_type: string
  value_number: number | null
  value_text: string | null
  unit: string | null
  baseline_value: number | null
  delta_value: number | null
  timeframe_label: string | null
}

const ENTRY_KINDS = [
  { id: 'all', label: 'All' },
  { id: 'brand_deal', label: 'Brand Deals', icon: '💼' },
  { id: 'ugc', label: 'UGC', icon: '📱' },
  { id: 'collab', label: 'Collabs', icon: '🤝' },
  { id: 'personal', label: 'Personal', icon: '✨' },
]

export default function PortfolioPage() {
  const { user, profile: _profile } = useApp()
  const [entries, setEntries] = useState<PortfolioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKind, setSelectedKind] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState<PortfolioEntry | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadPortfolio = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      let query = supabase
        .from('portfolio_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (selectedKind !== 'all') {
        query = query.eq('entry_kind', selectedKind)
      }

      const { data: entriesData, error } = await query

      if (error) throw error

      if (entriesData && entriesData.length > 0) {
        // Get media for all entries
        const entryIds = entriesData.map((e: PortfolioEntry) => e.id)
        const { data: mediaData } = await supabase
          .from('portfolio_media')
          .select('*')
          .in('entry_id', entryIds)
          .order('sort_order', { ascending: true })

        // Get metrics for all entries
        const { data: metricsData } = await supabase
          .from('portfolio_metrics')
          .select('*')
          .in('entry_id', entryIds)

        // Enrich entries
        const enriched = entriesData.map((entry: PortfolioEntry) => ({
          ...entry,
          media: mediaData?.filter((m: PortfolioMedia) => m.entry_id === entry.id) || [],
          metrics: metricsData?.filter((m: PortfolioMetric) => m.entry_id === entry.id) || [],
        }))

        setEntries(enriched)
      } else {
        setEntries([])
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err)
    }
    setLoading(false)
  }, [user, selectedKind])

  useEffect(() => {
    if (user) loadPortfolio()
  }, [user, loadPortfolio])

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function formatMetricValue(metric: PortfolioMetric): string {
    if (metric.value_text) return metric.value_text
    if (metric.value_number == null) return 'N/A'
    
    const num = metric.value_number
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return String(num)
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
            <h1 className="text-[17px] font-semibold">Portfolio</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-[var(--accent-purple)] text-[14px] font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Entry
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {ENTRY_KINDS.map(kind => (
              <button
                key={kind.id}
                onClick={() => setSelectedKind(kind.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                  selectedKind === kind.id
                    ? 'bg-[var(--accent)] text-[var(--button-text-on-accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {kind.icon && <span>{kind.icon}</span>}
                {kind.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <span className="text-5xl">📁</span>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No portfolio entries</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xs mx-auto text-[15px]">
              {selectedKind !== 'all'
                ? `No ${ENTRY_KINDS.find(k => k.id === selectedKind)?.label.toLowerCase()} entries yet`
                : 'Showcase your best work by adding portfolio entries in the app'
              }
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary inline-flex items-center gap-2 px-8 py-4"
            >
              Add Your First Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(entry => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="text-left rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] overflow-hidden hover:border-[var(--border-strong)] transition-all"
              >
                {/* Cover Media */}
                {entry.media && entry.media.length > 0 ? (
                  <div className="aspect-video bg-[var(--surface-hover)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.media[0].storage_path}
                      alt={entry.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-[var(--accent-purple)]/20 to-[var(--accent-purple-alt)]/20 flex items-center justify-center">
                    <span className="text-4xl">
                      {ENTRY_KINDS.find(k => k.id === entry.entry_kind)?.icon || '📄'}
                    </span>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-[15px] line-clamp-1">{entry.title}</h3>
                      {entry.brand_name && (
                        <p className="text-[var(--text-secondary)] text-[13px]">{entry.brand_name}</p>
                      )}
                    </div>
                    {entry.featured_rank && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--premium-gold)]/20 text-[var(--premium-gold)] text-[11px] font-medium">
                        Featured
                      </span>
                    )}
                  </div>

                  <p className="text-[var(--text-muted)] text-[13px] line-clamp-2 mb-3">
                    {entry.brief}
                  </p>

                  <div className="flex items-center justify-between text-[var(--text-muted)] text-[12px]">
                    <span>
                      {formatDate(entry.start_date)}
                      {entry.end_date && ` - ${formatDate(entry.end_date)}`}
                    </span>
                    {entry.tags && entry.tags.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hover)]">
                        {entry.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl my-8 animate-scale-in">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--separator)] bg-[var(--bg)]">
              <h2 className="text-[17px] font-semibold">{selectedEntry.title}</h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Media Gallery */}
            {selectedEntry.media && selectedEntry.media.length > 0 && (
              <div className="relative">
                <div className="aspect-video bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedEntry.media[0].storage_path}
                    alt={selectedEntry.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                {selectedEntry.media.length > 1 && (
                  <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
                    {selectedEntry.media.map((media, i) => (
                      <Fragment key={media.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={media.storage_path}
                          alt={`${selectedEntry.title} ${i + 1}`}
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-5">
              {selectedEntry.brand_name && (
                <p className="text-[var(--accent-purple)] font-semibold mb-2">{selectedEntry.brand_name}</p>
              )}
              
              <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed mb-4">
                {selectedEntry.brief}
              </p>

              {selectedEntry.role && (
                <p className="text-[var(--text-muted)] text-[14px] mb-4">
                  <span className="font-medium">Role:</span> {selectedEntry.role}
                </p>
              )}

              {/* Metrics */}
              {selectedEntry.metrics && selectedEntry.metrics.length > 0 && (
                <div className="grid grid-cols-3 gap-4 p-4 mb-4 rounded-[var(--radius-sm)] bg-[var(--surface)]">
                  {selectedEntry.metrics.map(metric => (
                    <div key={metric.id} className="text-center">
                      <p className="text-[20px] font-bold text-[var(--accent-purple)]">
                        {formatMetricValue(metric)}
                        {metric.unit && <span className="text-[12px] text-[var(--text-muted)]">{metric.unit}</span>}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] capitalize">{metric.metric_type.replace('_', ' ')}</p>
                      {metric.delta_value && (
                        <p className={`text-[11px] ${metric.delta_value > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                          {metric.delta_value > 0 ? '+' : ''}{metric.delta_value}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedEntry.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] text-[12px]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Links */}
              {selectedEntry.links && selectedEntry.links.length > 0 && (
                <div className="space-y-2">
                  {selectedEntry.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[var(--accent-purple)] text-[14px] hover:underline"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      {link.label || 'View Link'}
                    </a>
                  ))}
                </div>
              )}

              {/* Dates */}
              <p className="text-[var(--text-muted)] text-[13px] mt-4">
                {formatDate(selectedEntry.start_date)}
                {selectedEntry.end_date && ` - ${formatDate(selectedEntry.end_date)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Portfolio Entry Modal */}
      {showAddModal && user && (
        <AddPortfolioEntryModal
          userId={user.id}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            loadPortfolio()
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}
