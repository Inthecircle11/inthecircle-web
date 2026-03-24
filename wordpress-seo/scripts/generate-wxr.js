#!/usr/bin/env node
/**
 * Generates a WordPress WXR (XML) import file from blog-posts/*.md.
 * Run from wordpress-seo folder: node scripts/generate-wxr.js
 * Output: inthecircle-blog-import.xml — use in WordPress → Tools → Import → WordPress.
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'blog-posts');
const OUT_FILE = path.join(__dirname, '..', 'inthecircle-blog-import.xml');
const BASE_URL = 'https://inthecircle.co';

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
  '10-creator-networking-collaboration-hub.md',
  '11-how-creators-work-together-playbook.md',
  '12-mena-gcc-creators-hub.md',
];

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
  let html = md
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  // Links before bold so we don't break them
  html = html.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Headers (must be at line start)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // List items: - item or 1. item
  const lines = html.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
    if (line.trim() === '') {
      out.push('');
      continue;
    }
    // Don't wrap headers or list tags in <p>
    if (/^<(h[1-3]|ul|ol|li)/.test(line) || /<\/(ul|ol)>$/.test(line)) {
      out.push(line);
      continue;
    }
    out.push('<p>' + line + '</p>');
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(str) {
  return str.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function buildWxr(posts) {
  const now = new Date().toUTCString();
  let items = '';
  for (const p of posts) {
    const link = `${BASE_URL}/${p.slug}/`;
    const guid = link;
    const excerpt = p.description || p.title || '';
    const contentEncoded = cdata(p.html);
    items += `
  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${escapeXml(link)}</link>
    <pubDate>${now}</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <guid isPermaLink="true">${escapeXml(guid)}</guid>
    <description><![CDATA[${cdata(excerpt)}]]></description>
    <content:encoded><![CDATA[${contentEncoded}]]></content:encoded>
    <wp:post_id>${p.id}</wp:post_id>
    <wp:post_date><![CDATA[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]]></wp:post_date>
    <wp:post_name><![CDATA[${p.slug}]]></wp:post_name>
    <wp:post_type><![CDATA[post]]></wp:post_type>
    <wp:status><![CDATA[publish]]></wp:status>
  </item>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>inthecircle Blog</title>
  <link>${BASE_URL}</link>
  <description>Blog posts for inthecircle.co</description>
  <pubDate>${now}</pubDate>
  <language>en-US</language>
  <wp:wxr_version>1.2</wp:wxr_version>${items}
</channel>
</rss>`;
}

const posts = [];
let id = 1;
for (const file of POST_ORDER) {
  const filePath = path.join(BLOG_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn('Skip (not found):', file);
    continue;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const slug = meta.slug || path.basename(file, '.md').replace(/^\d+-/, '');
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = meta.title || (titleMatch ? titleMatch[1].trim() : slug);
  const description = meta.description || '';
  posts.push({
    id: id++,
    slug,
    title,
    description,
    html: mdToHtml(body),
  });
}

const wxr = buildWxr(posts);
fs.writeFileSync(OUT_FILE, wxr, 'utf8');
console.log('Wrote', OUT_FILE, '—', posts.length, 'posts. Import in WordPress: Tools → Import → WordPress → Upload this file.');
console.log('After import: set SEO meta title/description and focus keyword per post in Yoast or Rank Math.');
