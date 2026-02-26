'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-[var(--bg)] text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-6 max-w-sm">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-semibold bg-[var(--accent)] text-white hover:opacity-95 transition-opacity"
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
