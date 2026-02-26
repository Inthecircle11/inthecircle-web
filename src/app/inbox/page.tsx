'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

// ============================================
// TYPES
// ============================================

interface InboxMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  seen_at: string | null
  delivered_at: string | null
  created_at: string
}

// Helper to check if message is read/delivered
const isRead = (m: InboxMessage) => m.seen_at !== null
const isDelivered = (m: InboxMessage) => m.delivered_at !== null

interface UserProfile {
  id: string
  username: string | null
  name: string | null
  profile_image_url: string | null
}

interface MessageThread {
  id: string
  user1_id: string | null
  user2_id: string | null
  created_at: string
  updated_at: string
}

interface Conversation {
  threadId: string
  otherUserId: string
  otherUserName: string
  otherUserUsername: string
  otherUserAvatar: string | null
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  messages: InboxMessage[]
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InboxPage() {
  const { user } = useApp()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchText, setSearchText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<Record<string, UserProfile>>({})
  const [imageVersion, setImageVersion] = useState(0)
  const [activeTab, setActiveTab] = useState<'primary' | 'requests'>('primary')
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // ============================================
  // LOAD INBOX
  // ============================================

  const loadInbox = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    setError(null)
    const supabase = createClient()
    
    try {
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(50)
      
      if (threadsError) throw threadsError
      if (!threads || threads.length === 0) {
        setConversations([])
        setRefreshing(false)
        return
      }

      const threadIds = (threads as MessageThread[]).map((t: MessageThread) => t.id)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
        .limit(300)
      
      if (messagesError) throw messagesError

      const otherUserIds = (threads as MessageThread[]).map((t: MessageThread) => 
        t.user1_id === user.id ? t.user2_id : t.user1_id
      ).filter(Boolean) as string[]
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, name, profile_image_url')
        .in('id', otherUserIds)

      if (profilesError) throw profilesError

      const pMap: Record<string, UserProfile> = {}
      ;(profiles as UserProfile[] | null)?.forEach((p: UserProfile) => {
        pMap[p.id] = p
      })
      setProfileMap(pMap)

      const messagesByThread: Record<string, InboxMessage[]> = {}
      ;(messages as InboxMessage[] | null)?.forEach((m: InboxMessage) => {
        if (!messagesByThread[m.thread_id]) {
          messagesByThread[m.thread_id] = []
        }
        messagesByThread[m.thread_id].push({
          id: m.id,
          thread_id: m.thread_id,
          sender_id: m.sender_id,
          content: m.content,
          media_url: m.media_url,
          media_type: m.media_type,
          seen_at: m.seen_at,
          delivered_at: m.delivered_at,
          created_at: m.created_at
        })
      })

      const convos: Conversation[] = (threads as MessageThread[]).map((thread: MessageThread) => {
        const otherUserId = thread.user1_id === user.id ? thread.user2_id : thread.user1_id
        const profile = otherUserId ? pMap[otherUserId] : null
        const threadMessages = messagesByThread[thread.id] || []
        const lastMsg = threadMessages[0]
        const unread = threadMessages.filter(m => 
          m.sender_id !== user.id && !isRead(m)
        ).length

        return {
          threadId: thread.id,
          otherUserId: otherUserId || 'unknown',
          otherUserName: profile?.name || profile?.username || 'Unknown User',
          otherUserUsername: profile?.username || 'unknown',
          otherUserAvatar: profile?.profile_image_url || null,
          lastMessage: lastMsg?.content || (lastMsg?.media_url ? '📷 Photo' : 'Start a conversation'),
          lastMessageTime: lastMsg ? new Date(lastMsg.created_at) : new Date(thread.updated_at),
          unreadCount: unread,
          messages: threadMessages.slice(0, 50)
        }
      })

      convos.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
      setConversations(convos)
    } catch (err) {
      console.error('Failed to load inbox:', err)
      setError('Failed to load messages')
    }
    
    setRefreshing(false)
  }, [user])

  useEffect(() => {
    if (user) loadInbox()
  }, [user, loadInbox])

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    let debounceTimer: ReturnType<typeof setTimeout>
    const debouncedReload = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        setImageVersion(v => v + 1)
        loadInbox()
      }, 500)
    }

    const messagesChannel = supabase
      .channel('user-messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, debouncedReload)
      .subscribe()
    const threadsChannel = supabase
      .channel('user-threads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads' }, debouncedReload)
      .subscribe()

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(threadsChannel)
    }
  }, [user, loadInbox])

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  
  const filteredConversations = conversations.filter(c => {
    const q = searchText.toLowerCase()
    if (!q) return true
    return (c.otherUserName?.toLowerCase().includes(q)) ||
      (c.otherUserUsername?.toLowerCase().includes(q)) ||
      (c.lastMessage?.toLowerCase().includes(q))
  })

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
    return `${Math.floor(seconds / 604800)}w`
  }

  async function sendMessage() {
    if (!user || !selectedConversation || !messageInput.trim() || sendingMessage) return
    setSendingMessage(true)
    const supabase = createClient()

    try {
      // Insert the message
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          thread_id: selectedConversation.threadId,
          sender_id: user.id,
          content: messageInput.trim(),
          read: false,
          delivered: true,
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Update the thread's updated_at
      await supabase
        .from('message_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.threadId)

      // Update local state optimistically
      if (newMessage) {
        setSelectedConversation(prev => {
          if (!prev) return null
          return {
            ...prev,
            messages: [...prev.messages, newMessage],
            lastMessage: newMessage.content || '',
            lastMessageTime: new Date(newMessage.created_at),
          }
        })
        
        setConversations(prev => prev.map(c => {
          if (c.threadId === selectedConversation.threadId) {
            return {
              ...c,
              messages: [...c.messages, newMessage],
              lastMessage: newMessage.content || '',
              lastMessageTime: new Date(newMessage.created_at),
            }
          }
          return c
        }))
      }

      setMessageInput('')
    } catch (err) {
      console.error('Error sending message:', err)
    }
    setSendingMessage(false)
  }

  function _handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header - iOS style with large title */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-[28px] font-bold">Messages</h1>
              {totalUnread > 0 && (
                <p className="text-[13px] text-[var(--text-muted)]">{totalUnread} unread</p>
              )}
            </div>
            <button
              onClick={() => loadInbox()}
              disabled={refreshing}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg className={`w-5 h-5 text-[var(--text-secondary)] ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Tabs - iOS style segmented control */}
          <div className="segmented-control">
            <button 
              className={activeTab === 'primary' ? 'active' : ''}
              onClick={() => setActiveTab('primary')}
            >
              Primary
            </button>
            <button 
              className={activeTab === 'requests' ? 'active' : ''}
              onClick={() => setActiveTab('requests')}
            >
              Requests
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="input-field w-full pl-12"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-[var(--radius-sm)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" />
            </svg>
            {error}
            <button onClick={loadInbox} className="ml-auto text-[var(--accent-purple)] font-medium hover:underline">
              Retry
            </button>
          </div>
        )}

        {/* Conversations */}
        {refreshing && conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-muted)] text-[15px]">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)] flex items-center justify-center">
              <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--text-secondary)] text-[17px]">No messages yet</p>
            <p className="text-[15px] mt-2 text-[var(--text-muted)]">Start connecting with creators in the app</p>
            <a
              href="/connect"
              className="btn-primary inline-flex items-center gap-2 px-8 py-4 mt-6"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Connect with Creators
            </a>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map(convo => (
              <button
                key={convo.threadId}
                onClick={() => setSelectedConversation(convo)}
                className={`w-full p-4 rounded-[var(--radius-sm)] text-left transition-all flex items-center gap-4 ${
                  selectedConversation?.threadId === convo.threadId
                    ? 'bg-[var(--accent)]/10'
                    : 'hover:bg-[var(--surface)]'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {convo.otherUserAvatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${convo.otherUserAvatar}${convo.otherUserAvatar.includes('?') ? '&' : '?'}t=${imageVersion}`}
                      alt={convo.otherUserName}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold text-lg">
                      {convo.otherUserName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {convo.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[var(--error)] rounded-full flex items-center justify-center text-[11px] font-bold text-white">
                      {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`font-semibold text-[15px] truncate ${convo.unreadCount > 0 ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                      {convo.otherUserName}
                    </p>
                    <span className="text-[12px] text-[var(--text-muted)] flex-shrink-0 ml-2">
                      {formatTimeAgo(convo.lastMessageTime)}
                    </span>
                  </div>
                  <p className={`text-[14px] truncate ${convo.unreadCount > 0 ? 'text-[var(--text-secondary)] font-medium' : 'text-[var(--text-muted)]'}`}>
                    {convo.lastMessage}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Conversation Modal */}
      {selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          currentUserId={user?.id || null}
          profileMap={profileMap}
          imageVersion={imageVersion}
          onMessageSent={loadInbox}
        />
      )}
    </div>
  )
}

// ============================================
// CONVERSATION MODAL
// ============================================

function ConversationModal({
  conversation, onClose, currentUserId, profileMap: _profileMap, imageVersion, onMessageSent
}: {
  conversation: Conversation
  onClose: () => void
  currentUserId: string | null
  profileMap: Record<string, UserProfile>
  imageVersion: number
  onMessageSent: () => void
}) {
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [localMessages, setLocalMessages] = useState(conversation.messages)

  const sortedMessages = [...localMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  async function sendMessage() {
    if (!currentUserId || !messageInput.trim() || sendingMessage) return
    setSendingMessage(true)
    const supabase = createClient()

    try {
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          thread_id: conversation.threadId,
          sender_id: currentUserId,
          content: messageInput.trim(),
          read: false,
          delivered: true,
        })
        .select()
        .single()

      if (msgError) throw msgError

      await supabase
        .from('message_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.threadId)

      if (newMessage) {
        setLocalMessages(prev => [...prev, newMessage])
      }

      setMessageInput('')
      onMessageSent()
    } catch (err) {
      console.error('Error sending message:', err)
    }
    setSendingMessage(false)
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg)] rounded-[var(--radius-lg)] max-w-lg md:max-w-xl w-full max-h-[85vh] flex flex-col border border-[var(--separator)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--separator)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {conversation.otherUserAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`${conversation.otherUserAvatar}${conversation.otherUserAvatar.includes('?') ? '&' : '?'}t=${imageVersion}`}
                alt={conversation.otherUserName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--button-text-on-accent)] font-bold">
                {conversation.otherUserName[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="font-semibold text-[15px]">{conversation.otherUserName}</p>
              <p className="text-[13px] text-[var(--text-muted)]">@{conversation.otherUserUsername}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <p className="text-[15px]">No messages yet</p>
              <p className="text-[13px] mt-2">Send a message in the app</p>
            </div>
          ) : (
            sortedMessages.map(msg => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] p-3 rounded-[var(--radius-md)] ${
                      isMe 
                        ? 'bg-[var(--accent)] text-[var(--button-text-on-accent)] rounded-br-sm' 
                        : 'bg-[var(--surface)] text-[var(--text)] rounded-bl-sm'
                    }`}
                  >
                    {msg.media_url && (
                      <div className="mb-2">
                        {msg.media_type?.startsWith('image') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={msg.media_url} 
                            alt="Media" 
                            className="rounded-lg max-h-48 object-cover"
                          />
                        ) : msg.media_type?.startsWith('video') ? (
                          <video 
                            src={msg.media_url} 
                            controls 
                            className="rounded-lg max-h-48"
                          />
                        ) : (
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[var(--accent-purple)] underline"
                          >
                            📎 Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <p className="text-[15px] break-words">{msg.content}</p>
                    )}
                    <div className={`text-[11px] mt-1 ${isMe ? 'opacity-80' : 'text-[var(--text-muted)]'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && (
                        <span className="ml-2">
                          {isRead(msg) ? '✓✓' : isDelivered(msg) ? '✓' : '○'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-[var(--separator)]">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 h-12 px-4 rounded-full bg-[var(--surface)] border border-[var(--separator)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)] transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !messageInput.trim()}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--accent-purple)] text-white hover:bg-[var(--accent-purple-alt)] transition-colors disabled:opacity-50"
            >
              {sendingMessage ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
