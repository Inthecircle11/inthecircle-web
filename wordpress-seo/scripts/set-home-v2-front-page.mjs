#!/usr/bin/env node
/**
 * Create "Home v2" page with template ITC Home v2 and set it as the static front page.
 * Uses WordPress REST API (same credentials as publish-posts-to-wordpress.js).
 *
 * Steps:
 * 1. Create page "Home v2" with template page-itc-landing.php
 * 2. Set show_on_front=page, page_on_front=<id> via /wp/v2/settings
 * 3. Confirm and verify homepage URL
 *
 * Run: node scripts/set-home-v2-front-page.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPaths = [
    path.join(ROOT, '.env'),
    path.join(ROOT, '..', 'scripts', '.env.wp'),
    path.join(ROOT, '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
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

  if (!baseUrl || !appPassword) {
    console.error('Set WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD (e.g. wordpress-seo/.env or Inthecircle/scripts/.env.wp)');
    process.exit(1);
  }

  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  // Step 1: Create or get page "Home v2" with template page-itc-landing.php
  console.log('Step 1: Create page "Home v2" with template ITC Home v2...');
  let pageId;
  const listRes = await fetch(`${apiBase}/pages?slug=home-v2&per_page=1`, { headers });
  if (!listRes.ok) throw new Error(`List pages: ${listRes.status} ${await listRes.text()}`);
  const existing = await listRes.json();

  if (Array.isArray(existing) && existing.length > 0) {
    pageId = existing[0].id;
    const patchRes = await fetch(`${apiBase}/pages/${pageId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title: 'Home v2',
        status: 'publish',
        meta: { _wp_page_template: 'page-itc-landing.php' },
      }),
    });
    if (!patchRes.ok) {
      console.warn('Patch template failed:', patchRes.status, await patchRes.text());
    } else {
      console.log('Updated existing page "Home v2" (ID ' + pageId + '), template set.');
    }
  } else {
    const createRes = await fetch(`${apiBase}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Home v2',
        status: 'publish',
        slug: 'home-v2',
        content: '<!-- Template: ITC Home v2 -->',
        meta: { _wp_page_template: 'page-itc-landing.php' },
      }),
    });
    if (!createRes.ok) throw new Error(`Create page: ${createRes.status} ${await createRes.text()}`);
    const created = await createRes.json();
    pageId = created.id;
    console.log('Created page "Home v2" (ID ' + pageId + ') with template page-itc-landing.php');
  }

  // Step 2: Set static front page
  console.log('\nStep 2: Set as static front page...');
  const settingsRes = await fetch(`${apiBase}/settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      show_on_front: 'page',
      page_on_front: pageId,
    }),
  });
  if (!settingsRes.ok) {
    throw new Error(`Update settings: ${settingsRes.status} ${await settingsRes.text()}`);
  }
  console.log('Updated show_on_front=page, page_on_front=' + pageId);

  // Step 3: Confirm
  console.log('\nStep 3: Confirm...');
  const getRes = await fetch(`${apiBase}/settings`, { headers });
  if (!getRes.ok) throw new Error(`Get settings: ${getRes.status}`);
  const settings = await getRes.json();
  console.log('show_on_front:', settings.show_on_front);
  console.log('page_on_front:', settings.page_on_front);

  const homeUrl = baseUrl + '/';
  console.log('\nHomepage URL:', homeUrl);
  const homeRes = await fetch(homeUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log('Homepage fetch: ' + homeRes.status + ' ' + homeRes.url);
  if (homeRes.ok) {
    const text = await homeRes.text();
    if (text.includes('itc-page') || text.includes('InTheCircle')) {
      console.log('Verified: homepage content appears to be the new landing (itc-page/InTheCircle found).');
    } else {
      console.log('Homepage is live. Visit ' + homeUrl + ' to verify.');
    }
  }

  console.log('\nDone. Visit ' + homeUrl + ' to verify the new front page.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
