/** App Store URL - set NEXT_PUBLIC_APP_STORE_URL in env to override (ignore old placeholder) */
const APP_STORE_DEFAULT = 'https://apps.apple.com/us/app/inthecircle-creator-network/id6758384054'
export const APP_STORE_URL =
  (process.env.NEXT_PUBLIC_APP_STORE_URL && !process.env.NEXT_PUBLIC_APP_STORE_URL.includes('id123456789'))
    ? process.env.NEXT_PUBLIC_APP_STORE_URL
    : APP_STORE_DEFAULT

/** Play Store URL - set NEXT_PUBLIC_PLAY_STORE_URL in env to override */
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.inthecircle.app'

/** Deep link to open the native app (e.g. after password reset). App can handle path to show appropriate screen. */
export const APP_DEEP_LINK_SCHEME = 'inthecircle'
export const APP_DEEP_LINK_PASSWORD_RESET = `${APP_DEEP_LINK_SCHEME}://auth/password-reset`

/** Canonical site URL for SEO (sitemap, Open Graph, canonical). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.inthecircle.co')
