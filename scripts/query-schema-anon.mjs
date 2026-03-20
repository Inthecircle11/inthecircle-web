#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = join(__dirname, '..', '.env.prod')
const envContent = readFileSync(envPath, 'utf-8')

const env = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed.startsWith('#') || !trimmed.includes('=')) return
  
  const eqIndex = trimmed.indexOf('=')
  const key = trimmed.substring(0, eqIndex)
  let value = trimmed.substring(eqIndex + 1)
  
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  
  env[key] = value
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('Using anon key to query information_schema (public metadata)...\n')

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('=== Query 1: analytics_sessions columns ===')
try {
  const { data: analyticsColumns, error: analyticsColError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'analytics_sessions')
    .order('ordinal_position')

  if (analyticsColError) {
    console.error('Error:', analyticsColError.message)
  } else if (!analyticsColumns || analyticsColumns.length === 0) {
    console.log('No columns found (table may not exist or not accessible)')
  } else {
    console.log(analyticsColumns.map(c => c.column_name).join('\n'))
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Query 2: profiles columns ===')
try {
  const { data: profilesColumns, error: profilesColError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'profiles')
    .order('ordinal_position')

  if (profilesColError) {
    console.error('Error:', profilesColError.message)
  } else if (!profilesColumns || profilesColumns.length === 0) {
    console.log('No columns found (table may not exist or not accessible)')
  } else {
    console.log(profilesColumns.map(c => c.column_name).join('\n'))
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Note: Cannot query analytics_sessions data with anon key ===')
console.log('The analytics_sessions table requires service role access.')
console.log('Please run this query in Supabase SQL Editor:')
console.log('SELECT COUNT(*), MAX(created_at) FROM analytics_sessions WHERE created_at > NOW() - INTERVAL \'10 minutes\';')

process.exit(0)
