#!/usr/bin/env node
/**
 * Replace انثيسيركل with ان ذا سيركل (correct app name in Arabic) across all Arabic posts.
 * Run: node scripts/fix-app-name-arabic.js
 */

const fs = require('fs');
const path = require('path');
const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');

function loadEnv() {
  const c = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  c.split('\n').forEach((line) => {
    const m = line.match(/^\s*WP_(SITE_URL|USERNAME|APP_PASSWORD)\s*=\s*["']?([^"'\n]*)["']?/);
    if (m) {
      if (m[1] === 'SITE_URL') env.url = m[2].trim().replace(/\/$/, '');
      else if (m[1] === 'USERNAME') env.user = m[2].trim();
      else if (m[1] === 'APP_PASSWORD') m[2] ? (env.appPassword = m[2].trim().replace(/\s/g, '')) : null;
    }
  });
  return env;
}

const env = loadEnv();
const base = env.url;
const auth = 'Basic ' + Buffer.from(env.user + ':' + env.appPassword).toString('base64');
const headers = { Authorization: auth, 'Content-Type': 'application/json' };

async function main() {
  const posts = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&status=publish&context=edit`, { headers }).then(r => r.json());
  let ok = 0;
  for (const p of posts) {
    const raw = p.content?.raw || '';
    if (!raw.includes('ثيسيركل')) continue;
    const fixed = raw.replace(/إنثيسيركل|انثيسيركل/g, 'ان ذا سيركل');
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${p.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: fixed }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      console.log(`✓ ${p.id}`);
      ok++;
    }
  }
  console.log(`\nUpdated ${ok} Arabic posts with "ان ذا سيركل".`);
}

main();
