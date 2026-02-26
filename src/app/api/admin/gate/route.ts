import { NextRequest, NextResponse } from 'next/server'

const GATE_COOKIE = 'admin_gate'
const GATE_MAX_AGE = 60 * 60 * 24 // 24 hours

/** GET: Check if gate is already passed (cookie present) or not required */
export async function GET(req: NextRequest) {
  const gatePassword = process.env.ADMIN_GATE_PASSWORD
  if (!gatePassword || gatePassword.length === 0) {
    return NextResponse.json({ unlocked: true })
  }
  const cookie = req.cookies.get(GATE_COOKIE)?.value
  return NextResponse.json({ unlocked: cookie === '1' })
}

/** POST: Verify gate password and set cookie if correct */
export async function POST(req: NextRequest) {
  const gatePassword = process.env.ADMIN_GATE_PASSWORD
  if (!gatePassword || gatePassword.length === 0) {
    return NextResponse.json({ ok: true })
  }
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
  const submitted = typeof body.password === 'string' ? body.password : ''
  if (submitted !== gatePassword) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GATE_MAX_AGE,
    path: '/',
  })
  return res
}
