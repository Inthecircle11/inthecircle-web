'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { APP_STORE_URL } from '@/lib/constants'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams.get('type')

  // Auto-redirect logged-in users to feed
  useEffect(() => {
    if (type === 'login') {
      // Check if user is logged in and redirect to feed
      const checkAndRedirect = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          router.push('/feed')
        }
      }
      checkAndRedirect()
    }
  }, [type, router])

  const messages = {
    confirm: {
      title: 'Check your email',
      description: 'We sent you a confirmation link. Please check your email to verify your account.',
      icon: '📧',
    },
    complete: {
      title: 'Account created!',
      description: 'Your account is ready. You can now access your messages.',
      icon: '✅',
    },
    login: {
      title: 'Welcome back!',
      description: 'Redirecting you to your feed...',
      icon: '👋',
    },
  }

  const content = messages[type as keyof typeof messages] || messages.complete

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--bg)]">
      <div className="max-w-md w-full text-center animate-fade-in">
        {/* Icon */}
        <div className="text-6xl mb-6">{content.icon}</div>

        {/* Message */}
        <h1 className="text-2xl font-bold mb-4">{content.title}</h1>
        <p className="text-[var(--text-secondary)] mb-8">{content.description}</p>

        {/* Buttons based on type */}
        {type === 'login' ? (
          <div className="space-y-4">
            <a
              href="/feed"
              className="btn-primary inline-flex items-center gap-3 w-full justify-center"
            >
              🏠 Go to Feed
            </a>
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center gap-3 px-6 py-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl w-full justify-center text-[var(--text)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Download iOS App
            </a>
          </div>
        ) : (
          <>
            <a
              href={APP_STORE_URL}
              className="btn-primary inline-flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Download on iOS
            </a>
          </>
        )}

        {/* Back to home */}
        <p className="mt-8 text-sm text-[var(--text-secondary)]">
          <a href="https://inthecircle.co" className="hover:underline">
            ← Back to inthecircle.co
          </a>
        </p>
      </div>
    </main>
  )
}

export default function Success() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <SuccessContent />
    </Suspense>
  )
}

