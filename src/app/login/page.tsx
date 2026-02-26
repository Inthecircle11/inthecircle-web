'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'

/** Sign-in is disabled for now. Redirect to signup. */
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/signup')
  }, [router])

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-[#050507] via-[#0a0a0f] to-[#0f0f18]" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-[88px] h-[88px] rounded-2xl bg-[var(--surface)]/80 border border-[var(--separator)] flex items-center justify-center backdrop-blur-xl p-3">
          <Logo size="2xl" />
        </div>
        <p className="text-[var(--text-secondary)] text-center">
          Sign-in is temporarily disabled. Redirecting to sign up…
        </p>
        <div className="w-8 h-8 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}
