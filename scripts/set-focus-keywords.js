#!/usr/bin/env node
/**
 * Set AIOSEO Focus Keyword (keyphrases) on every post so TruSEO score can run.
 * Run: node scripts/set-focus-keywords.js
 * Requires: Inthecircle/scripts/.env.wp
 */

const fs = require('fs');
const path = require('path');
const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing', ENV_PATH);
    process.exit(1);
  }
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

function getAuthHeader(env) {
  return 'Basic ' + Buffer.from(env.user + ':' + env.appPassword).toString('base64');
}

// Keyphrase per slug (must match apply-seo-all-posts.js). Use short keyphrases for API.
const KEYPHRASE_BY_SLUG = {
  '1-billion-followers-summit-2026-what-creators-need-to-know': '1 billion followers summit',
  '1-billion-followers-summit-emirates-towers-difc-museum-of-the-future': '1 billion followers summit Dubai',
  '1-billion-acts-of-kindness-and-ai-film-award-summit-highlights': '1 billion followers summit',
  'how-to-network-at-the-1-billion-followers-summit-dubai': '1 billion followers summit Dubai',
  'creators-ventures-programme-launch-your-business-at-1-billion-followers-summit': 'creators ventures programme',
  'best-creator-networking-app-2026': 'creator networking app',
  'how-to-connect-with-other-creators': 'connect with creators',
  'networking-for-youtubers-and-streamers': 'YouTuber network',
  'how-to-find-collaborators-as-a-creator': 'find collaborators creators',
  'why-creator-networking-matters': 'creator networking',
  'creator-community-build-your-circle': 'creator community',
  'inthecircle-community-trending-waitlist': 'inthecircle community',
  'creator-community-gcc-egypt-jordan-lebanon': 'creator community GCC',
  'inthecircle-waitlist-creators-joining': 'inthecircle waitlist',
  'creator-collaboration-tips': 'creator collaboration',
  'mena-creator-economy-connect-arab-creators': 'MENA creator economy',
  'connect-with-streamers-gaming-creators': 'connect streamers creators',
  'creator-networking-egypt-egyptian-creators': 'creator networking Egypt',
  'best-creator-networking-app-egypt': 'creator networking app Egypt',
  'welcome-to-in-the-circle': 'inthecircle creator networking',
  'ar-best-creator-networking-app-2026': 'تطبيق تواصل للمبدعين',
  'ar-creator-networking-uae': 'تواصل صناع المحتوى الإمارات',
  'ar-creator-networking-egypt': 'تواصل المبدعين مصر',
  'ar-creator-community-gcc-egypt-jordan-lebanon': 'مجتمع المبدعين',
  'ar-content-creators-community-dubai': 'مجتمع صناع المحتوى دبي',
  'ar-build-creator-community-dubai': 'بناء مجتمع محتوى دبي',
  'ar-creator-economy-dubai-2026': 'اقتصاد صناع المحتوى دبي',
  'ar-creator-platforms-uae': 'منصات تواصل المبدعين',
  'ar-grow-as-content-creator-dubai': 'نمو مبدع محتوى دبي',
  'ar-creator-events-dubai': 'فعاليات صناع المحتوى دبي',
  'ar-social-media-creators-uae': 'صناع المحتوى الإمارات',
  'ar-content-strategy-dubai': 'استراتيجية المحتوى دبي',
  'ar-creative-community-uae': 'مجتمع المبدعين الإمارات',
  'ar-content-collaboration-dubai': 'تعاون صناع المحتوى دبي',
  'ar-content-creator-collaboration-dubai-uae': 'تعاون صناع المحتوى دبي',
  'ar-youtubers-streamers-dubai': 'يوتيوبرز ستريمرز دبي',
  'ar-build-successful-content-community-dubai': 'مجتمع محتوى ناجح دبي',
  'ar-future-content-creators-dubai-2026': 'مستقبل صناع المحتوى دبي',
};

function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function getKeyphrase(post) {
  const slug = post.slug || '';
  const rawSlug = decodeSlug(slug);
  const title = (post.title?.rendered || post.title || '').replace(/&#038;/g, '&');
  let k = KEYPHRASE_BY_SLUG[slug] || KEYPHRASE_BY_SLUG[rawSlug];
  if (k) return k;
  if (slug.includes('%')) {
    for (const [key, val] of Object.entries(KEYPHRASE_BY_SLUG)) {
      if (rawSlug.includes(key) || key.includes(rawSlug)) return val;
    }
  }
  if (title.includes('مليار متابع') || title.includes('قمة مليار') || title.includes('برنامج مبدعي')) return 'قمة مليار متابع';
  return slug && slug.startsWith('ar') ? 'تطبيق تواصل للمبدعين' : 'creator networking';
}

async function main() {
  const env = loadEnv();
  if (!env.url || !env.user || !env.appPassword) {
    console.error('Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD in', ENV_PATH);
    process.exit(1);
  }
  const base = env.url;
  const headers = {
    Authorization: getAuthHeader(env),
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&status=publish`, { headers });
  if (!res.ok) {
    console.error('Failed to fetch posts:', res.status);
    process.exit(1);
  }
  const posts = await res.json();
  console.log(`Setting Focus Keyword on ${posts.length} posts...\n`);

  let ok = 0;
  let fail = 0;
  for (const post of posts) {
    const keyphrase = getKeyphrase(post);
    const body = {
      aioseo_meta_data: {
        focusKeyphrase: keyphrase,
        keyphrases: [{ keyphrase }],
      },
    };
    try {
      const patch = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (patch.ok) {
        console.log(`✓ ${post.id} ${post.slug?.slice(0, 45) || post.id} → "${keyphrase.slice(0, 35)}${keyphrase.length > 35 ? '…' : ''}"`);
        ok++;
      } else {
        const err = await patch.text();
        console.error(`✗ ${post.id} ${post.slug}:`, err.slice(0, 120));
        fail++;
      }
    } catch (e) {
      console.error(`✗ ${post.id}:`, e.message);
      fail++;
    }
  }
  console.log(`\nDone. Focus Keyword set on ${ok}/${posts.length} posts.${fail ? ` Failed: ${fail}` : ''}`);
  console.log('Refresh AIOSEO Overview in WordPress to see TruSEO scores.');
}

main();
