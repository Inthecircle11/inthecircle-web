#!/usr/bin/env node
/**
 * Set All in One SEO (AIOSEO) meta title, description and keyphrases on each of the 9 posts via WordPress REST API.
 * Requires: WordPress with All in One SEO Pro (Plus or above) with REST API addon enabled.
 * Uses same credentials as publish-posts-to-wordpress.js (.env or scripts/.env.wp).
 *
 * Run from wordpress-seo: node scripts/set-aioseo-meta.js
 */

const fs = require('fs');
const path = require('path');

const SEO_DATA = [
  { slug: 'best-creator-networking-app-2026', title: 'Best Creator Networking App 2026 – Connect & Collaborate | inthecircle', description: 'The best creator networking app in 2026 helps YouTubers & streamers connect. No ads, real collaborations. See why inthecircle leads.', keyphrase: 'creator networking app' },
  { slug: 'how-to-connect-with-other-creators', title: 'How to Connect with Other Creators – Real Strategies 2026 | inthecircle', description: 'Learn how to connect with other creators: networking app, DMs, and community. Find collaborators and grow your circle with inthecircle.', keyphrase: 'connect with creators' },
  { slug: 'networking-for-youtubers-and-streamers', title: 'Networking for YouTubers and Streamers – Find Your Circle | inthecircle', description: 'Networking for YouTubers and streamers: join a real creator community. Find collabs, guests, and support. inthecircle – the creator networking app.', keyphrase: 'YouTuber network, streamer community' },
  { slug: 'how-to-find-collaborators-as-a-creator', title: 'How to Find Collaborators as a Creator – Step-by-Step Guide | inthecircle', description: 'How to find collaborators as a creator: use a creator networking app, define goals, and reach out with value. Join inthecircle to find your next collab.', keyphrase: 'find collaborators creators' },
  { slug: 'why-creator-networking-matters', title: 'Why Creator Networking Matters in 2026 – Build Your Circle | inthecircle', description: 'Why creator networking matters: audience, collabs, and long-term growth. Join a creator community and use the right networking app for creators.', keyphrase: 'creator networking, professional networking for creators' },
  { slug: 'creator-community-build-your-circle', title: 'Creator Community: How to Build Your Circle in 2026 | inthecircle', description: 'Build your creator community and find your circle. The best creator community app connects you with YouTubers & streamers. Join inthecircle.', keyphrase: 'creator community, creator community app' },
  { slug: 'inthecircle-community-trending-waitlist', title: 'Why the inthecircle Community Is Trending – Creators Are Joining the Waitlist | inthecircle', description: 'The inthecircle creator community is trending. Thousands of creators are on the waitlist. See why the networking app for creators is blowing up in 2026.', keyphrase: 'inthecircle community trending, creator community waitlist' },
  { slug: 'creator-community-gcc-egypt-jordan-lebanon', title: 'Creator Community GCC, Egypt, Jordan & Lebanon – Join inthecircle | inthecircle', description: 'Creator community for GCC, UAE, Saudi Arabia, Egypt, Jordan & Lebanon. Connect with Arab creators. inthecircle – the networking app for creators in the Middle East.', keyphrase: 'creator community GCC, creator community Egypt, Jordan Lebanon creators' },
  { slug: 'inthecircle-waitlist-creators-joining', title: 'inthecircle Waitlist: Thousands of Creators Are Joining – Get In | inthecircle', description: "The inthecircle waitlist is growing. Thousands of creators are joining the waitlist. Join the creator community everyone's talking about – GCC, Egypt, Jordan, Lebanon & global.", keyphrase: 'inthecircle waitlist, creators joining waitlist' },
];

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
    console.error('Set WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD (or use scripts/.env.wp).');
    process.exit(1);
  }

  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  for (const row of SEO_DATA) {
    try {
      const listRes = await fetch(`${apiBase}/posts?slug=${encodeURIComponent(row.slug)}`, { headers });
      if (!listRes.ok) {
        console.error(row.slug, 'GET failed', listRes.status);
        continue;
      }
      const list = await listRes.json();
      if (!Array.isArray(list) || list.length === 0) {
        console.error(row.slug, 'post not found');
        continue;
      }
      const postId = list[0].id;

      const body = {
        aioseo_meta_data: {
          title: row.title,
          description: row.description,
        },
      };
      if (row.keyphrase) {
        body.aioseo_meta_data.keyphrases = [{ keyphrase: row.keyphrase }];
      }

      const patchRes = await fetch(`${apiBase}/posts/${postId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (patchRes.ok) {
        console.log('OK:', row.slug);
      } else {
        const errText = await patchRes.text();
        if (patchRes.status === 400 && body.aioseo_meta_data.keyphrases) {
          delete body.aioseo_meta_data.keyphrases;
          const retry = await fetch(`${apiBase}/posts/${postId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
          if (retry.ok) console.log('OK (title+desc only):', row.slug);
          else console.error(row.slug, retry.status, await retry.text());
        } else {
          console.error(row.slug, patchRes.status, errText.slice(0, 200));
        }
      }
    } catch (err) {
      console.error(row.slug, err.message);
    }
  }
  console.log('Done.');
}

main();
