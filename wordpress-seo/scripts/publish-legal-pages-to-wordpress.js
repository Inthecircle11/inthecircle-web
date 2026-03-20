#!/usr/bin/env node
/**
 * Publish Privacy Policy and Terms of Service pages to WordPress via REST API.
 * Uses same .env as publish-posts-to-wordpress.js (WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD).
 *
 * Run from wordpress-seo folder:
 *   node scripts/publish-legal-pages-to-wordpress.js
 *   --dry-run  to only log what would be sent.
 */

const fs = require('fs');
const path = require('path');

const LEGAL_DIR = path.join(__dirname, '..', 'legal');

const PAGES = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy – InTheCircle',
    file: 'privacy-policy-content.html',
  },
  {
    slug: 'terms',
    title: 'Terms of Service – InTheCircle',
    file: 'terms-content.html',
  },
];

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', 'scripts', '.env.wp'),
    path.join(__dirname, '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, '').trim();
      if (key === 'WP_SITE_URL' && !process.env.WORDPRESS_URL) process.env.WORDPRESS_URL = val;
      else if (key === 'WP_USERNAME' && !process.env.WORDPRESS_USER) process.env.WORDPRESS_USER = val;
      else if (key === 'WP_APP_PASSWORD' && !process.env.WORDPRESS_APP_PASSWORD) process.env.WORDPRESS_APP_PASSWORD = val;
      else if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function main() {
  loadEnv();
  const baseUrl = (process.env.WORDPRESS_URL || '').replace(/\/$/, '');
  const user = process.env.WORDPRESS_USER || 'admin';
  const appPassword = process.env.WORDPRESS_APP_PASSWORD || '';
  const dryRun = process.argv.includes('--dry-run');

  if (!baseUrl || !appPassword) {
    console.error('Missing WordPress credentials. Set in wordpress-seo/.env:');
    console.error('  WORDPRESS_URL=https://inthecircle.co');
    console.error('  WORDPRESS_USER=your_username');
    console.error('  WORDPRESS_APP_PASSWORD=your_application_password');
    console.error('Create an Application Password: WordPress Admin → Users → Your user → Application Passwords.');
    process.exit(1);
  }

  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  for (const page of PAGES) {
    const filePath = path.join(LEGAL_DIR, page.file);
    if (!fs.existsSync(filePath)) {
      console.error(`Skip ${page.slug}: file not found ${page.file}`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();

    if (dryRun) {
      console.log(`[dry-run] Would publish page: ${page.slug} — ${page.title}`);
      continue;
    }

    try {
      const listRes = await fetch(
        `${apiBase}/pages?slug=${encodeURIComponent(page.slug)}&per_page=1`,
        { headers }
      );
      if (!listRes.ok) throw new Error(`List: ${await listRes.text()}`);
      const existingList = await listRes.json();

      const body = {
        title: page.title,
        content: content,
        status: 'publish',
        slug: page.slug,
      };

      if (Array.isArray(existingList) && existingList.length > 0) {
        const id = existingList[0].id;
        const res = await fetch(`${apiBase}/pages/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        console.log(`Updated: ${page.slug} (ID ${id}) — ${baseUrl}/${page.slug}/`);
      } else {
        const res = await fetch(`${apiBase}/pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        console.log(`Created: ${page.slug} (ID ${created.id}) — ${baseUrl}/${page.slug}/`);
      }
    } catch (err) {
      console.error(`Failed ${page.slug}:`, err.message);
    }
  }

  if (!dryRun) console.log('\nDone. Check https://inthecircle.co/privacy-policy/ and https://inthecircle.co/terms/');
}

main();
