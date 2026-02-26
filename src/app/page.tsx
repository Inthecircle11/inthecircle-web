'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppShell'
import { APP_STORE_URL } from '@/lib/constants'
import { Logo } from '@/components/Logo'

const STATS = [
  { value: '1,000+', label: 'Elite Creators' },
  { value: '500+', label: 'Collaborations' },
  { value: '50+', label: 'Countries' },
  { value: '4.9★', label: 'App Store' },
]

export default function Home() {
  const router = useRouter()
  const { user, loading } = useApp()

  // Redirect logged-in users to feed
  useEffect(() => {
    if (!loading && user) {
      router.push('/feed')
    }
  }, [user, loading, router])

  // Show nothing while checking auth
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050507] via-[#0a0a0f] to-[#0f0f18]" />
      <div className="glow-white w-[480px] h-[480px] -top-40 -left-48 opacity-90" />
      <div className="glow-purple w-[420px] h-[420px] bottom-[120px] -right-40 opacity-90" />
      <div className="absolute w-[320px] h-[320px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_60%)]" />

      <main className="relative z-10 min-h-screen flex flex-col items-center w-full max-w-lg mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Hero */}
        <div className="w-full text-center animate-fade-in">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 sm:mb-8 rounded-2xl bg-[var(--surface)]/80 border border-[var(--separator)] flex items-center justify-center backdrop-blur-xl shadow-[var(--shadow-card)] ring-1 ring-white/5 p-3 sm:p-4">
            <Logo size="3xl" priority />
          </div>
          <h1 className="text-[36px] sm:text-[42px] md:text-[48px] gradient-text-hero mb-3 sm:mb-4 leading-tight">
            inthecircle
          </h1>
          <p className="text-[var(--text-secondary)] text-base sm:text-[18px] md:text-[19px] mb-8 sm:mb-12 max-w-sm mx-auto leading-relaxed">
            The #1 networking app for creators. Connect, create, and grow together.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
            <Link
              href="/signup"
              className="btn-gradient h-14 text-[17px] font-semibold rounded-xl shadow-[var(--shadow-glow-purple)] hover:shadow-[0_0_32px_-4px_rgba(99,102,241,0.45)] transition-shadow duration-300 flex items-center justify-center px-6"
            >
              Sign Up Free
            </Link>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 px-6 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)]/50 text-[var(--text)] font-semibold text-[17px] flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
            >
              Download App
            </a>
          </div>
        </div>

        {/* Stats card - mobile-safe: no overflow, proper grid */}
        <section className="w-full mt-10 sm:mt-12" aria-label="Stats">
          <div className="rounded-2xl bg-[#2e1f5c]/90 border border-[var(--separator)] p-4 sm:p-5 overflow-hidden">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {STATS.map(({ value, label }) => (
                <div
                  key={label}
                  className="min-w-0 flex flex-col items-center justify-center text-center py-2 sm:py-3"
                >
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white tabular-nums truncate w-full">
                    {value}
                  </span>
                  <span className="text-xs sm:text-sm text-[#a78bfa] font-medium mt-0.5 truncate w-full">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What is inthecircle - for SEO and clarity */}
        <section className="w-full mt-10 sm:mt-12 text-center" aria-labelledby="what-is-inthecircle">
          <h2 id="what-is-inthecircle" className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-4">
            What is inthecircle?
          </h2>
          <p className="text-[var(--text-secondary)] text-[15px] sm:text-base max-w-lg mx-auto leading-relaxed">
            inthecircle (In The Circle) is the #1 creator networking app where founders, YouTubers, streamers, and digital professionals connect and collaborate. Join the creator community, discover like-minded creators, and grow your circle—free on iOS.
          </p>
        </section>

        {/* THE EXPERIENCE */}
        <section className="w-full mt-10 sm:mt-12 text-center">
          <h2 className="text-[var(--accent-purple)] text-sm font-semibold tracking-wider uppercase mb-6">
            The Experience
          </h2>

          {/* Mission / FAQ - higher contrast for readability */}
          <p className="text-[var(--text-secondary)] text-[15px] sm:text-base">
            <Link href="https://inthecircle.co/about/" className="underline underline-offset-2 hover:text-[var(--accent-purple)]">
              Learn more about our mission
            </Link>
            {' · '}
            <Link href="https://inthecircle.co/faq/" className="underline underline-offset-2 hover:text-[var(--accent-purple)]">
              See our FAQ
            </Link>
          </p>
        </section>

        {/* Three Steps */}
        <section className="w-full mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] text-center mb-8">
            Three Steps to Your Circle
          </h2>
          <div className="space-y-6 sm:space-y-8">
            {[
              { step: '01', title: 'Download the App', body: 'Get InTheCircle free from the App Store. Create your profile in under 2 minutes.' },
              { step: '02', title: 'Discover Creators', body: 'Browse profiles matched to your interests. Find creators who align with your vision.' },
              { step: '03', title: 'Connect & Collaborate', body: 'Message directly, build relationships, and turn connections into opportunities.' },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="rounded-xl bg-[var(--surface)]/60 border border-[var(--separator)] p-4 sm:p-5 text-left"
              >
                <span className="text-[var(--accent-purple)] font-mono text-sm font-semibold">{step}</span>
                <h3 className="text-[var(--text)] font-semibold text-lg mt-1">{title}</h3>
                <p className="text-[var(--text-secondary)] text-[15px] mt-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="w-full mt-12 sm:mt-16 text-center">
          <p className="text-[var(--text-muted)] text-[15px] mb-4">
            Get the full experience on{' '}
            <a
              href={APP_STORE_URL}
              className="text-[var(--accent-purple)] hover:text-[var(--accent-purple-alt)] font-semibold transition-colors underline-offset-2 hover:underline"
            >
              iOS app
            </a>
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            No credit card required · Takes 2 minutes to set up
          </p>
        </div>
      </main>
    </div>
  )
}
