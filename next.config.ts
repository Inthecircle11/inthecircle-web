import type { NextConfig } from "next";
import fs from 'fs'
import path from 'path'

// HARDENING: Fail build if vercel.json contains legacy rewrites to *.html (prevents shadowing Next.js routes).
const vercelPath = path.join(process.cwd(), 'vercel.json')
if (fs.existsSync(vercelPath)) {
  try {
    const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))
    if (Array.isArray(vercel.rewrites)) {
      for (const rule of vercel.rewrites) {
        const dest = rule?.destination ?? ''
        if (typeof dest === 'string' && /\.html(\/|$|\?|#)/i.test(dest)) {
          throw new Error(
            `BUILD FAILED: vercel.json rewrites must not point to *.html (legacy static shell).\n` +
            `  Forbidden: ${JSON.stringify(dest)}\n` +
            `  Next.js App Router owns these routes. Remove static HTML rewrites.\n` +
            `  Run: npm run check:vercel-routing`
          )
        }
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('BUILD FAILED')) throw e
    const message = e instanceof Error ? e.message : String(e)
    // JSON parse error or other - let build continue, but log
    console.warn('next.config: Could not validate vercel.json:', message)
  }
}

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
            { source: `/${base}/:path*`, destination: "/admin/:path*" },
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

