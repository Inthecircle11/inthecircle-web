'use client'

import { useEffect } from 'react'

/** Logs admin build version to console in development only. */
export function BuildVersionLog({ version }: { version: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Admin build version:', version)
    }
  }, [version])
  return null
}
