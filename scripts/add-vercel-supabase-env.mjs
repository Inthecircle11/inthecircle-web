#!/usr/bin/env node
/**
 * Add Supabase env vars to Vercel project inthecircle-web-v2.
 * Uses VERCEL_TOKEN (or vercel login auth) and reads values from .env.local or process.env.
 * Usage: node scripts/add-vercel-supabase-env.mjs
 *        Or: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-vercel-supabase-env.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const TEAM_ID = 'team_pPf6WSH38ILGLhFASbKqYYgL'
const PROJECT_ID = 'inthecircle-web-v2'

function getToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  try {
    const dir = process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library', 'Application Support', 'com.vercel.cli')
      : path.join(process.env.HOME || '', '.local', 'share', 'com.vercel.cli')
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'))
    if (j.token) return j.token
  } catch (_) {}
  return null
}

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return {}
  const raw = fs.readFileSync(p, 'utf8')
  const out = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

async function main() {
  const token = getToken()
  if (!token) {
    console.error('Error: Set VERCEL_TOKEN or run `vercel login` first.')
    process.exit(1)
  }

  const envLocal = loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY

  if (!url?.trim() || !anonKey?.trim()) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.')
    console.error('Set them in .env.local or pass in env when running this script.')
    process.exit(1)
  }

  const vars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: url.trim(), type: 'plain', target: ['production', 'preview'] },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: anonKey.trim(), type: 'plain', target: ['production', 'preview'] },
  ]
  if (serviceKey?.trim()) {
    vars.push({ key: 'SUPABASE_SERVICE_ROLE_KEY', value: serviceKey.trim(), type: 'sensitive', target: ['production', 'preview'] })
  }

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vars),
    }
  )

  const text = await res.text()
  if (!res.ok) {
    console.error('Vercel API error:', res.status, text)
    process.exit(1)
  }

  console.log('Added/updated Supabase env vars on inthecircle-web-v2 (Production + Preview).')
  console.log('Redeploy the project (or push to main) so the new vars take effect.')
}

main()
