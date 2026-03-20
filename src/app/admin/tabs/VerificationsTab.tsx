'use client'

import type { VerificationRequest } from '../types'
import { Avatar } from '../components/Avatar'
import { formatTimeAgo } from '../utils'

export interface VerificationsTabProps {
  pendingVerifications: VerificationRequest[]
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
  actionLoading: string | null
}

export function VerificationsTab({
  pendingVerifications,
  onApprove,
  onReject,
  actionLoading,
}: VerificationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-muted)]">
        Pending Verifications ({pendingVerifications.length})
      </div>

      {pendingVerifications.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="text-5xl mb-4">✓</div>
          <p>No pending verification requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(pendingVerifications ?? []).map((v) => (
            <div key={v.id} className="bg-[var(--surface)] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar url={v.profile_image_url} name={v.username} size={48} />
                  <div>
                    <p className="font-semibold">@{v.username}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Requested {formatTimeAgo(new Date(v.requested_at))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onReject(v.user_id)}
                    disabled={actionLoading === v.user_id}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(v.user_id)}
                    disabled={actionLoading === v.user_id}
                    className="px-4 py-2 bg-green-500 text-[var(--text)] rounded-xl hover:bg-green-600 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
