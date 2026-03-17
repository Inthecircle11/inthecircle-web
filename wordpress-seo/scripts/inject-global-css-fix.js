#!/usr/bin/env node
/**
 * Appends CSS to WordPress Global Styles (settings.custom.css, ID 4).
 * Global Styles CSS is rendered in the page <head> as an inline style block
 * and bypasses all content security filters.
 *
 * CSS trick: The subscribe text is a bare text node (direct child of .entry-content).
 * Setting font-size:0 + line-height:0 on the container makes it invisible.
 * All child ELEMENTS use font-size:revert to restore normal typography.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const paths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^\s*(WP_SITE_URL|WP_USERNAME|WP_APP_PASSWORD)\s*=\s*["']?([^"'\n]*)["']?/);
        if (m) process.env[m[1]] = m[2].trim();
      });
    }
  }
}
loadEnv();

const SITE_URL = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
const USERNAME = process.env.WP_USERNAME || '';
const APP_PASSWORD = (process.env.WP_APP_PASSWORD || '').replace(/\s/g, '');
const AUTH = Buffer.from(`${USERNAME}:${APP_PASSWORD}`).toString('base64');
const HEADERS = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' };

// CSS to hide the subscribe bare text node
const SUBSCRIBE_FIX_CSS = `
/* ITC: Hide bare text nodes in post content (subscribe widget injection) */
.wp-block-post-content.entry-content{font-size:0!important;line-height:0!important}
.wp-block-post-content.entry-content>*{font-size:revert!important;line-height:revert!important}`;

async function run() {
  // Fetch current global styles
  const r = await fetch(`${SITE_URL}/wp-json/wp/v2/global-styles/4?context=edit`, { headers: HEADERS });
  const gs = await r.json();

  if (!gs.id) {
    console.error('Could not fetch global styles:', JSON.stringify(gs).substring(0, 200));
    process.exit(1);
  }

  const settings = gs.settings || {};
  const existingCss = settings?.custom?.css || '';

  // Check if fix is already applied
  if (existingCss.includes('ITC: Hide bare text nodes')) {
    console.log('✅ Fix already present in global styles. Checking for fresh version...');
    // Remove old fix and re-add (ensures latest version)
    const cleaned = existingCss.replace(/\n\/\* ITC: Hide bare text nodes[\s\S]*?!important\}/g, '');
    settings.custom = { ...settings.custom, css: cleaned + SUBSCRIBE_FIX_CSS };
  } else {
    settings.custom = { ...settings.custom, css: existingCss + SUBSCRIBE_FIX_CSS };
  }

  // Update global styles
  const update = await fetch(`${SITE_URL}/wp-json/wp/v2/global-styles/4`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ settings }),
  });
  const result = await update.json();

  if (result.id) {
    const updatedCss = result.settings?.custom?.css || '';
    console.log('✅ Global styles updated (ID:', result.id, ')');
    console.log('   Fix in CSS:', updatedCss.includes('ITC: Hide bare text nodes') ? 'YES' : 'NO');
    console.log('   CSS length:', updatedCss.length);
  } else {
    console.error('❌ Update failed:', JSON.stringify(result, null, 2).substring(0, 400));
  }
}

run().catch(e => { console.error(e); process.exit(1); });
