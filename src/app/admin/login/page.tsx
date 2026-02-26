'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAdminBase } from '@/lib/admin'

/**
 * Admin login URL: redirects to admin base (e.g. /admin or obscure path) so sign-in happens on the main admin page.
 */
export default function AdminLoginPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getAdminBase())
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
