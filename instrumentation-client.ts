import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// Only enable in production when DSN is set.
// defaultIntegrations: false + explicit integrations to avoid loading Feedback/Replay (they pull in deprecated zustand).
if (process.env.NODE_ENV === 'production' && dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.browserApiErrorsIntegration(),
      Sentry.globalHandlersIntegration(),
      Sentry.httpContextIntegration(),
    ],
    beforeSend(event) {
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
