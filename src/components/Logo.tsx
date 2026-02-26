'use client'

import Image from 'next/image'

const sizes = {
  xs: { width: 24, height: 24 },
  sm: { width: 32, height: 32 },
  md: { width: 40, height: 40 },
  lg: { width: 56, height: 56 },
  xl: { width: 72, height: 72 },
  '2xl': { width: 88, height: 88 },
  '3xl': { width: 112, height: 112 },
} as const

type Size = keyof typeof sizes

// Official brand logo (glowing ring) – used across app and metadata.
const LOGO_SRC = '/logo.png'

export function Logo({
  size = 'md',
  className = '',
  priority = false,
}: {
  size?: Size
  className?: string
  priority?: boolean
}) {
  const { width, height } = sizes[size]
  return (
    <Image
      src={LOGO_SRC}
      alt="inthecircle"
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized={false}
    />
  )
}
