#!/usr/bin/env node
/**
 * Create the "Blog" page and optionally ensure it exists. Uses same credentials as publish script.
 * Run from wordpress-seo: node scripts/create-blog-page.js
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', 'scripts', '.env.wp'),
    path.join(__dirname, '..', '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      if (key === 'WP_SITE_URL' && !process.env.WORDPRESS_URL) process.env.WORDPRESS_URL = val;
      else if (key === 'WP_USERNAME' && !process.env.WORDPRESS_USER) process.env.WORDPRESS_USER = val;
      else if (key === 'WP_APP_PASSWORD' && !process.env.WORDPRESS_APP_PASSWORD) process.env.WORDPRESS_APP_PASSWORD = val;
    }
  }
}

async function main() {
  loadEnv();
  const baseUrl = (process.env.WORDPRESS_URL || '').replace(/\/$/, '');
  const user = process.env.WORDPRESS_USER || 'admin';
  const appPassword = process.env.WORDPRESS_APP_PASSWORD || '';
  if (!baseUrl || !appPassword) {
    console.error('Set WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD (or use scripts/.env.wp).');
    process.exit(1);
  }
  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  const existing = await fetch(`${apiBase}/pages?slug=blog`, { headers });
  const list = await existing.json();
  if (Array.isArray(list) && list.length > 0) {
    console.log('Blog page already exists:', baseUrl + '/blog/');
    return;
  }
  const res = await fetch(`${apiBase}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Blog',
      slug: 'blog',
      status: 'publish',
      content: '<p>Latest updates and articles from inthecircle.</p>',
    }),
  });
  if (!res.ok) {
    console.error('Failed to create Blog page:', res.status, await res.text());
    process.exit(1);
  }
  const page = await res.json();
  const url = page.link && page.link.startsWith('http') ? page.link : baseUrl + '/blog/';
  console.log('Created Blog page:', url);
}

main();
