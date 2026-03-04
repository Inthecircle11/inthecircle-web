'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ConversationDisplay, InboxMessage } from '../types'
import { Avatar } from '../components/Avatar'
import { formatTimeAgo } from '../utils'

function useModalFocusTrap(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const savedFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    savedFocusRef.current = document.activeElement as HTMLElement
    const el = dialogRef.current
    if (!el) return
    const focusables = Array.from(
      el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((e) => !e.hasAttribute('disabled'))
    const first = focusables[0]
    if (first) first.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        savedFocusRef.current?.focus()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const current = document.activeElement
      const idx = focusables.indexOf(current as HTMLElement)
      if (idx === -1) return
      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault()
          focusables[focusables.length - 1].focus()
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault()
          focusables[0].focus()
        }
      }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback(() => {
    savedFocusRef.current?.focus()
    onClose()
  }, [onClose])
}

const isMessageRead = (m: InboxMessage) => m.seen_at !== null
const isMessageDelivered = (m: InboxMessage) => m.delivered_at !== null

export interface InboxTabProps {
  conversations: ConversationDisplay[]
  loading: boolean
  onRefresh: () => void
  selectedConversation: ConversationDisplay | null
  setSelectedConversation: (c: ConversationDisplay | null) => void
  currentUserId: string | null
  senderProfiles: Record<string, { name: string; username: string }>
}

export function InboxTab({
  conversations,
  loading,
  onRefresh,
  selectedConversation,
  setSelectedConversation,
  currentUserId,
  senderProfiles,
}: InboxTabProps) {
  const [search, setSearch] = useState('')
  const [inboxTab, setInboxTab] = useState<'primary' | 'requests'>('primary')

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  const searchLower = search.trim().toLowerCase()
  const filteredConversations = !searchLower
    ? conversations
    : conversations.filter(
        (c) =>
          c.otherUserName.toLowerCase().includes(searchLower) ||
          c.otherUserUsername.toLowerCase().includes(searchLower) ||
          c.lastMessage.toLowerCase().includes(searchLower) ||
          (c.messages?.some((m) => m.content?.toLowerCase().includes(searchLower)) ?? false)
      )

  return (
    <div className="space-y-4">
      {/* Inbox Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">All Messages (Admin View)</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {conversations.length} conversations across all users • {totalUnread} unread
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl disabled:opacity-50 bg-[var(--accent-purple)] text-white hover:opacity-90"
        >
          {loading ? '↻ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Primary / Requests tabs (like iOS) */}
      <div className="flex gap-2 p-1 bg-[var(--surface)] rounded-xl">
        <button
          onClick={() => setInboxTab('primary')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            inboxTab === 'primary'
              ? 'bg-[var(--accent-purple)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Primary
        </button>
        <button
          onClick={() => setInboxTab('requests')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            inboxTab === 'requests'
              ? 'bg-[var(--accent-purple)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
        >
          Requests
        </button>
      </div>

      {/* Search — Primary only */}
      {inboxTab === 'primary' && (
        <div className="relative">
          <input
            id="admin-inbox-search"
            name="inbox-search"
            type="text"
            placeholder="Search by name, @username, or keyword in messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-[var(--surface)] border border-[var(--separator)] rounded-xl focus:border-[var(--accent-purple)] outline-none"
            aria-label="Search conversations"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            🔍
          </span>
        </div>
      )}

      {/* Requests: Coming soon */}
      {inboxTab === 'requests' ? (
        <div className="text-center py-12 text-[var(--text-muted)] rounded-xl bg-[var(--surface)] border border-[var(--separator)]">
          <div className="text-5xl mb-4">📩</div>
          <p className="font-medium text-[var(--text-secondary)]">Requests</p>
          <p className="text-sm mt-2">Coming soon. Request threads will appear here.</p>
        </div>
      ) : (
        <>
          {loading && conversations.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <div className="text-5xl mb-4">💬</div>
              <p>No conversations yet</p>
              <p className="text-sm mt-2">Messages will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((convo) => (
                <ConversationRow
                  key={convo.threadId}
                  conversation={convo}
                  onClick={() => setSelectedConversation(convo)}
                  isSelected={selectedConversation?.threadId === convo.threadId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          currentUserId={currentUserId}
          senderProfiles={senderProfiles}
        />
      )}
    </div>
  )
}

function ConversationRow({
  conversation,
  onClick,
  isSelected,
}: {
  conversation: ConversationDisplay
  onClick: () => void
  isSelected: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--accent-purple)]/20 border border-[var(--accent-purple)]/50'
          : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            url={conversation.otherUserAvatar}
            name={conversation.otherUserName}
            size={52}
          />
          {conversation.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-semibold truncate text-[var(--text)]">
              {conversation.otherUserName}
            </p>
            <span className="text-xs text-[var(--text-muted)] flex-shrink-0 ml-2">
              {formatTimeAgo(conversation.lastMessageTime)}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] truncate">
            @{conversation.otherUserUsername}
          </p>
          <p
            className={`text-sm truncate mt-1 ${
              conversation.unreadCount > 0
                ? 'text-[var(--text)] font-medium'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {conversation.lastMessage}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConversationModal({
  conversation,
  onClose,
  currentUserId: _currentUserId,
  senderProfiles,
}: {
  conversation: ConversationDisplay
  onClose: () => void
  currentUserId: string | null
  senderProfiles?: Record<string, { name: string; username: string }>
}) {
  const sortedMessages = [...conversation.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  let lastSenderId = ''
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = useModalFocusTrap(dialogRef, onClose)

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--surface)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversation-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--separator)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-purple)] to-pink-500 flex items-center justify-center text-[var(--text)] font-bold">
              💬
            </div>
            <div>
              <p id="conversation-modal-title" className="font-semibold">
                {conversation.otherUserName}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {conversation.otherUserUsername}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] text-2xl p-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <p>No messages in this conversation</p>
            </div>
          ) : (
            sortedMessages.map((msg, idx) => {
              const showSender = msg.sender_id !== lastSenderId
              lastSenderId = msg.sender_id
              const senderInfo = senderProfiles?.[msg.sender_id]
              const isEven = idx % 2 === 0
              return (
                <div key={msg.id} className="space-y-1">
                  {showSender && (
                    <p className="text-xs text-[var(--accent-purple)] font-medium ml-1">
                      {senderInfo?.name ||
                        senderInfo?.username ||
                        `User ${msg.sender_id.slice(0, 8)}`}
                    </p>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl ${
                      isEven
                        ? 'bg-[var(--accent-purple)]/20 border border-[var(--accent-purple)]/30'
                        : 'bg-[var(--surface-hover)] border border-[var(--border-strong)]'
                    }`}
                  >
                    {msg.media_url && (
                      <div className="mb-2">
                        {msg.media_type?.startsWith('image') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={msg.media_url}
                            alt="Media"
                            className="rounded-lg max-h-60 object-cover"
                          />
                        ) : msg.media_type?.startsWith('video') ? (
                          <video
                            src={msg.media_url}
                            controls
                            className="rounded-lg max-h-60"
                          />
                        ) : (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--verified)] underline"
                          >
                            📎 Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <p className="break-words text-[var(--text)]">{msg.content}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs mt-1 text-[var(--text-muted)]">
                      <span>
                        {new Date(msg.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {isMessageRead(msg)
                          ? '✓✓ Read'
                          : isMessageDelivered(msg)
                            ? '✓ Delivered'
                            : '○ Sent'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="p-4 border-t border-[var(--separator)] text-center text-sm text-[var(--text-muted)]">
          Admin View • {conversation.messages.length} messages total
        </div>
      </div>
    </div>
  )
}
