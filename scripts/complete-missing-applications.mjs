#!/usr/bin/env node
/**
 * Create application rows for profiles that don't have one.
 * Uses same .env.local as other scripts (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Run: node scripts/complete-missing-applications.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const PAGE_SIZE = 1000

async function fetchAllPages(table, selectCols) {
  const out = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(selectCols).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    out.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

async function main() {
  console.log('Loading all profile IDs (paginated)...')
  const profiles = await fetchAllPages('profiles', 'id')
  const profileIds = new Set(profiles.map((p) => String(p.id)))

  console.log('Loading all application user_ids (paginated)...')
  const apps = await fetchAllPages('applications', 'user_id')
  const hasApp = new Set(apps.map((a) => String(a.user_id)))

  const missing = [...profileIds].filter((id) => !hasApp.has(id))
  console.log('Profiles:', profileIds.size, '| With application:', hasApp.size, '| Missing application:', missing.length)

  if (missing.length === 0) {
    console.log('Nothing to do — every profile has an application.')
    return
  }

  const now = new Date().toISOString()
  const BATCH = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH)
    const rows = chunk.map((user_id) => ({
      user_id,
      status: 'PENDING_REVIEW',
      updated_at: now,
    }))
    const { error } = await supabase.from('applications').upsert(rows, {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    })
    if (error) {
      console.error('Upsert error:', error.message)
      errors += chunk.length
    } else {
      inserted += chunk.length
      console.log(`Upserted ${inserted}/${missing.length} applications...`)
    }
  }

  console.log('\nDone. Inserted:', inserted, 'Errors:', errors)
  if (inserted > 0) {
    console.log('Run node scripts/check-applications-count.mjs to verify.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
