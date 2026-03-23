import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Health check endpoint that validates routing config hasn't regressed.
 * Returns 200 if vercel.json is clean (no legacy HTML rewrites).
 * Returns 500 if violation detected (monitoring can alert).
 *
 * Usage: GET /api/health/routing
 */
export async function GET() {
  const vercelPath = path.join(process.cwd(), 'vercel.json')
  if (!fs.existsSync(vercelPath)) {
    return NextResponse.json({ status: 'ok', message: 'No vercel.json' }, { status: 200 })
  }

  try {
    const raw = fs.readFileSync(vercelPath, 'utf8')
    const config = JSON.parse(raw)
    const rewrites = config.rewrites

    if (Array.isArray(rewrites)) {
      const violations: string[] = []
      for (const rule of rewrites) {
        const dest = rule?.destination ?? ''
        if (typeof dest === 'string' && /\.html(\/|$|\?|#)/i.test(dest)) {
          violations.push(`Rewrite to ${JSON.stringify(dest)} shadows Next.js routes`)
        }
      }
      if (violations.length > 0) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'vercel.json contains legacy HTML rewrites',
            violations,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ status: 'ok', message: 'Routing config is clean' }, { status: 200 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { status: 'error', message: 'Could not validate vercel.json', error: message },
      { status: 500 }
    )
  }
}
