#!/usr/bin/env node
/**
 * Send a test approval/welcome email to the given address.
 * Uses the send-welcome-email Edge Function with test_email (no DB writes).
 *
 * Usage: node scripts/send-approval-email-test.mjs <email>
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

loadEnvLocal()

const email = process.argv[2]?.trim()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/send-approval-email-test.mjs <email>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/send-welcome-email`

const res = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({ test_email: email }),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Error:', res.status, data)
  process.exit(1)
}
if (data.ok && data.sent) {
  console.log('Test welcome email sent to', email, data.emailId ? `(id: ${data.emailId})` : '')
} else {
  console.error('Unexpected response:', data)
  process.exit(1)
}
