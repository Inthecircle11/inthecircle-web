import type { Metadata } from 'next'

/** Canonical admin: https://app.inthecircle.co/admin (or /ADMIN_BASE_PATH when set). */
export const metadata: Metadata = {
  title: 'Admin – Inthecircle',
  description: 'Admin panel for Inthecircle. Review applications, users, verifications, and inbox.',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminBase = process.env.ADMIN_BASE_PATH?.trim()
    ? `/${process.env.ADMIN_BASE_PATH.trim()}`
    : '/admin'
  return (
    <>
      <span id="admin-base" data-value={adminBase} aria-hidden className="sr-only" />
      {children}
    </>
  )
}
