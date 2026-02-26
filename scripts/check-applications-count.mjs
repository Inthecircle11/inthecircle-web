#!/usr/bin/env node
/**
 * Quick CLI: count applications by status (uses same .env.local as import script).
 * Run: node scripts/check-applications-count.mjs
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_*) in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const PAGE_SIZE = 1000

async function fetchAllApplications() {
  const out = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('applications').select('status').range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    out.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

async function main() {
  // 1) Direct applications table counts (paginated so we get all rows)
  const appRows = await fetchAllApplications()
  const counts = {}
  for (const row of appRows) {
    const s = (row.status || '').toUpperCase()
    counts[s] = (counts[s] || 0) + 1
  }
  console.log('Applications by status (direct table query):')
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([status, n]) => console.log(`  ${status}: ${n}`))
  console.log('  Total applications:', appRows.length)

  // 2) Dashboard stats (RPC) - same source as Admin UI
  try {
    const { data: statsData } = await supabase.rpc('admin_get_application_stats')
    if (statsData?.[0]) {
      const s = statsData[0]
      console.log('\nDashboard stats (admin_get_application_stats RPC — what Admin UI shows):')
      console.log('  Pending:  ', s.pending ?? '—')
      console.log('  Approved: ', s.approved ?? '—')
      console.log('  Rejected: ', s.rejected ?? '—')
      console.log('  Waitlisted:', s.waitlisted ?? '—')
      console.log('  Suspended: ', s.suspended ?? '—')
      console.log('  Total:    ', s.total ?? '—')
    }
  } catch (e) {
    console.log('\nDashboard RPC admin_get_application_stats not available:', e?.message || e)
  }

  // 3) Profiles vs applications (explain discrepancy if any)
  const { count: profileCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
  const totalApps = appRows.length
  const noApp = Math.max(0, (profileCount || 0) - totalApps)
  console.log('\nProfiles: total', profileCount || 0)
  if (noApp > 0) console.log('  (Profiles without an application row:', noApp, '— dashboard may count these as pending)')
}

main()
