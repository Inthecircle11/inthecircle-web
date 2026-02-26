import { NextResponse } from 'next/server'

/**
 * Health check for load balancers and monitoring.
 * Returns 200 when the server is running. No auth required.
 */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'
  return NextResponse.json({ status: 'ok', version }, { status: 200 })
}
