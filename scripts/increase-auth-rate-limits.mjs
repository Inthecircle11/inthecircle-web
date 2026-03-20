#!/usr/bin/env node
/**
 * Increase Supabase Auth rate limits for the project (e.g. to reduce
 * "Multiple failed attempts" / rate limit errors on admin sign-in).
 *
 * Requires:
 *   - SUPABASE_ACCESS_TOKEN — from https://supabase.com/dashboard/account/tokens
 *   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) — e.g. https://YOUR_REF.supabase.co
 *
 * Optional:
 *   - PROJECT_REF — overrides ref derived from URL (get project ref via Supabase MCP: list_projects / get_project)
 *
 * Loads .env.local from project root if present.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=xxx node scripts/increase-auth-rate-limits.mjs
 *   # Or with explicit ref (e.g. from Supabase MCP get_project):
 *   SUPABASE_ACCESS_TOKEN=xxx PROJECT_REF=qcdknokprohcsewpbjvj node scripts/increase-auth-rate-limits.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const path = resolve(root, '.env.local')
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

loadEnvLocal()

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
let PROJECT_REF = process.env.PROJECT_REF

if (!PROJECT_REF && url) {
  try {
    const u = new URL(url)
    const host = u.hostname || ''
    if (host.endsWith('.supabase.co')) PROJECT_REF = host.slice(0, -'.supabase.co'.length)
  } catch (_) {}
}

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Get it from https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}
if (!PROJECT_REF) {
  console.error('Missing PROJECT_REF. Set NEXT_PUBLIC_SUPABASE_URL (e.g. https://YOUR_REF.supabase.co) or PROJECT_REF')
  process.exit(1)
}

const AUTH_CONFIG_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`

// Higher limits to reduce "Multiple failed attempts" / rate limit errors (defaults are often 30 or lower)
const HIGHER_LIMITS = {
  rate_limit_anonymous_users: 60,
  rate_limit_email_sent: 60,
  rate_limit_sms_sent: 60,
  rate_limit_verify: 60,
  rate_limit_token_refresh: 60,
  rate_limit_otp: 60,
  rate_limit_web3: 60,
}

async function main() {
  let current = {}
  try {
    const getRes = await fetch(AUTH_CONFIG_URL, {
      headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
    })
    if (!getRes.ok) {
      console.error('GET config failed:', getRes.status, await getRes.text())
      process.exit(1)
    }
    current = await getRes.json()
  } catch (e) {
    console.error('Failed to fetch auth config:', e.message)
    process.exit(1)
  }

  const toPatch = {}
  for (const [key, value] of Object.entries(HIGHER_LIMITS)) {
    const existing = current[key]
    if (existing !== value) toPatch[key] = value
  }
  if (Object.keys(toPatch).length === 0) {
    console.log('Auth rate limits already at or above target. No change.')
    return
  }

  try {
    const patchRes = await fetch(AUTH_CONFIG_URL, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toPatch),
    })
    if (!patchRes.ok) {
      console.error('PATCH config failed:', patchRes.status, await patchRes.text())
      process.exit(1)
    }
    console.log('Updated auth rate limits:', Object.keys(toPatch).join(', '))
    console.log('New values:', toPatch)
  } catch (e) {
    console.error('Failed to update auth config:', e.message)
    process.exit(1)
  }
}

main()
