#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse .env.prod manually
const envPath = join(__dirname, '..', '.env.prod')
let envContent
try {
  envContent = readFileSync(envPath, 'utf-8')
} catch (e) {
  console.error('Could not read .env.prod. Run: npx vercel env pull .env.prod --environment=production --yes')
  process.exit(1)
}

const env = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed.startsWith('#') || !trimmed.includes('=')) return
  
  const eqIndex = trimmed.indexOf('=')
  const key = trimmed.substring(0, eqIndex)
  let value = trimmed.substring(eqIndex + 1)
  
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  
  env[key] = value
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing')
console.log('Service Key:', supabaseServiceKey ? `Found (${supabaseServiceKey.substring(0, 20)}...)` : 'Missing')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.prod')
  console.error('Available keys:', Object.keys(env))
  console.error('\nFirst few lines of .env.prod:')
  console.error(envContent.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('=== Query 1: Recent analytics_sessions (last 10 minutes) ===')
try {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: recentSessions, error: sessionsError } = await supabase
    .from('analytics_sessions')
    .select('created_at')
    .gte('created_at', tenMinutesAgo)

  if (sessionsError) {
    console.error('Error:', sessionsError.message)
  } else {
    const count = recentSessions?.length || 0
    console.log(`COUNT(*): ${count}`)
    
    if (recentSessions && recentSessions.length > 0) {
      const maxDate = recentSessions.reduce((max, s) => {
        const d = new Date(s.created_at)
        return d > max ? d : max
      }, new Date(0))
      console.log(`MAX(created_at): ${maxDate.toISOString()}`)
    } else {
      console.log('MAX(created_at): NULL (no sessions in last 10 minutes)')
    }
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Query 2: analytics_sessions columns ===')
try {
  const { data: analyticsColumns, error: analyticsColError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'analytics_sessions')
    .order('ordinal_position')

  if (analyticsColError) {
    console.error('Error:', analyticsColError.message)
  } else if (!analyticsColumns || analyticsColumns.length === 0) {
    console.log('No columns found (table may not exist)')
  } else {
    console.log(analyticsColumns.map(c => c.column_name).join('\n'))
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Query 3: profiles columns ===')
try {
  const { data: profilesColumns, error: profilesColError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'profiles')
    .order('ordinal_position')

  if (profilesColError) {
    console.error('Error:', profilesColError.message)
  } else if (!profilesColumns || profilesColumns.length === 0) {
    console.log('No columns found (table may not exist)')
  } else {
    console.log(profilesColumns.map(c => c.column_name).join('\n'))
  }
} catch (e) {
  console.error('Error:', e.message)
}

process.exit(0)
