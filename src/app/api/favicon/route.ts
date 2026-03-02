import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Serve favicon via API so it always returns 200 (avoids static/cache 404).
 * Layout metadata can use this or /favicon.ico; browser often requests both.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'favicon.ico')
  const fallback = path.join(process.cwd(), 'public', 'logo.png')
  try {
    const buf = fs.existsSync(filePath)
      ? fs.readFileSync(filePath)
      : fs.readFileSync(fallback)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
