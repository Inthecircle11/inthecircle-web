'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'
import Link from 'next/link'

const MFAEnroll = dynamic(() => import('@/components/MFAEnroll'), { ssr: false })

interface NotificationSettings {
  push_enabled: boolean
  email_enabled: boolean
  matches: boolean
  messages: boolean
  likes: boolean
  comments: boolean
  mentions: boolean
  challenges: boolean
  marketing: boolean
}

interface SettingsItem {
  label: string
  href?: string
  external?: boolean
  value?: string
  action?: () => void
  danger?: boolean
}

interface SettingsToggle {
  key: string
  label: string
}

interface SettingsSection {
  id: string
  title: string
  icon: string
  items?: SettingsItem[]
  toggles?: SettingsToggle[]
  custom?: string
}

export default function SettingsView({ initialSection = null }: { initialSection?: string | null }) {
  const { user, profile, signOut, signingOut } = useApp()
  const [activeSection, setActiveSection] = useState<string | null>(initialSection)
  const [hasMFA, setHasMFA] = useState<boolean | null>(null)
  const [showMFAEnroll, setShowMFAEnroll] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    push_enabled: true,
    email_enabled: true,
    matches: true,
    messages: true,
    likes: true,
    comments: true,
    mentions: true,
    challenges: true,
    marketing: false,
  })
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function checkMFA() {
      if (!user) return
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      setHasMFA((data?.totp?.length ?? 0) > 0)
    }
    if (user) checkMFA()
  }, [user])

  useEffect(() => {
    if (initialSection && !activeSection) queueMicrotask(() => setActiveSection(initialSection))
  }, [initialSection, activeSection])

  useEffect(() => {
    if (activeSection) {
      const t = setTimeout(() => {
        document.getElementById(`settings-section-${activeSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
      return () => clearTimeout(t)
    }
  }, [activeSection])

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'system' | 'dark' | 'light' | null
    if (savedTheme) queueMicrotask(() => setTheme(savedTheme))
  }, [])

  function handleThemeChange(newTheme: 'system' | 'dark' | 'light') {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return
    if (!confirm('This will permanently delete all your data. Type "DELETE" to confirm.')) return
    setLoading(true)
    const supabase = createClient()
    try {
      await supabase.from('data_requests').insert({
        user_id: user?.id,
        request_type: 'deletion',
        status: 'pending',
      })
      alert('Your account deletion request has been submitted. You will receive an email confirmation.')
      signOut()
    } catch {
      alert('Failed to submit deletion request. Please try again.')
    }
    setLoading(false)
  }

  async function handleDownloadData() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    try {
      await supabase.from('data_requests').insert({
        user_id: user.id,
        request_type: 'download',
        status: 'pending',
      })
      alert('Your data download request has been submitted. You will receive an email with your data.')
    } catch {
      alert('Failed to submit request. Please try again.')
    }
    setLoading(false)
  }

  const settingsSections: SettingsSection[] = [
    { id: 'account', title: 'Account', icon: '👤', items: [
      { label: 'Edit Profile', href: '/profile/edit' },
      { label: 'Email', value: user?.email },
      { label: 'Username', value: profile?.username ? `@${profile.username}` : 'Not set' },
    ]},
    { id: 'security', title: 'Security', icon: '🔐', items: [
      { label: 'Two-Factor Authentication', value: hasMFA ? 'Enabled' : 'Disabled', action: () => !hasMFA && setShowMFAEnroll(true) },
      { label: 'Change Password', href: '/forgot-password' },
    ]},
    { id: 'notifications', title: 'Notifications', icon: '🔔', toggles: [
      { key: 'push_enabled', label: 'Push Notifications' },
      { key: 'email_enabled', label: 'Email Notifications' },
      { key: 'matches', label: 'New Matches' },
      { key: 'messages', label: 'Messages' },
      { key: 'likes', label: 'Likes' },
      { key: 'comments', label: 'Comments' },
      { key: 'mentions', label: 'Mentions' },
      { key: 'challenges', label: 'Challenges' },
      { key: 'marketing', label: 'Marketing & Updates' },
    ]},
    { id: 'privacy', title: 'Privacy', icon: '🛡️', items: [
      { label: 'Blocked Users', href: '/settings/blocked' },
      { label: 'Download My Data', action: handleDownloadData },
      { label: 'Delete Account', action: handleDeleteAccount, danger: true },
    ]},
    { id: 'about', title: 'About', icon: 'ℹ️', items: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'App Version', value: '1.0.0' },
    ]},
    { id: 'appearance', title: 'Appearance', icon: '🎨', custom: 'theme' },
    { id: 'support', title: 'Support', icon: '❓', items: [
      { label: 'Help Center', href: 'mailto:support@inthecircle.co' },
      { label: 'Send Feedback', href: 'mailto:feedback@inthecircle.co' },
      { label: 'Rate In The Circle', href: 'https://apps.apple.com/app/inthecircle', external: true },
      { label: 'Contact Support', href: 'mailto:support@inthecircle.co' },
    ]},
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <h1 className="text-[18px] font-bold tracking-tight">Settings</h1>
          <button
            type="button"
            onClick={() => signOut()}
            disabled={signingOut}
            className="text-[var(--error)] text-[14px] font-medium disabled:opacity-60 disabled:pointer-events-none"
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 pb-24 md:pb-6">
        <div className="space-y-6">
          {settingsSections.map(section => (
            <div key={section.id} id={`settings-section-${section.id}`}>
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[var(--surface)] border border-[var(--separator)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-smooth"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{section.icon}</span>
                  <span className="font-semibold text-[15px]">{section.title}</span>
                </div>
                <svg
                  className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${activeSection === section.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {activeSection === section.id && (
                <div className="mt-2 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--separator)] overflow-hidden animate-fade-in">
                  {section.items?.map((item, i) => (
                    <div key={i} className="border-b border-[var(--separator)] last:border-0">
                      {item.href ? (
                        item.external ? (
                          <a href={item.href} className="flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors">
                            <span className={`text-[14px] ${item.danger ? 'text-[var(--error)]' : ''}`}>{item.label}</span>
                            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </a>
                        ) : (
                          <Link href={item.href} className="flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors">
                            <span className={`text-[14px] ${item.danger ? 'text-[var(--error)]' : ''}`}>{item.label}</span>
                            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </Link>
                        )
                      ) : item.action ? (
                        <button
                          type="button"
                          onClick={item.action}
                          disabled={loading}
                          className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors text-left disabled:opacity-50"
                        >
                          <span className={`text-[14px] ${item.danger ? 'text-[var(--error)]' : ''}`}>{item.label}</span>
                          {item.value && (
                            <span className={`text-[14px] ${item.value === 'Enabled' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>{item.value}</span>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between p-4">
                          <span className="text-[14px]">{item.label}</span>
                          <span className="text-[14px] text-[var(--text-muted)]">{item.value}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {section.toggles?.map((toggle, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b border-[var(--separator)] last:border-0">
                      <span className="text-[14px]">{toggle.label}</span>
                      <button
                        type="button"
                        onClick={() => setNotificationSettings(prev => ({ ...prev, [toggle.key]: !prev[toggle.key as keyof NotificationSettings] }))}
                        className={`w-12 h-7 rounded-full transition-colors ${notificationSettings[toggle.key as keyof NotificationSettings] ? 'bg-[var(--accent-purple)]' : 'bg-[var(--surface-hover)]'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings[toggle.key as keyof NotificationSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                  {section.custom === 'theme' && (
                    <div className="p-4 space-y-3">
                      {(['system', 'dark', 'light'] as const).map(t => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => handleThemeChange(t)}
                          className={`w-full flex items-center justify-between p-3 rounded-[var(--radius-sm)] transition-colors ${theme === t ? 'bg-[var(--accent-purple)]/15 border border-[var(--accent-purple)]' : 'bg-[var(--bg)] border border-[var(--separator)] hover:border-[var(--border-strong)]'}`}
                        >
                          <span className="text-[14px] capitalize">{t}</span>
                          {theme === t && (
                            <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 24 24">
                              <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {showMFAEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--separator)]">
            <MFAEnroll
              onEnrolled={() => { setShowMFAEnroll(false); setHasMFA(true) }}
              onCancelled={() => setShowMFAEnroll(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
