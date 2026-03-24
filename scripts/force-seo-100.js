#!/usr/bin/env node
/**
 * Force baseline SEO checks (title, description, linksRatio) for all published pages/posts.
 * Run: node scripts/force-seo-100.js
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');
const MIN_DESC = 145;
const MAX_DESC = 155;

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing', ENV_PATH);
    process.exit(1);
  }
  const c = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  c.split('\n').forEach((line) => {
    const m = line.match(/^\s*WP_(SITE_URL|USERNAME|APP_PASSWORD)\s*=\s*["']?([^"'\n]*)["']?/);
    if (!m) return;
    if (m[1] === 'SITE_URL') env.url = m[2].trim().replace(/\/$/, '');
    if (m[1] === 'USERNAME') env.user = m[2].trim();
    if (m[1] === 'APP_PASSWORD') env.appPassword = (m[2] || '').trim().replace(/\s/g, '');
  });
  return env;
}

function authHeader(env) {
  return 'Basic ' + Buffer.from(`${env.user}:${env.appPassword}`).toString('base64');
}

function stripHtml(html) {
  const safe = typeof html === 'string' ? html : (html == null ? '' : String(html));
  return safe
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text, max) {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  const idx = cut.lastIndexOf(' ');
  return (idx > Math.floor(max * 0.65) ? cut.slice(0, idx) : cut).trim();
}

function normalizeTitle(rawTitle) {
  const base = stripHtml(rawTitle).replace(/\s*\|\s*Inthecircle$/i, '').trim();
  const withBrand = `${base} | Inthecircle`;
  if (withBrand.length <= 60) return withBrand;
  const trimmedBase = truncateAtWord(base, 60 - ' | Inthecircle'.length);
  return `${trimmedBase} | Inthecircle`;
}

function normalizeDescription(rawTitle, rawExcerpt) {
  const src = stripHtml(rawExcerpt) || `Read ${stripHtml(rawTitle)} and connect with creators on Inthecircle.`;
  let out = src;
  if (out.length < MIN_DESC) {
    out = `${out} Inthecircle helps creators network, collaborate, and grow through real opportunities.`;
  }
  out = truncateAtWord(out, MAX_DESC);
  if (out.length < MIN_DESC) {
    out = truncateAtWord(
      `${out} Join Inthecircle today to build your creator network and discover new collaborations.`,
      MAX_DESC
    );
  }
  return out;
}

function withInternalLinks(content) {
  const marker = 'itc-seo-internal-links';
  if ((content || '').includes(marker)) return content;
  const linksBlock =
    '<p class="itc-seo-internal-links">Related: ' +
    '<a href="https://inthecircle.co/about/">About</a> · ' +
    '<a href="https://inthecircle.co/faq/">FAQ</a> · ' +
    '<a href="https://inthecircle.co/blog/">Blog</a> · ' +
    '<a href="https://app.inthecircle.co/download">Download the app</a></p>';
  return `${(content || '').trim()}\n${linksBlock}`;
}

async function fetchAll(base, headers, type) {
  const out = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${base}/wp-json/wp/v2/${type}?per_page=100&page=${page}&status=publish&_fields=id,slug,title,excerpt,content`,
      { headers }
    );
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return out;
}

async function updateItem(base, headers, type, item) {
  const title = normalizeTitle(item.title?.rendered || item.title || '');
  const description = normalizeDescription(item.title?.rendered || item.title || '', item.excerpt?.rendered || item.excerpt || '');
  const content = withInternalLinks(item.content?.rendered || item.content || '');

  const payload = {
    title,
    excerpt: description,
    content,
    aioseo_meta_data: {
      title,
      description,
    },
  };

  let res = await fetch(`${base}/wp-json/wp/v2/${type}/${item.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok && res.status === 400) {
    delete payload.aioseo_meta_data;
    res = await fetch(`${base}/wp-json/wp/v2/${type}/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${type} ${item.id} (${item.slug}) -> ${res.status} ${err.slice(0, 180)}`);
  }
}

async function main() {
  const env = loadEnv();
  if (!env.url || !env.user || !env.appPassword) {
    console.error('Missing env values in', ENV_PATH);
    process.exit(1);
  }
  const base = env.url;
  const headers = {
    Authorization: authHeader(env),
    'Content-Type': 'application/json',
  };

  const [pages, posts] = await Promise.all([
    fetchAll(base, headers, 'pages'),
    fetchAll(base, headers, 'posts'),
  ]);
  const items = [
    ...pages.map((x) => ({ ...x, _type: 'pages' })),
    ...posts.map((x) => ({ ...x, _type: 'posts' })),
  ];

  console.log(`Normalizing SEO for ${items.length} pages/posts...`);

  let ok = 0;
  let fail = 0;
  for (const item of items) {
    try {
      await updateItem(base, headers, item._type, item);
      ok++;
      console.log(`✓ ${item._type.slice(0, -1)} ${item.id} ${item.slug}`);
    } catch (e) {
      fail++;
      console.error(`✗ ${e.message}`);
    }
  }

  console.log(`Done. Updated: ${ok}, Failed: ${fail}`);
}

main();
