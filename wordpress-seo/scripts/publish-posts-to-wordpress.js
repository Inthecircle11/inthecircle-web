#!/usr/bin/env node
/**
 * Publish all 9 blog posts to WordPress via REST API.
 *
 * Prerequisites:
 * 1. WordPress at WORDPRESS_URL (e.g. https://inthecircle.co) with REST API enabled.
 * 2. Application Password: WordPress Admin → Users → Your user → Application Passwords →
 *    create one, copy the generated password (shown once).
 *
 * Run (from wordpress-seo folder):
 *   WORDPRESS_URL=https://inthecircle.co WORDPRESS_USER=admin WORDPRESS_APP_PASSWORD=xxxx node scripts/publish-posts-to-wordpress.js
 *
 * Or create .env in wordpress-seo/ (do not commit) with:
 *   WORDPRESS_URL=https://inthecircle.co
 *   WORDPRESS_USER=admin
 *   WORDPRESS_APP_PASSWORD=xxxx
 *
 * Options:
 *   --dry-run   Log what would be sent, do not POST.
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'blog-posts');
const POST_ORDER = [
  '01-best-creator-networking-app-2026.md',
  '02-how-to-connect-with-other-creators.md',
  '03-networking-for-youtubers-and-streamers.md',
  '04-how-to-find-collaborators-as-a-creator.md',
  '05-why-creator-networking-matters.md',
  '06-creator-community-build-your-circle.md',
  '07-inthecircle-community-trending-waitlist.md',
  '08-creator-community-gcc-egypt-jordan-lebanon.md',
  '09-inthecircle-waitlist-creators-joining.md',
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
      let val = m[2].replace(/^["']|["']$/g, '').trim();
      if (key === 'WP_SITE_URL' && !process.env.WORDPRESS_URL) process.env.WORDPRESS_URL = val;
      else if (key === 'WP_USERNAME' && !process.env.WORDPRESS_USER) process.env.WORDPRESS_USER = val;
      else if (key === 'WP_APP_PASSWORD' && !process.env.WORDPRESS_APP_PASSWORD) process.env.WORDPRESS_APP_PASSWORD = val;
      else if (!process.env[key]) process.env[key] = val;
    }
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const fm = match[1];
  const body = match[2].trim();
  const meta = {};
  const slugM = fm.match(/Slug:\s*(\S+)/i);
  const titleM = fm.match(/Meta title:\s*(.+?)(?:\n|$)/is);
  const descM = fm.match(/Meta description:\s*(.+?)(?:\n#|$)/is);
  if (slugM) meta.slug = slugM[1].trim();
  if (titleM) meta.title = titleM[1].trim();
  if (descM) meta.description = descM[1].trim();
  return { meta, body };
}

function mdToHtml(md) {
  let html = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  html = html.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  const lines = html.split('\n');
  const out = [];
  let inUl = false, inOl = false;
  for (const line of lines) {
    const ulMatch = line.match(/^-\s+(.+)$/);
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push('<li>' + ulMatch[1] + '</li>');
      continue;
    }
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (olMatch) {
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push('<li>' + olMatch[2] + '</li>');
      continue;
    }
    if (inOl) { out.push('</ol>'); inOl = false; }
    if (line.trim() === '') { out.push(''); continue; }
    if (/^<(h[1-3]|ul|ol|li)/.test(line) || /<\/(ul|ol)>$/.test(line)) { out.push(line); continue; }
    out.push('<p>' + line + '</p>');
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function main() {
  loadEnv();
  const baseUrl = (process.env.WORDPRESS_URL || '').replace(/\/$/, '');
  const user = process.env.WORDPRESS_USER || 'admin';
  const appPassword = process.env.WORDPRESS_APP_PASSWORD || '';
  const dryRun = process.argv.includes('--dry-run');

  if (!baseUrl || !appPassword) {
    console.error('Usage: WORDPRESS_URL=https://inthecircle.co WORDPRESS_USER=admin WORDPRESS_APP_PASSWORD=xxxx node scripts/publish-posts-to-wordpress.js');
    console.error('Or set these in wordpress-seo/.env (do not commit .env).');
    console.error('Create an Application Password: WordPress Admin → Users → Your user → Application Passwords.');
    process.exit(1);
  }

  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const posts = [];
  for (const file of POST_ORDER) {
    const filePath = path.join(BLOG_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = meta.slug || path.basename(file, '.md').replace(/^\d+-/, '');
    const titleMatch = body.match(/^#\s+(.+)$/m);
    posts.push({
      slug,
      title: meta.title || (titleMatch ? titleMatch[1].trim() : slug),
      excerpt: meta.description || '',
      content: mdToHtml(body),
    });
  }

  const apiBase = `${baseUrl}/wp-json/wp/v2`;
  for (const post of posts) {
    if (dryRun) {
      console.log(`[dry-run] Would publish: ${post.slug} — ${post.title}`);
      continue;
    }
    try {
      const existing = await fetch(`${apiBase}/posts?slug=${encodeURIComponent(post.slug)}`, { headers });
      const existingList = await existing.json();
      const body = {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        status: 'publish',
        slug: post.slug,
      };
      if (Array.isArray(existingList) && existingList.length > 0) {
        const id = existingList[0].id;
        const res = await fetch(`${apiBase}/posts/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        console.log(`Updated: ${post.slug} (ID ${id})`);
      } else {
        const res = await fetch(`${apiBase}/posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        console.log(`Created: ${post.slug} — ${baseUrl}/${post.slug}/`);
      }
    } catch (err) {
      console.error(`Failed ${post.slug}:`, err.message);
    }
  }
  if (!dryRun) console.log('\nDone. Set SEO meta title/description and focus keyword per post in Yoast or Rank Math.');
}

main();
