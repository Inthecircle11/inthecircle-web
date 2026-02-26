/** App Store URL - set NEXT_PUBLIC_APP_STORE_URL in env to override */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ||
  'https://apps.apple.com/app/in-the-circle/id123456789'

/** Canonical site URL for SEO (sitemap, Open Graph, canonical). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.inthecircle.co')
