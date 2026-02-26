import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** GET - Identity check: returns app name so admin UI can detect wrong deployment. No auth required. */
export async function GET() {
  return NextResponse.json({
    app: 'inthecircle-web',
    hint: 'If you see a different admin UI, run: npm run deploy from inthecircle-web repo',
  })
}
