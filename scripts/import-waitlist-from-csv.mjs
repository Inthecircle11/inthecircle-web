#!/usr/bin/env node
/**
 * Import contacts from a CSV as app applications with status WAITLISTED.
 *
 * For each row with a valid Email we:
 * 1. Create an auth user (Supabase Admin API) with email_confirm: true
 * 2. Auth trigger creates profile + application (PENDING_REVIEW)
 * 3. Update that application to status WAITLISTED
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Usage: node scripts/import-waitlist-from-csv.mjs <path-to-csv>
 *
 * CSV must have an "Email" column. Optional: "Name", "First Name", "Last Name",
 * "Mobile Phone Number (mobile_phone_number)" or "رقم التليفون مع الكود الدولي (custom_3)" for phone.
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse'
import { createReadStream, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load .env.local from project root so you can put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY there
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Parse args: <path-to-csv> [--batch N] or [--batch N] <path-to-csv>
let csvPath = null
let batchLimit = null
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--batch' || arg === '--limit') {
    batchLimit = parseInt(process.argv[++i], 10)
    if (!Number.isFinite(batchLimit) || batchLimit < 1) batchLimit = null
  } else if (!arg.startsWith('-')) {
    csvPath = arg
  }
}
if (!csvPath) {
  console.error('Usage: node scripts/import-waitlist-from-csv.mjs <path-to-csv> [--batch N]')
  console.error('  --batch N   Process at most N new users per run (re-run to continue). Use to avoid timeouts.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Same values as profile edit page so niche displays correctly
const NICHES = [
  'Lifestyle & Entertainment',
  'Food & Travel',
  'Fitness & Wellness',
  'Tech & Gaming',
  'Music & Art',
  'Business & Finance',
  'Education',
  'Aviation',
]

function randomPassword() {
  return `Wl${Date.now()}${Math.random().toString(36).slice(2, 14)}!`
}

/** 40% Business & Finance, 60% random from the other niches */
function pickNiche() {
  if (Math.random() < 0.4) return 'Business & Finance'
  const others = NICHES.filter((n) => n !== 'Business & Finance')
  return others[Math.floor(Math.random() * others.length)]
}

function slug(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 25) || 'user'
}

function getEmail(row) {
  const e = (row['Email'] ?? row['ِEmail الايميل (custom_5)'] ?? row['الايميل (email)'] ?? '').trim()
  return e && e.includes('@') ? e : null
}

function getName(row) {
  const full = (row['Full name الاسم كامل (custom_4)'] ?? row['Name'] ?? row['الاسم (name)'] ?? '').trim()
  if (full) return full
  const first = (row['First Name'] ?? '').trim()
  const last = (row['Last Name'] ?? '').trim()
  if (first || last) return `${first} ${last}`.trim()
  const email = getEmail(row)
  return email ? email.split('@')[0] : 'User'
}

function getPhone(row) {
  const p =
    row['رقم التليفون مع الكود الدولي (custom_3)'] ??
    row['Mobile Phone Number (mobile_phone_number)'] ??
    row['الاسم (name)'] // (some CSVs put phone in wrong column; skip if it looks like name)
  const s = (p ?? '').trim()
  if (!s || s.length < 8 || /^[a-zA-Z\u0600-\u06FF\s]+$/.test(s)) return null
  return s
}

async function parseCsv(path) {
  const rows = []
  const parser = createReadStream(path, { encoding: 'utf8' }).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true })
  )
  for await (const row of parser) rows.push(row)
  return rows
}

/** Set application to WAITLISTED only if not already ACTIVE or REJECTED (do not overwrite approved). */
async function ensureWaitlisted(userId) {
  const { data: apps } = await supabase
    .from('applications')
    .select('id, status')
    .eq('user_id', userId)
    .limit(1)
  if (apps?.length) {
    const status = (apps[0].status || '').toUpperCase()
    if (status === 'ACTIVE' || status === 'REJECTED') return
    await supabase
      .from('applications')
      .update({ status: 'WAITLISTED', updated_at: new Date().toISOString() })
      .eq('id', apps[0].id)
  }
}

async function loadExistingProfileIdsByEmail() {
  const { data, error } = await supabase.from('profiles').select('id, email')
  if (error) return new Map()
  const map = new Map()
  for (const row of data || []) {
    if (row.email) map.set(row.email.toLowerCase().trim(), row.id)
  }
  return map
}

