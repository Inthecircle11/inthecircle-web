#!/usr/bin/env node

/**
 * Send test email for profile picture requirement
 * Usage: node scripts/send-test-profile-picture-email.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the HTML template
const htmlTemplate = readFileSync(
  join(__dirname, '../emails/profile-picture-required.html'),
  'utf-8'
)

// Replace placeholder with test data
const htmlContent = htmlTemplate.replace(/\{\{first_name\}\}/g, 'Ahmed')

// Test email configuration
const testEmail = 'ahmedmaidany@gmail.com'
const fromEmail = 'noreply@inthecircle.co'
const fromName = 'Inthecircle'
const subject = 'Inthecircle - Action Required Within 48 Hours'

console.log('📧 Preparing to send test email...')
console.log('To:', testEmail)
console.log('Subject:', subject)
console.log('')

// Check for Resend API key
const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!RESEND_API_KEY) {
  console.error('❌ Error: RESEND_API_KEY environment variable not set')
  console.log('')
  console.log('Please set your Resend API key:')
  console.log('export RESEND_API_KEY="re_..."')
  console.log('')
  console.log('Or if you use a different email service, update this script accordingly.')
  process.exit(1)
}

// Send email using Resend API
async function sendEmail() {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [testEmail],
        subject: subject,
        html: htmlContent,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Failed to send email:', data)
      process.exit(1)
    }

    console.log('✅ Test email sent successfully!')
    console.log('Email ID:', data.id)
    console.log('')
    console.log('Check your inbox at:', testEmail)
  } catch (error) {
    console.error('❌ Error sending email:', error.message)
    process.exit(1)
  }
}

sendEmail()
