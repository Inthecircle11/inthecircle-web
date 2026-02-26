#!/usr/bin/env node
/**
 * Fix Arabic grammar in all posts via WordPress REST API.
 * Run: node scripts/fix-arabic-grammar.js
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

/** Fixes: content string -> corrected content */
const FIXES = {
  283: (c) => c.replace(/وبثّامين/g, 'وستريمرز'),
  284: (c) => c.replace(/وبثّامين/g, 'وستريمرز'),
  296: (c) => c.replace(/يساعدك تتعرف عليهم/g, 'يساعدك على التعرف عليهم').replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  297: (c) => c.replace(/<\/a> و <a /g, '</a> و<a ').replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  330: (c) => c.replace(/الراغبين بتأسيس/g, 'الراغبين في تأسيس'),
  306: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  305: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  304: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  303: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  302: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  301: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  300: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  299: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  298: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  295: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  294: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  293: (c) => c.replace(/<\/a> و <a /g, '</a> و<a ').replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
  292: (c) => c.replace(/اقتصاد المبدعين دبي/g, 'اقتصاد المبدعين في دبي'),
};

async function main() {
  let ok = 0;
  for (const [idStr, fix] of Object.entries(FIXES)) {
    const id = parseInt(idStr, 10);
    try {
      const res = await fetch(`${base}/wp-json/wp/v2/posts/${id}?context=edit`, { headers });
      if (!res.ok) throw new Error(res.status);
      const post = await res.json();
      const raw = post.content?.raw || '';
      const corrected = fix(raw);
      if (corrected === raw) {
        console.log(`- ${id} (no change)`);
        continue;
      }
      const patch = await fetch(`${base}/wp-json/wp/v2/posts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content: corrected }),
        signal: AbortSignal.timeout(15000),
      });
      if (patch.ok) {
        console.log(`✓ ${id}`);
        ok++;
      } else throw new Error(await patch.text());
    } catch (e) {
      console.error(`✗ ${id}:`, e.message?.slice(0, 80));
    }
  }
  console.log(`\nDone. Fixed ${ok}/${Object.keys(FIXES).length} posts.`);
}

main();
