/**
 * Client-side instrumentation.
 * Sentry init disabled here to avoid loading the feedback/instrument bundle that uses
 * deprecated zustand default export. Server/edge Sentry (instrumentation.ts) unchanged.
 * To re-enable client Sentry, uncomment the block below and add back the Sentry import.
 */
// import * as Sentry from '@sentry/nextjs'

// const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
// if (process.env.NODE_ENV === 'production' && dsn) {
//   Sentry.init({ dsn, ... })
// }

export const onRouterTransitionStart = () => {}
