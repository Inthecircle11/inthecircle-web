'use client'

import React from 'react'

interface State {
  hasError: boolean
  requestId?: string
}

/** Catches render errors in admin UI and shows fallback with Retry. */
export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; requestId?: string },
  State
> {
  constructor(props: { children: React.ReactNode; requestId?: string }) {
    super(props)
    this.state = { hasError: false, requestId: props.requestId }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('AdminErrorBoundary:', error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] p-6" role="alert">
          <div className="max-w-md w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h1 className="text-xl font-semibold text-[var(--text)] mb-2">Something went wrong</h1>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              The admin panel encountered an error. You can try reloading the page.
            </p>
            {this.state.requestId && (
              <p className="text-xs text-[var(--text-muted)] mb-4 font-mono" aria-label="Request ID">
                Request ID: {this.state.requestId}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[var(--accent-purple)] text-white font-medium hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
