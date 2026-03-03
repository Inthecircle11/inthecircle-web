import { NextRequest } from 'next/server'
import { adminSuccess, adminError, getAdminRequestId } from '@/lib/admin-response'
import { withAdminRateLimit } from '@/lib/admin-rate-limit'
import * as crypto from 'crypto'

const GATE_COOKIE = 'admin_gate'
const GATE_MAX_AGE = 60 * 60 * 24 // 24 hours
const GATE_RATE_LIMIT_ATTEMPTS = 5
const GATE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

/** Constant-time comparison. Hash both inputs and compare digests. */
function timingSafeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest()
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest()
  if (hashA.length !== hashB.length) return false
  return crypto.timingSafeEqual(hashA, hashB)
}

/** GET: Check if gate is already passed (cookie present) or not required */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const gatePassword = process.env.ADMIN_GATE_PASSWORD
  if (!gatePassword || gatePassword.length === 0) {
    return adminSuccess({ unlocked: true }, requestId)
  }
  const cookie = req.cookies.get(GATE_COOKIE)?.value
  return adminSuccess({ unlocked: cookie === '1' }, requestId)
}

/** POST: Verify gate password and set cookie if correct. Rate-limited, constant-time compare. */
export async function POST(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const gatePassword = process.env.ADMIN_GATE_PASSWORD
  if (!gatePassword || gatePassword.length === 0) {
    return adminSuccess({ ok: true }, requestId)
  }

  return withAdminRateLimit(
    req,
    'gate',
    GATE_RATE_LIMIT_ATTEMPTS,
    GATE_RATE_LIMIT_WINDOW_MS,
    async () => {
      let body: { password?: string }
      try {
        body = await req.json()
      } catch {
        return adminError('Invalid request', 400, requestId)
      }
      const submitted = typeof body.password === 'string' ? body.password : ''
      if (!timingSafeEqual(submitted, gatePassword)) {
        return adminError('Incorrect password', 401, requestId)
      }

      const basePath = process.env.ADMIN_BASE_PATH?.trim()
      const cookiePath = basePath ? `/${basePath}` : '/admin'

      const res = adminSuccess({ ok: true }, requestId)
      res.cookies.set(GATE_COOKIE, '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: GATE_MAX_AGE,
        path: cookiePath,
      })
      return res
    }
  )
}
