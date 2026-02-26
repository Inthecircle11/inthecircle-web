// Send Valentine's email to all approved users
// Run: node send-to-all.js

const SUPABASE_URL = "https://qcdknokprohcsewpbjvj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZGtub2twcm9oY3Nld3BianZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDU1MTYsImV4cCI6MjA4MzI4MTUxNn0.8Ung68ZnDm4Q9TuALrM1kxQMkAEpsL_h1wjcBaBpdQk";
const RESEND_API_KEY = "re_2asmFnvc_3fpqh4BLgsifm5uWwcc1q4G9";

const fs = require('fs');
const path = require('path');

// Read HTML template
const templatePath = path.join(__dirname, 'thank-you-email.html');
const htmlTemplate = fs.readFileSync(templatePath, 'utf8');

async function getApprovedUsers() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?is_approved=eq.true&select=email,full_name`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status} ${await response.text()}`);
  }
  
  const users = await response.json();
  // Filter out users without email
  return users.filter(u => u.email && u.email.trim() !== '');
}

async function sendEmail(to, firstName) {
  const html = htmlTemplate.replace(/\{\{first_name\}\}/g, firstName);
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ahmed Khalifa <hello@inthecircle.co>',
      to: [to],
      subject: 'thinking of you today',
      html: html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send to ${to}: ${error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('Fetching approved users...');
  const users = await getApprovedUsers();
  
  console.log(`Found ${users.length} approved users with emails\n`);
  
  let sent = 0;
  let failed = 0;
  
  for (const user of users) {
    if (!user.email) continue;
    
    const firstName = user.full_name?.split(' ')[0] || 'there';
    
    try {
      await sendEmail(user.email, firstName);
      sent++;
      console.log(`✅ Sent to ${user.email} (${firstName})`);
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
      console.log(`❌ Failed: ${user.email} - ${err.message}`);
    }
  }
  
  console.log(`\n=============================`);
  console.log(`✅ Sent: ${sent}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${users.length}`);
}

main().catch(console.error);
