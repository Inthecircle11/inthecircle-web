import type { NextConfig } from "next";

// Fail production build on Vercel if ADMIN_BASE_PATH is not set (required for header rules and security).
if (process.env.VERCEL === "1" && !process.env.ADMIN_BASE_PATH?.trim()) {
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
  },
};

export default nextConfig;

