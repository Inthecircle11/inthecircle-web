import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  reactCompiler: true,
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/**' }]
        : []),
    ],
  },
  // Prevent admin panel from being cached (always load latest).
  // Apply to both /admin and the obscure path (ADMIN_BASE_PATH) so Cache-Control is sent
  // even when users access admin via the secret URL (next.config headers match original request path).
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
  // Rewrite obscure admin path to /admin at build time (proxy cannot read ADMIN_BASE_PATH at runtime on Vercel).
  async rewrites() {
    const adminBase = process.env.ADMIN_BASE_PATH?.trim()
    if (!adminBase) return []
    const base = adminBase.startsWith('/') ? adminBase.slice(1) : adminBase
    return [
      { source: `/${base}`, destination: '/admin' },
      { source: `/${base}/:path*`, destination: '/admin/:path*' },
    ]
  },
  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },
  // Compression
  compress: true,
  // Optimize production builds
  productionBrowserSourceMaps: false,
  // Faster page loads - reduce bundle size
  poweredByHeader: false,
  // Build fingerprint for admin observability (commit SHA or timestamp).
  env: {
    BUILD_TIMESTAMP: new Date().toISOString(),
    // Expose DSN to client only at build time (SENTRY_DSN set in Vercel env; do not commit).
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  },
};

const sentryOptions = {
  org: "inthecircle",
  project: "inthecircle-web",
  silent: !process.env.CI,
};

export default withSentryConfig(nextConfig, sentryOptions);

