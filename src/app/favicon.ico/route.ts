import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

/** Serve logo.png at /favicon.ico so browsers get a 200 instead of 404. */
export async function GET() {
  const imagePath = path.join(process.cwd(), 'public', 'logo.png')
  try {
    const buffer = fs.readFileSync(imagePath)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
