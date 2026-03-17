import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// Only enable in production when DSN is set
if (process.env.NODE_ENV === 'production' && dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations(integrations) {
      return integrations.filter((i) => {
        const n = (i.name ?? '').toLowerCase()
        return !n.includes('feedback') && !n.includes('replay')
      })
    },
    beforeSend(event) {
      // Do not send sensitive data: drop request headers that may contain auth
      if (event.request?.headers) {
        const { headers: _h, ...rest } = event.request
        return { ...event, request: rest }
      }
      return event
    },
  })
}

// Required by @sentry/nextjs for client-side navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
