import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

/** Serve favicon at /favicon.ico so GET /favicon.ico never 404. Tries public/favicon.ico, then public/logo.png; fallback 1x1 PNG. */
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

export async function GET() {
  const root = process.cwd()
  const candidates = [
    path.join(root, 'public', 'favicon.ico'),
    path.join(root, 'public', 'logo.png'),
  ]
  for (const imagePath of candidates) {
    try {
      if (fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath)
        const isIco = imagePath.endsWith('.ico')
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': isIco ? 'image/x-icon' : 'image/png',
            'Cache-Control': 'public, max-age=86400, immutable',
          },
        })
      }
    } catch {
      // try next candidate
    }
  }
  return new NextResponse(FALLBACK_PNG, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
