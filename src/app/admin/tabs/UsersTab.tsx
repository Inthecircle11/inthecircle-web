'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { User } from '../types'
import { Avatar } from '../components/Avatar'

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

const DESTRUCTIVE_REASON_MIN = 5

export type UserFilter = 'all' | 'verified' | 'banned' | 'new_7d'

export interface UsersTabProps {
  users: User[]
  usersTotalCount?: number
  usersPage?: number
  usersPageSize?: number
  onUsersPageChange?: (page: number) => void
  onToggleVerify: (id: string, current: boolean) => void
  onToggleBan: (id: string, current: boolean) => void
  onDelete: (id: string, reason: string) => void
  canDeleteUser?: boolean
  canAnonymizeUser?: boolean
  onExportUser?: (userId: string) => void | Promise<void>
  onAnonymizeUser?: (userId: string, reason: string) => void | Promise<void>
  actionLoading: string | null
  selectedUser: User | null
  setSelectedUser: (u: User | null) => void
}

export function UsersTab({
  users,
  usersTotalCount = 0,
  usersPage = 1,
  usersPageSize = 50,
  onUsersPageChange,
  onToggleVerify,
  onToggleBan,
  onDelete,
  canDeleteUser = true,
  canAnonymizeUser = true,
  onExportUser,
  onAnonymizeUser,
  actionLoading,
  selectedUser,
  setSelectedUser,
}: UsersTabProps) {
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState<UserFilter>('all')

  const filteredBySearch = users.filter(
    (u) =>
      (u.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(search.toLowerCase())
  )
  const filteredUsers =
    userFilter === 'all'
      ? filteredBySearch
      : userFilter === 'verified'
        ? filteredBySearch.filter((u) => u.is_verified)
        : userFilter === 'banned'
          ? filteredBySearch.filter((u) => u.is_banned)
          : filteredBySearch.filter((u) => {
              if (!u.created_at) return false
              const weekAgo = new Date()
              weekAgo.setDate(weekAgo.getDate() - 7)
              return new Date(u.created_at) > weekAgo
            })

  return (
    <div className="space-y-4">
      <input
        id="admin-users-search"
        name="users-search"
        type="text"
        placeholder="Search users by name, username, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field w-full"
        aria-label="Search users"
      />
      <div className="flex flex-wrap gap-2">
        {(['all', 'verified', 'banned', 'new_7d'] as UserFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setUserFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
              userFilter === f
                ? 'bg-[var(--accent-purple)] text-[var(--text)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--separator)]'
            }`}
          >
            {f === 'all'
              ? 'All'
              : f === 'verified'
                ? 'Verified'
                : f === 'banned'
                  ? 'Banned'
                  : 'New (7d)'}
          </button>
        ))}
      </div>

      <div className="text-sm text-[var(--text-muted)]">
        Users {usersTotalCount > 0 ? `(${filteredUsers.length} on this page, ${usersTotalCount} total)` : `(${filteredUsers.length})`}
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="bg-[var(--surface)] border border-[var(--separator)] p-4 rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-smooth card-interactive"
          >
            <div className="flex items-center gap-4">
              <Avatar url={user.profile_image_url} name={user.name || '?'} size={48} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">
                    {user.name || 'No name'}
                  </span>
                  {user.is_verified && <span className="text-[var(--verified)]">✓</span>}
                  {user.is_banned && <span className="text-[var(--error)]">🚫</span>}
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  @{user.username} • {user.email}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {onUsersPageChange && usersPageSize > 0 && usersTotalCount > usersPageSize && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => onUsersPageChange(usersPage - 1)}
            disabled={usersPage <= 1}
            className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Page {usersPage} of {Math.max(1, Math.ceil(usersTotalCount / usersPageSize))}
          </span>
          <button
            type="button"
            onClick={() => onUsersPageChange(usersPage + 1)}
            disabled={usersPage >= Math.ceil(usersTotalCount / usersPageSize)}
            className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--separator)] rounded-lg disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleVerify={() =>
            onToggleVerify(selectedUser.id, selectedUser.is_verified)
          }
          onToggleBan={() => onToggleBan(selectedUser.id, selectedUser.is_banned)}
          onDelete={(reason) => onDelete(selectedUser.id, reason)}
          canDeleteUser={canDeleteUser}
          canAnonymizeUser={canAnonymizeUser}
          onExportUser={onExportUser}
          onAnonymizeUser={
            onAnonymizeUser
              ? (reason) => onAnonymizeUser(selectedUser.id, reason)
              : undefined
          }
          isLoading={actionLoading === selectedUser.id}
        />
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] rounded-xl">
      <span>{icon}</span>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

function UserDetailModal({
  user,
  onClose,
  onToggleVerify,
  onToggleBan,
  onDelete,
  canDeleteUser = true,
  canAnonymizeUser = true,
  onExportUser,
  onAnonymizeUser,
  isLoading,
}: {
  user: User
  onClose: () => void
  onToggleVerify: () => void
  onToggleBan: () => void
  onDelete: (reason: string) => void
  canDeleteUser?: boolean
  canAnonymizeUser?: boolean
  onExportUser?: (userId: string) => void | Promise<void>
  onAnonymizeUser?: (reason: string) => void | Promise<void>
  isLoading: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pendingAction, setPendingAction] = useState<'delete' | 'anonymize' | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const handleClose = useModalFocusTrap(dialogRef, () => {
    setPendingAction(null)
    setReasonInput('')
    onClose()
  })
  const submitDestructive = () => {
    const reason = reasonInput.trim()
    if (reason.length < DESTRUCTIVE_REASON_MIN) return
    if (pendingAction === 'delete') onDelete(reason)
    if (pendingAction === 'anonymize' && onAnonymizeUser) onAnonymizeUser(reason)
    setPendingAction(null)
    setReasonInput('')
  }
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--surface)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 id="user-detail-title" className="text-xl font-bold">
              User Details
            </h2>
            <button
              onClick={handleClose}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {pendingAction ? (
            <div className="space-y-4">
              <p className="text-[var(--text-secondary)]">
                {pendingAction === 'delete'
                  ? 'Permanently delete this user and all their data. This cannot be undone.'
                  : 'Anonymize this user? Profile name/username/image will be replaced. This cannot be undone.'}
              </p>
              <label className="block text-sm font-medium text-[var(--text)]">
                Reason (required, min {DESTRUCTIVE_REASON_MIN} characters)
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. GDPR erasure request"
                rows={3}
                className="input-field w-full resize-y"
                aria-label="Reason"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAction(null)
                    setReasonInput('')
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--separator)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitDestructive}
                  disabled={
                    reasonInput.trim().length < DESTRUCTIVE_REASON_MIN || isLoading
                  }
                  className={`px-4 py-2 rounded-xl font-medium disabled:opacity-50 ${
                    pendingAction === 'delete'
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  }`}
                >
                  {pendingAction === 'delete' ? 'Delete User' : 'Anonymize'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <Avatar
                  url={user.profile_image_url}
                  name={user.name || '?'}
                  size={100}
                />
                <div className="mt-4 flex items-center justify-center gap-2">
                  <h3 className="text-xl font-bold">{user.name || 'No name'}</h3>
                  {user.is_verified && (
                    <span className="text-[var(--verified)] text-lg">✓</span>
                  )}
                </div>
                <p className="text-[var(--text-secondary)]">@{user.username}</p>
              </div>

              <div className="space-y-3 mb-6">
                <DetailRow
                  icon="📧"
                  label="Email"
                  value={user.email || 'No email'}
                />
                <DetailRow
                  icon="📅"
                  label="Joined"
                  value={
                    user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : 'Unknown'
                  }
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={onToggleVerify}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <span
                    className={
                      user.is_verified
                        ? 'text-[var(--verified)]'
                        : 'text-[var(--text-secondary)]'
                    }
                  >
                    {user.is_verified ? '✓' : '○'}
                  </span>
                  <span>
                    {user.is_verified
                      ? 'Remove Verification'
                      : 'Verify User'}
                  </span>
                </button>

                <button
                  onClick={onToggleBan}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <span
                    className={
                      user.is_banned ? 'text-green-400' : 'text-yellow-400'
                    }
                  >
                    {user.is_banned ? '✓' : '🚫'}
                  </span>
                  <span>{user.is_banned ? 'Unban User' : 'Ban User'}</span>
                </button>

                {onExportUser && (
                  <button
                    onClick={() => onExportUser(user.id)}
                    className="w-full flex items-center gap-3 p-4 bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)]"
                  >
                    <span>📤</span>
                    <span>Export user data (GDPR)</span>
                  </button>
                )}
                {canAnonymizeUser && onAnonymizeUser && (
                  <button
                    onClick={() => setPendingAction('anonymize')}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-4 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <span>🔒</span>
                    <span>Anonymize user</span>
                  </button>
                )}
                {canDeleteUser && (
                  <button
                    onClick={() => setPendingAction('delete')}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-4 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <span>🗑️</span>
                    <span>Delete User</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
