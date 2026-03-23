#!/usr/bin/env node
/**
 * Notify search engines of your sitemaps (helps crawlers discover new/updated content).
 * Run from wordpress-seo folder: node scripts/ping-sitemaps.js
 *
 * Pings:
 * - Bing (sitemap ping still supported)
 * - Google (ping endpoint deprecated; submitting in Search Console is the right way, but we ping anyway for any remaining effect)
 *
 * Uses sitemap URLs you pass or defaults for inthecircle.co and app.inthecircle.co.
 */

const WORDPRESS_SITEMAP = process.env.WORDPRESS_SITEMAP || 'https://inthecircle.co/sitemap_index.xml';
const APP_SITEMAP = process.env.APP_SITEMAP || 'https://app.inthecircle.co/sitemap.xml';

const PING_URLS = [
  `https://www.google.com/ping?sitemap=${encodeURIComponent(WORDPRESS_SITEMAP)}`,
  `https://www.bing.com/ping?sitemap=${encodeURIComponent(WORDPRESS_SITEMAP)}`,
  `https://www.google.com/ping?sitemap=${encodeURIComponent(APP_SITEMAP)}`,
  `https://www.bing.com/ping?sitemap=${encodeURIComponent(APP_SITEMAP)}`,
];

async function ping(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { url, ok: res.ok, status: res.status };
  } catch (e) {
    return { url, ok: false, error: e.message };
  }
}

async function main() {
  console.log('Pinging sitemaps...');
  console.log('WordPress:', WORDPRESS_SITEMAP);
  console.log('App:', APP_SITEMAP);
  for (const url of PING_URLS) {
    const result = await ping(url);
    const label = result.ok ? 'OK' : (result.error || `HTTP ${result.status}`);
    console.log(result.ok ? '  ✓' : '  ✗', url.split('?')[0], '—', label);
  }
  console.log('\nNote: Google may no longer respond to ping (they prefer Search Console). Bing usually does. Submit sitemaps in GSC/Bing Webmaster Tools for best results.');
}

main();
