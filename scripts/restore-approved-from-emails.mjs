#!/usr/bin/env node
/**
 * Set application status to ACTIVE (approved) for profiles matching the given emails.
 * Use this to restore approved status after accidentally overwriting with waitlist import.
 *
 * Usage:
 *   node scripts/restore-approved-from-emails.mjs path/to/emails.txt
 *   (emails.txt = one email per line, optional # comments)
 *
 * Uses .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/restore-approved-from-emails.mjs <emails.txt>')
    console.error('  emails.txt = one email per line (lines starting with # ignored)')
    process.exit(1)
  }
  const content = readFileSync(resolve(process.cwd(), file), 'utf8')
  const emails = content
    .split(/\n/)
    .map((l) => l.replace(/#.*/, '').trim().toLowerCase())
    .filter((e) => e && e.includes('@'))

  console.log('Emails to restore to approved:', emails.length)
  if (emails.length === 0) {
    console.log('No valid emails.')
    return
  }

  const { data: profiles } = await supabase.from('profiles').select('id, email').in('email', emails)
  const byEmail = new Map((profiles || []).map((p) => [String(p.email).toLowerCase(), p.id]))

  let updated = 0
  for (const email of emails) {
    const id = byEmail.get(email)
    if (!id) {
      console.log('  Skip (no profile):', email)
      continue
    }
    const { data: apps } = await supabase.from('applications').select('id, status').eq('user_id', id).limit(1)
    if (!apps?.length) {
      console.log('  Skip (no application):', email)
      continue
    }
    const { error } = await supabase
      .from('applications')
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', apps[0].id)
    if (error) {
      console.log('  Error:', email, error.message)
    } else {
      updated++
      console.log('  Restored:', email)
    }
  }
  console.log('\nDone. Restored to approved:', updated)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
