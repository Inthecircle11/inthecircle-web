'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  actor_user_id: string | null
  actor_name: string | null
  actor_username: string | null
  actor_avatar_url: string | null
  target_post_id: string | null
  target_match_id: string | null
  created_at: string
}

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string }> = {
  match: { icon: '💫', color: 'bg-purple-500/20 text-purple-400' },
  like: { icon: '❤️', color: 'bg-red-500/20 text-red-400' },
  comment: { icon: '💬', color: 'bg-blue-500/20 text-blue-400' },
  follow: { icon: '👤', color: 'bg-green-500/20 text-green-400' },
  mention: { icon: '@', color: 'bg-amber-500/20 text-amber-400' },
  connection_request: { icon: '🤝', color: 'bg-indigo-500/20 text-indigo-400' },
  message: { icon: '✉️', color: 'bg-cyan-500/20 text-cyan-400' },
  challenge: { icon: '🏆', color: 'bg-yellow-500/20 text-yellow-400' },
  system: { icon: '🔔', color: 'bg-gray-500/20 text-gray-400' },
}

export default function NotificationsPage() {
  const { user } = useApp()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const loadNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter === 'unread') {
        query = query.eq('is_read', false)
      }

      const { data, error } = await query

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
    setLoading(false)
  }, [user, filter])

  useEffect(() => {
    if (user) loadNotifications()
  }, [user, loadNotifications])

  // Real-time subscription (requires `notifications` table in Supabase Realtime publication)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channelName = `notifications:${user.id}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadNotifications()
      )
      .subscribe((status: string, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[notifications] Realtime subscription error:', status, err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, loadNotifications])

  async function markAsRead(notificationId: string) {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
  }

  async function markAllAsRead() {
    if (!user) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function formatTimeAgo(dateStr: string): string {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    if (s < 604800) return `${Math.floor(s / 86400)}d`
    return new Date(dateStr).toLocaleDateString()
  }

  function getNotificationLink(notification: Notification): string {
    switch (notification.type) {
      case 'match':
        return '/matches'
      case 'like':
      case 'comment':
        return notification.target_post_id ? `/feed` : '/feed'
      case 'follow':
      case 'connection_request':
        return notification.actor_username ? `/user/${notification.actor_username}` : '/connect'
      case 'message':
        return '/inbox'
      case 'challenge':
        return '/challenges'
      default:
        return '/notifications'
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

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
            <h1 className="text-[17px] font-semibold">Notifications</h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[var(--accent-purple)] text-[14px] font-medium hover:text-[var(--accent-purple-alt)] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          
          {/* Filter tabs */}
          <div className="segmented-control mb-3">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <span className="text-5xl">🔔</span>
            </div>
            <h2 className="text-[22px] font-bold mb-2">No notifications</h2>
            <p className="text-[var(--text-secondary)] max-w-xs mx-auto text-[15px]">
              {filter === 'unread' 
                ? "You're all caught up!"
                : "When you get notifications, they'll show up here"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(notification => {
              const iconInfo = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system
              
              return (
                <Link
                  key={notification.id}
                  href={getNotificationLink(notification)}
                  onClick={() => markAsRead(notification.id)}
                  className={`flex items-start gap-4 p-4 rounded-[var(--radius-sm)] transition-all ${
                    notification.is_read 
                      ? 'hover:bg-[var(--surface)]' 
                      : 'bg-[var(--accent-purple)]/5 hover:bg-[var(--accent-purple)]/10'
                  }`}
                >
                  {/* Actor avatar or icon */}
                  <div className="relative flex-shrink-0">
                    {notification.actor_avatar_url ? (
                      <img
                        src={notification.actor_avatar_url}
                        alt={notification.actor_name || 'User'}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${iconInfo.color}`}>
                        {iconInfo.icon}
                      </div>
                    )}
                    {!notification.is_read && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--accent-purple)] rounded-full border-2 border-[var(--bg)]" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] leading-relaxed ${notification.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text)]'}`}>
                      {notification.actor_name && (
                        <span className="font-semibold">{notification.actor_name} </span>
                      )}
                      {notification.body}
                    </p>
                    <p className="text-[var(--text-muted)] text-[12px] mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
