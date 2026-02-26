'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

interface SearchResult {
  type: 'user' | 'intent' | 'hashtag'
  id: string
  title: string
  subtitle: string | null
  image: string | null
  extra?: string
}

interface RecentSearch {
  query: string
  timestamp: number
}

export default function SearchPage() {
  const { user: _user } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'creators' | 'posts' | 'hashtags'>('all')
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      queueMicrotask(() => setRecentSearches(JSON.parse(saved)))
    }
  }, [])

  // Load trending hashtags
  useEffect(() => {
    async function loadTrending() {
      const supabase = createClient()
      // Get recent intents and extract hashtags
      const { data } = await supabase
        .from('intents')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        const tagCounts: Record<string, number> = {}
        data.forEach((intent: { content: string }) => {
          const tags = intent.content.match(/#\w+/g) || []
          tags.forEach((tag: string) => {
            tagCounts[tag.toLowerCase()] = (tagCounts[tag.toLowerCase()] || 0) + 1
          })
        })
        
        const sorted = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }))
        
        setTrending(sorted)
      }
    }
    loadTrending()
  }, [])

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const searchResults: SearchResult[] = []
    const q = searchQuery.toLowerCase()

    try {
      // Search users
      if (activeTab === 'all' || activeTab === 'creators') {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name, username, profile_image_url, niche, is_verified')
          .or(`name.ilike.%${q}%,username.ilike.%${q}%,about.ilike.%${q}%`)
          .limit(activeTab === 'all' ? 5 : 20)

        users?.forEach((user: { id: string; name: string | null; username: string | null; profile_image_url: string | null; niche: string | null; is_verified: boolean }) => {
          searchResults.push({
            type: 'user',
            id: user.username || user.id,
            title: user.name || user.username || 'Unknown',
            subtitle: user.username ? `@${user.username}` : null,
            image: user.profile_image_url,
            extra: user.niche || undefined,
          })
        })
      }

      // Search intents/posts
      if (activeTab === 'all' || activeTab === 'posts') {
        const { data: intents } = await supabase
          .from('intents')
          .select('id, content, author_name, author_username, author_image_url, created_at')
          .ilike('content', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)

        intents?.forEach((intent: { id: string; content: string; author_name: string | null; author_username: string | null; author_image_url: string | null }) => {
          searchResults.push({
            type: 'intent',
            id: intent.id,
            title: intent.content.slice(0, 100) + (intent.content.length > 100 ? '...' : ''),
            subtitle: `by ${intent.author_name || intent.author_username}`,
            image: intent.author_image_url,
          })
        })
      }

      // Search hashtags
      if (activeTab === 'all' || activeTab === 'hashtags') {
        const matchingTags = trending.filter(t => 
          t.tag.toLowerCase().includes(q) || q.includes(t.tag.toLowerCase().replace('#', ''))
        )
        
        matchingTags.forEach(tag => {
          searchResults.push({
            type: 'hashtag',
            id: tag.tag,
            title: tag.tag,
            subtitle: `${tag.count} posts`,
            image: null,
          })
        })
      }

      setResults(searchResults)

      // Save to recent searches
      if (searchQuery.trim().length >= 2) {
        const newRecent = [
          { query: searchQuery.trim(), timestamp: Date.now() },
          ...recentSearches.filter(r => r.query.toLowerCase() !== searchQuery.toLowerCase())
        ].slice(0, 10)
        setRecentSearches(newRecent)
        localStorage.setItem('recentSearches', JSON.stringify(newRecent))
      }
    } catch (err) {
      console.error('Search failed:', err)
    }

    setLoading(false)
  }, [activeTab, recentSearches, trending])

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, search])

  function clearRecentSearches() {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  function handleRecentSearch(searchQuery: string) {
    setQuery(searchQuery)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6">
          <div className="py-4">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search creators, posts, hashtags..."
                autoFocus
                className="input-field w-full pl-12 pr-10"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="segmented-control mb-3">
            <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>
              All
            </button>
            <button className={activeTab === 'creators' ? 'active' : ''} onClick={() => setActiveTab('creators')}>
              Creators
            </button>
            <button className={activeTab === 'posts' ? 'active' : ''} onClick={() => setActiveTab('posts')}>
              Posts
            </button>
            <button className={activeTab === 'hashtags' ? 'active' : ''} onClick={() => setActiveTab('hashtags')}>
              Hashtags
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : query ? (
          results.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--text-muted)] text-[15px]">No results found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, i) => (
                <Link
                  key={`${result.type}-${result.id}-${i}`}
                  href={result.type === 'user' ? `/user/${result.id}` : result.type === 'hashtag' ? `/search?q=${encodeURIComponent(result.title)}` : '/feed'}
                  className="flex items-center gap-4 p-4 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] transition-colors"
                >
                  {result.type === 'user' && (
                    result.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={result.image} alt={result.title} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--accent-purple)] flex items-center justify-center text-white font-bold">
                        {result.title[0]?.toUpperCase()}
                      </div>
                    )
                  )}
                  {result.type === 'intent' && (
                    result.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={result.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--surface)] flex items-center justify-center">
                        <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                      </div>
                    )
                  )}
                  {result.type === 'hashtag' && (
                    <div className="w-12 h-12 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] text-xl font-bold">
                      #
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-[var(--text-muted)] text-[13px] truncate">{result.subtitle}</p>
                    )}
                    {result.extra && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-muted)] text-[11px]">
                        {result.extra}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-semibold">Recent Searches</h2>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[var(--accent-purple)] text-[13px] font-medium"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((recent, i) => (
                    <button
                      key={i}
                      onClick={() => handleRecentSearch(recent.query)}
                      className="flex items-center gap-3 w-full p-3 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] transition-colors text-left"
                    >
                      <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[14px]">{recent.query}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Hashtags */}
            {trending.length > 0 && (
              <div>
                <h2 className="text-[15px] font-semibold mb-3">Trending</h2>
                <div className="space-y-1">
                  {trending.map((item, i) => (
                    <button
                      key={item.tag}
                      onClick={() => setQuery(item.tag)}
                      className="flex items-center gap-3 w-full p-3 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] transition-colors text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] text-[14px] font-medium">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-[14px] text-[var(--accent-purple)]">{item.tag}</p>
                        <p className="text-[var(--text-muted)] text-[12px]">{item.count} posts</p>
                      </div>
                      <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
