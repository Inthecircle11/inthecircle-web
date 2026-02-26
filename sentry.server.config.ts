import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

// Only enable in production when DSN is set
if (process.env.NODE_ENV === 'production' && dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const { headers: _h, ...rest } = event.request
        return { ...event, request: rest }
      }
      return event
    },
  })
}
