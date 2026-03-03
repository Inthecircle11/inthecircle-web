import type { NextConfig } from "next";

// Warn (do not fail) if ADMIN_BASE_PATH is not set in production; build can succeed and /admin remains available.
if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  !process.env.ADMIN_BASE_PATH?.trim()
) {
  console.warn(
    "ADMIN_BASE_PATH is not set for production. Set it in Vercel → Project → Settings → Environment Variables (Production) to use an obscure admin URL."
  )
}

// Production must use `next build` + `next start`. Do not run `next dev` in production;
// dev client (Fast Refresh / HMR) would try to connect to ws://localhost:8081 and cause console errors.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Suppress known Sentry/OpenTelemetry require-in-the-middle warning (safe to ignore).
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /require-in-the-middle/ },
      { module: /@opentelemetry\/instrumentation/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ]
    return config
  },
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/**' }]
        : []),
    ],
  },
  // Prevent admin panel from being cached (always load latest).
  async headers() {
    const adminBase = process.env.ADMIN_BASE_PATH?.trim()
    const rules: { source: string; headers: { key: string; value: string }[] }[] = [
      {
        source: '/admin',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
      },
    ]
    if (adminBase) {
      const base = adminBase.startsWith('/') ? adminBase.slice(1) : adminBase
      rules.push(
        { source: `/${base}`, headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }] },
        { source: `/${base}/:path*`, headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }] }
      )
    }
    return rules
  },
  // Rewrite obscure admin path to /admin at build time.
  async rewrites() {
    const adminBase = process.env.ADMIN_BASE_PATH?.trim()
    const base = adminBase?.startsWith('/') ? adminBase.slice(1) : adminBase ?? ''
    const adminRewrites =
      base && base.length > 0
        ? [
            { source: `/${base}`, destination: '/admin' },
            { source: `/${base}/:path*`, destination: `/admin/:path*` },
          ]
        : []
    // Favicon: serve from public/favicon.ico (no rewrite). Ensures GET /favicon.ico returns 200.
    return [...adminRewrites]
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  env: {
    BUILD_TIMESTAMP: new Date().toISOString(),
  },
};

export default nextConfig;