/** Build map lowercase email -> auth user id by paginating Auth Admin list users */
async function loadAuthUserIdsByEmail() {
  const map = new Map()
  const base = SUPABASE_URL.replace(/\/$/, '')
  let page = 1
  const perPage = 1000
  while (true) {
    const res = await fetch(
      `${base}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    )
    if (!res.ok) break
    const users = await res.json()
    const list = Array.isArray(users) ? users : users?.users ?? []
    for (const u of list) {
      const e = u?.email ?? u?.email_address
      if (e) map.set(String(e).toLowerCase().trim(), u.id)
    }
    if (list.length < perPage) break
    page++
  }
  return map
}

async function main() {
  console.log('Reading CSV:', csvPath)
  const rows = await parseCsv(csvPath)
  console.log('Rows in CSV:', rows.length)

  const byEmail = new Map()
  for (const row of rows) {
    const email = getEmail(row)
    if (!email) continue
    const key = email.toLowerCase()
    if (byEmail.has(key)) continue
    byEmail.set(key, { email, name: getName(row), phone: getPhone(row) })
  }
  console.log('Unique emails to process:', byEmail.size)
  if (batchLimit != null) console.log('Batch limit:', batchLimit, 'new users per run')

  console.log('Loading existing profiles (email -> id)...')
  const existingIds = await loadExistingProfileIdsByEmail()
  console.log('Existing profiles:', existingIds.size)
  console.log('Loading auth users (email -> id) for repair...')
  const authUserIdsByEmail = await loadAuthUserIdsByEmail()
  console.log('Auth users loaded:', authUserIdsByEmail.size)

  let created = 0
  let skipped = 0
  let errors = 0
  const errorEmails = []
  const total = byEmail.size
  let done = 0

  for (const [key, { email, name, phone }] of byEmail) {
    if (batchLimit != null && created >= batchLimit) break
    try {
      const existingId = existingIds.get(key)
      if (existingId) {
        await ensureWaitlisted(existingId)
        if (phone) {
          await supabase.from('profiles').update({ phone, updated_at: new Date().toISOString() }).eq('id', existingId)
        }
        skipped++
        done++
        console.log(`s (existing) ${email}  — ${total - done} left`)
        continue
      }

      console.log(`Creating user for ${email}...`)
      const baseUsername = slug(name) || slug(email)
      const timeoutMs = 15000
      const ac = new AbortController()
      const timeoutId = setTimeout(() => ac.abort(), timeoutMs)
      let userData, createError
      try {
        const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            email,
            password: randomPassword(),
            email_confirm: true,
            user_metadata: {
              name: name || email.split('@')[0],
              username: baseUsername,
              source: 'waitlist_import',
            },
          }),
          signal: ac.signal,
        })
        clearTimeout(timeoutId)
        const body = await res.json()
        if (!res.ok) {
          createError = new Error(body?.msg ?? body?.error_description ?? body?.message ?? res.statusText)
        } else {
          userData = { user: body?.user ?? body }
        }
      } catch (err) {
        clearTimeout(timeoutId)
        if (err?.name === 'AbortError') createError = new Error(`timeout after ${timeoutMs}ms`)
        else createError = err
      }
      if (createError) console.log(`  → createUser result: ${createError.message || createError}`)

      if (createError) {
        if (
          createError.message?.includes('already been registered') ||
          createError.message?.includes('already exists') ||
          createError.message?.toLowerCase().includes('duplicate')
        ) {
          let prof = (await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle()).data
          if (!prof?.id) {
            const { data: profCi } = await supabase
              .from('profiles')
              .select('id')
              .ilike('email', email)
              .limit(1)
              .maybeSingle()
            prof = profCi
          }
          if (prof?.id) {
            await ensureWaitlisted(prof.id)
            skipped++
            done++
            console.log(`s (dup) ${email}  — ${total - done} left`)
          } else {
            const authUserId = authUserIdsByEmail.get(key)
            if (authUserId) {
              const baseUsername = slug(name) || slug(email)
              const now = new Date().toISOString()
              const { error: pe } = await supabase.from('profiles').insert({
                id: authUserId,
                email,
                name: name || email.split('@')[0],
                username: baseUsername,
                niche: pickNiche(),
                created_at: now,
                updated_at: now,
                is_verified: false,
                ...(phone && { phone }),
              })
              if (!pe) {
                const { error: ae } = await supabase.from('applications').insert({
                  user_id: authUserId,
                  status: 'WAITLISTED',
                  updated_at: new Date().toISOString(),
                })
                if (!ae) await ensureWaitlisted(authUserId)
              }
              skipped++
              done++
              console.log(`s (dup, repaired) ${email}  — ${total - done} left`)
            } else {
              skipped++
              done++
              console.log(`s (dup, no profile) ${email}  — ${total - done} left`)
            }
          }
          continue
        }
        throw createError
      }

      const userId = userData?.user?.id
      if (!userId) throw new Error('No user id returned')

      await ensureWaitlisted(userId)
      const profileUpdates = {
        updated_at: new Date().toISOString(),
        niche: pickNiche(),
      }
      if (phone) profileUpdates.phone = phone
      await supabase.from('profiles').update(profileUpdates).eq('id', userId)
      created++
      done++
      console.log(`+ ${email}  — ${total - done} left`)
    } catch (err) {
      errors++
      done++
      errorEmails.push({ email, message: err?.message || String(err) })
      console.error(`Error for ${email}:`, err?.message || err)
    }

    await new Promise((r) => setTimeout(r, 80))
  }

  console.log('\nDone. Created:', created, 'Skipped (existing/dup):', skipped, 'Errors:', errors)
  if (errorEmails.length > 0) {
    console.log('\nFailed emails (fix CSV or re-run after fixing):')
    errorEmails.forEach(({ email, message }) => console.log(`  ${email}  → ${message}`))
  }
  if (batchLimit != null && total - done > 0) {
    console.log('\nRemaining in CSV:', total - done, '— run the same command again to process more.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
