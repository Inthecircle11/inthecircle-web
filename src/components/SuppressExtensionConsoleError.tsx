'use client'

import { useEffect } from 'react'

/**
 * Suppress the "WebSocket connection to 'ws://localhost:8081/' failed" console error.
 * That error comes from a browser extension (e.g. Live Reload), not from our app.
 * Patching console.error so the console stays clean for users.
 */
export function SuppressExtensionConsoleError() {
  useEffect(() => {
    const orig = console.error
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '')
      if (msg.includes('WebSocket') && msg.includes('localhost:8081')) return
      orig.apply(console, args)
    }
    return () => {
      console.error = orig
    }
  }, [])
  return null
}
