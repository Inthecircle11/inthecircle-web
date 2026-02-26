'use client'

import Image from 'next/image'

interface OptimizedAvatarProps {
  src: string | null | undefined
  alt: string
  size: number
  className?: string
  priority?: boolean
}

/** Uses next/image for Supabase URLs, fallback to img for external */
export function OptimizedAvatar({ src, alt, size, className = '', priority }: OptimizedAvatarProps) {
  const url = src?.trim()
  const isSupabase = url?.includes('supabase.co') || url?.includes('supabase.in')

  if (!url) return null

  if (isSupabase) {
    return (
      <Image
        src={url}
        alt={alt}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={`rounded-full object-cover ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        unoptimized={false}
      />
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}
