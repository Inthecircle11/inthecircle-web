#!/usr/bin/env node
/**
 * Set Supabase Auth Site URL and Redirect URLs so password reset (and other
 * auth links) send users to the webapp, not /download or the marketing site.
 *
 * Requires:
 *   - SUPABASE_ACCESS_TOKEN — from https://supabase.com/dashboard/account/tokens
 *   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) — e.g. https://YOUR_REF.supabase.co
 *
 * Optional:
 *   - NEXT_PUBLIC_APP_URL — default https://app.inthecircle.co
 *   - PROJECT_REF — overrides ref derived from URL
 *
 * Loads .env.local from project root if present.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=xxx node scripts/set-auth-redirect-urls.mjs
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
const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.inthecircle.co').replace(/\/$/, '')
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

// Redirect URLs required for password reset and auth callbacks. Comma-separated in API.
const REQUIRED_REDIRECT_URLS = [
  `${appOrigin}/auth/callback`,
  `${appOrigin}/update-password`,
  'https://inthecircle-web.vercel.app/auth/callback',
  'http://localhost:3000/auth/callback',
]

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

  // Site URL: must be the webapp so reset emails link to app.inthecircle.co
  if (current.site_url !== appOrigin) {
    toPatch.site_url = appOrigin
    console.log('Setting site_url:', appOrigin)
  }

  // Merge required redirect URLs with existing (uri_allow_list is comma-separated)
  const existingList = (current.uri_allow_list || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const combined = [...new Set([...existingList, ...REQUIRED_REDIRECT_URLS])]
  // Remove /download so auth links don't land there
  const filtered = combined.filter((u) => !u.includes('/download'))
  const newList = filtered.join(',')
  if (newList !== (current.uri_allow_list || '')) {
    toPatch.uri_allow_list = newList
    console.log('Setting uri_allow_list (redirect URLs):', filtered.join(', '))
  }

  if (Object.keys(toPatch).length === 0) {
    console.log('Auth URL config already correct. No change.')
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
    console.log('Updated auth URL config successfully.')
  } catch (e) {
    console.error('Failed to update auth config:', e.message)
    process.exit(1)
  }
}

main()
