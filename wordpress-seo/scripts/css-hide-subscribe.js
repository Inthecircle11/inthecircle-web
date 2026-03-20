#!/usr/bin/env node
/**
 * Updates the WordPress page template to hide the subscribe text node
 * using a CSS-only trick: font-size:0 on .entry-content, revert on all child elements.
 *
 * The subscribe text is a bare text node (direct child of .entry-content).
 * Text nodes inherit font-size:0 and become invisible.
 * Block elements (p, h1, h2, etc.) use font-size:revert to restore normal size.
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
const HEADERS = {
  'Authorization': `Basic ${AUTH}`,
  'Content-Type': 'application/json',
};

// CSS-only fix: the subscribe text is a bare text node (direct child of .entry-content).
// Setting font-size:0 on the container hides it. All child ELEMENTS get font-size:revert
// to restore normal rendering. Text nodes (like the subscribe message) stay at size 0.
const SUBSCRIBE_CSS_BLOCK = `<!-- wp:html -->
<style>
/* Hide bare text nodes injected into post content (subscribe widget) */
.wp-block-post-content.entry-content {
  font-size: 0 !important;
  line-height: 0 !important;
}
.wp-block-post-content.entry-content > * {
  font-size: revert !important;
  line-height: revert !important;
}
</style>
<!-- /wp:html -->`;

const EXISTING_BG_CSS = `<!-- wp:html -->
<style>
body.page main,
body.page .wp-site-blocks,
body.home main,
body.home .wp-site-blocks {
  background: #050508 !important;
}
</style>
<!-- /wp:html -->`;

async function run() {
  const r = await fetch(`${SITE_URL}/wp-json/wp/v2/templates/extendable//page?context=edit`, { headers: HEADERS });
  const template = await r.json();

  if (!template.id) {
    console.error('Could not fetch template:', JSON.stringify(template).substring(0, 200));
    process.exit(1);
  }

  const currentContent = template.content?.raw || '';

  // Remove any old script-based subscribe fix blocks we may have added
  let cleaned = currentContent
    .replace(/<!-- wp:html -->\s*<script>[\s\S]*?<\/script>\s*<!-- \/wp:html -->\s*/g, '')
    .replace(/<!-- wp:html -->\s*<style>[^<]*font-size: 0[^<]*<\/style>\s*<!-- \/wp:html -->\s*/g, '');

  // If the BG CSS block is in the cleaned content, insert subscribe fix AFTER it
  if (cleaned.includes(EXISTING_BG_CSS)) {
    const newContent = cleaned.replace(EXISTING_BG_CSS, EXISTING_BG_CSS + '\n\n' + SUBSCRIBE_CSS_BLOCK);
    const update = await fetch(`${SITE_URL}/wp-json/wp/v2/templates/extendable//page`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ content: newContent }),
    });
    const result = await update.json();
    if (result.id) {
      console.log('✅ Page template updated with CSS fix:', result.id);
      console.log('   CSS stored:', (result.content?.raw || '').includes('font-size: 0') ? 'YES' : 'NO');
    } else {
      console.error('❌ Failed:', JSON.stringify(result).substring(0, 400));
    }
  } else {
    // Just prepend the CSS block
    const newContent = SUBSCRIBE_CSS_BLOCK + '\n\n' + cleaned;
    const update = await fetch(`${SITE_URL}/wp-json/wp/v2/templates/extendable//page`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ content: newContent }),
    });
    const result = await update.json();
    if (result.id) {
      console.log('✅ Page template updated with CSS fix (prepended):', result.id);
      console.log('   CSS stored:', (result.content?.raw || '').includes('font-size: 0') ? 'YES' : 'NO');
    } else {
      console.error('❌ Failed:', JSON.stringify(result).substring(0, 400));
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
