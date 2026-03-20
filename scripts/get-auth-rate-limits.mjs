#!/usr/bin/env node
/**
 * Fetch and print current Supabase Auth rate limits for the project.
 *
 * Requires:
 *   - SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens
 *   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or PROJECT_REF
 *
 * Loads .env.local from project root if present.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=xxx node scripts/get-auth-rate-limits.mjs
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
  console.error('Missing PROJECT_REF. Set NEXT_PUBLIC_SUPABASE_URL or PROJECT_REF')
  process.exit(1)
}

const AUTH_CONFIG_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`

const RATE_LIMIT_KEYS = [
  'rate_limit_anonymous_users',
  'rate_limit_email_sent',
  'rate_limit_sms_sent',
  'rate_limit_verify',
  'rate_limit_token_refresh',
  'rate_limit_otp',
  'rate_limit_web3',
]

async function main() {
  try {
    const res = await fetch(AUTH_CONFIG_URL, {
      headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
    })
    if (!res.ok) {
      console.error('GET config failed:', res.status, await res.text())
      process.exit(1)
    }
    const config = await res.json()
    console.log('Project ref:', PROJECT_REF)
    console.log('Current auth rate limits:')
    for (const key of RATE_LIMIT_KEYS) {
      const value = config[key]
      console.log(' ', key + ':', value === undefined ? '(not set / default)' : value)
    }
    const others = Object.keys(config).filter(k => k.startsWith('rate_limit') && !RATE_LIMIT_KEYS.includes(k))
    if (others.length) {
      console.log('Other rate_limit_* in config:')
      for (const k of others) console.log(' ', k + ':', config[k])
    }
  } catch (e) {
    console.error('Failed to fetch auth config:', e.message)
    process.exit(1)
  }
}

main()
