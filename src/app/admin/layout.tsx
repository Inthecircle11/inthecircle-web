import type { Metadata } from 'next'
import { BuildVersionLog } from './BuildVersionLog'

/** Canonical admin: https://app.inthecircle.co/admin (or /ADMIN_BASE_PATH when set). */
export const metadata: Metadata = {
  title: 'Admin – Inthecircle',
  description: 'Admin panel for Inthecircle. Review applications, users, verifications, and inbox.',
  robots: 'noindex, nofollow',
}

/** Build fingerprint for observability: commit SHA (Vercel) or build timestamp. Not exposed to public site. */
function getBuildFingerprint(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (sha) return sha
  const ts = process.env.BUILD_TIMESTAMP?.trim()
  if (ts) return ts
  return 'unknown'
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminBase = process.env.ADMIN_BASE_PATH?.trim()
    ? `/${process.env.ADMIN_BASE_PATH.trim()}`
    : '/admin'
  const buildVersion = getBuildFingerprint()

  return (
    <>
      <span id="admin-base" data-value={adminBase} aria-hidden className="sr-only" />
      {children}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 py-2 px-4 text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400" title="Build fingerprint">
          Build {buildVersion}
        </span>
      </footer>
      <BuildVersionLog version={buildVersion} />
    </>
  )
}
