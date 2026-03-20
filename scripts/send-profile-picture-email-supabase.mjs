#!/usr/bin/env node

/**
 * Send test email via Supabase Edge Function
 * Usage: node scripts/send-profile-picture-email-supabase.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config()

// Read the HTML template
const htmlTemplate = readFileSync(
  join(__dirname, '../emails/profile-picture-required.html'),
  'utf-8'
)

// Test email configuration
const testEmail = 'ahmedmaidany@gmail.com'
const testFirstName = 'Ahmed'
const subject = 'Inthecircle - Action Required Within 48 Hours'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables')
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('📧 Sending test email via Supabase Edge Function...')
console.log('To:', testEmail)
console.log('Subject:', subject)
console.log('')

async function sendEmail() {
  try {
    // Replace placeholder
    const htmlContent = htmlTemplate.replace(/\{\{first_name\}\}/g, testFirstName)

    const functionUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-email`
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: testEmail,
        subject: subject,
        html: htmlContent,
        from: 'Inthecircle <noreply@inthecircle.co>',
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('❌ Failed to send email:', response.status, data)
      console.log('')
      console.log('Note: If the Edge Function does not exist, you may need to:')
      console.log('1. Use the Resend script instead: node scripts/send-test-profile-picture-email.mjs')
      console.log('2. Or create a Supabase Edge Function for sending emails')
      process.exit(1)
    }

    console.log('✅ Test email sent successfully!')
    console.log('Response:', data)
    console.log('')
    console.log('Check your inbox at:', testEmail)
  } catch (error) {
    console.error('❌ Error sending email:', error.message)
    process.exit(1)
  }
}

sendEmail()
