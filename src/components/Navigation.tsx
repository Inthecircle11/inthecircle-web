'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconHome, IconConnect, IconSprint, IconInbox, IconProfile } from '@/components/Icons'

const icons = {
  feed: (active: boolean) => <IconHome className={active ? 'text-[var(--accent-purple)]' : undefined} />,
  connect: (active: boolean) => <IconConnect className={active ? 'text-[var(--accent-purple)]' : undefined} />,
  sprint: (active: boolean) => <IconSprint className={active ? 'text-[var(--accent-purple)]' : undefined} />,
  inbox: (active: boolean) => <IconInbox className={active ? 'text-[var(--accent-purple)]' : undefined} />,
  profile: (active: boolean) => <IconProfile className={active ? 'text-[var(--accent-purple)]' : undefined} />,
}

interface NavProps {
  unreadCount?: number
  variant?: 'desktop' | 'mobile'
}

export default function Navigation({ unreadCount = 0, variant }: NavProps) {
  const pathname = usePathname()
  const navItems = [
    { href: '/feed', label: 'Home', iconKey: 'feed' as const },
    { href: '/connect', label: 'Connect', iconKey: 'connect' as const },
    { href: '/sprint', label: 'Sprint', iconKey: 'sprint' as const },
    { href: '/inbox', label: 'Messages', iconKey: 'inbox' as const, badge: unreadCount },
    { href: '/profile', label: 'Profile', iconKey: 'profile' as const },
  ]

  // Desktop navigation - horizontal in header
  if (variant === 'desktop') {
    return (
      <div className="flex items-center gap-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl transition-smooth relative ${
                isActive
                  ? 'text-[var(--accent-purple)] bg-[var(--accent-purple)]/15 font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] active:scale-95'
              }`}
            >
              <span className="relative">
                {icons[item.iconKey](isActive)}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[var(--error)] rounded-full text-[10px] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
              <span className={`text-sm font-medium ${isActive ? 'text-[var(--accent-purple)]' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    )
  }

  // Mobile: bottom tab bar
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-t border-[var(--separator)] safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="max-w-lg mx-auto flex justify-around items-center h-[64px]">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 py-2.5 px-3 transition-smooth relative min-w-0 ${
                isActive
                  ? 'text-[var(--accent-purple)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] active:scale-95'
              }`}
            >
              <span className="relative">
                {icons[item.iconKey](isActive)}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[var(--error)] rounded-full text-[10px] font-bold text-white border-2 border-[var(--bg)]">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent-purple)]" aria-hidden />
              )}
              <span className={`text-[10px] mt-1.5 font-medium ${isActive ? 'font-semibold text-[var(--accent-purple)]' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
