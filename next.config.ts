import type { NextConfig } from "next";

// Fail production build on Vercel if ADMIN_BASE_PATH is not set (required for header rules and security).
// Only enforce for Production env; Preview builds may not have the var.
if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  !process.env.ADMIN_BASE_PATH?.trim()
) {
  throw new Error(
    "Build failed: ADMIN_BASE_PATH must be set for production. Set it in Vercel → Project → Settings → Environment Variables (Production)."
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
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
            { source: `/${base}/:path*`, destination: '/admin/:path*' },
          ]
        : []
    return [
      // Serve logo as favicon so GET /favicon.ico does not 404
      { source: '/favicon.ico', destination: '/logo.png' },
      ...adminRewrites,
    ]
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

