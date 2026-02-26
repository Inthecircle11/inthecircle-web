#!/usr/bin/env node
/**
 * Restore application status from admin_audit_log: set ACTIVE for applications
 * that were approved, WAITLISTED for those that were waitlisted (by last action).
 * Use after waitlist import accidentally overwrote approved/waitlisted status.
 *
 * Run: node scripts/restore-approved-waitlisted-from-audit.mjs
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
  console.log('Loading audit log (approve + waitlist, single and bulk)...')
  const { data: entries, error: auditError } = await supabase
    .from('admin_audit_log')
    .select('action, target_type, target_id, created_at, details')
    .in('action', ['application_approve', 'application_waitlist', 'bulk_approve', 'bulk_waitlist'])
    .eq('target_type', 'application')
    .order('created_at', { ascending: false })

  if (auditError) {
    console.error('Audit log error:', auditError.message)
    process.exit(1)
  }

  // Build list of (application_id, action, created_at); then keep latest per app
  const events = []
  for (const e of entries || []) {
    const at = e.created_at
    if (e.action === 'application_approve' || e.action === 'application_waitlist') {
      const id = e.target_id?.trim()
      if (id) events.push({ id, action: e.action, at })
    } else if (e.action === 'bulk_approve' || e.action === 'bulk_waitlist') {
      const ids = e.details?.ids
      if (Array.isArray(ids)) for (const id of ids) events.push({ id: String(id).trim(), action: e.action === 'bulk_approve' ? 'application_approve' : 'application_waitlist', at })
    }
  }
  // Latest event per app (events are already desc by created_at)
  const latestByApp = new Map()
  for (const { id, action } of events) {
    if (!id || latestByApp.has(id)) continue
    latestByApp.set(id, action)
  }

  const toApprove = [...latestByApp.entries()].filter(([, action]) => action === 'application_approve')
  const toWaitlist = [...latestByApp.entries()].filter(([, action]) => action === 'application_waitlist')

  console.log('From audit: to restore as APPROVED (ACTIVE):', toApprove.length)
  console.log('From audit: to restore as WAITLISTED:', toWaitlist.length)

  const now = new Date().toISOString()
  let approved = 0
  let waitlisted = 0

  for (const [appId] of toApprove) {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'ACTIVE', updated_at: now })
      .eq('id', appId)
    if (!error) approved++
  }

  for (const [appId] of toWaitlist) {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'WAITLISTED', updated_at: now })
      .eq('id', appId)
    if (!error) waitlisted++
  }

  console.log('\nDone. Restored to ACTIVE (approved):', approved)
  console.log('Restored to WAITLISTED:', waitlisted)
  console.log('Run node scripts/check-applications-count.mjs to verify.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
