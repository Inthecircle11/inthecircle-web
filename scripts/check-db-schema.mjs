#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.temp
dotenv.config({ path: join(__dirname, '..', '.env.temp') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('=== Query 1: Recent analytics_sessions ===')
try {
  const { data: sessions, error: sessionsError } = await supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*), MAX(created_at) FROM analytics_sessions WHERE created_at > NOW() - INTERVAL '10 minutes';`
  })
  
  if (sessionsError) {
    // Try direct query if RPC doesn't exist
    const { data: sessionsData, error: directError } = await supabase
      .from('analytics_sessions')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    
    if (directError) {
      console.error('Error:', directError)
    } else {
      console.log(`COUNT: ${sessionsData?.length || 0}`)
      if (sessionsData && sessionsData.length > 0) {
        const maxDate = sessionsData.reduce((max, s) => {
          const d = new Date(s.created_at)
          return d > max ? d : max
        }, new Date(0))
        console.log(`MAX(created_at): ${maxDate.toISOString()}`)
      } else {
        console.log('MAX(created_at): NULL')
      }
    }
  } else {
    console.log(sessions)
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Query 2: analytics_sessions columns ===')
try {
  const { data: columns, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'analytics_sessions')
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(columns?.map(c => c.column_name).join('\n') || 'No columns found')
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== Query 3: profiles columns ===')
try {
  const { data: columns, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'profiles')
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(columns?.map(c => c.column_name).join('\n') || 'No columns found')
  }
} catch (e) {
  console.error('Error:', e.message)
}

process.exit(0)
