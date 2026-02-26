#!/usr/bin/env node
/**
 * Audit all pages and posts for AIOSEO score. Report any below 100.
 * Run: node scripts/audit-seo-scores.js
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

async function analyze(id) {
  const res = await fetch(`${base}/wp-json/aioseo/v1/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ postId: id }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { score: 'err', error: res.status };
  return res.json();
}

async function main() {
  const pages = await fetch(`${base}/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,slug,title`).then(r => r.json());
  const posts = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&status=publish&_fields=id,slug,title`).then(r => r.json());

  const items = [
    ...pages.map(p => ({ id: p.id, slug: p.slug, type: 'page' })),
    ...posts.map(p => ({ id: p.id, slug: p.slug, type: 'post' })),
  ];

  console.log(`Auditing ${items.length} pages/posts...\n`);
  const low = [];

  for (const item of items) {
    const data = await analyze(item.id);
    const score = data.score || 'err';
    if (score !== '100') {
      const fails = data.results?.basic
        ? Object.entries(data.results.basic).filter(([, v]) => v?.status !== 'passed').map(([k]) => k)
        : [];
      low.push({ ...item, score, fails });
    }
  }

  if (low.length === 0) {
    console.log('All pages and posts score 100/100.');
    return;
  }

  console.log(`Found ${low.length} below 100:\n`);
  low.forEach(({ id, type, slug, score, fails }) => {
    console.log(`${type} ${id} (${slug}): ${score} | fails: ${fails.join(', ') || 'unknown'}`);
  });
}

main();
