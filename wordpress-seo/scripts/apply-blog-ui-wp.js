#!/usr/bin/env node
/**
 * Apply blog + single-post UI CSS to inthecircle.co via WordPress REST API.
 * Injects CSS directly into block templates (home, single, index).
 * Run: node scripts/apply-blog-ui-wp.js
 * Requires: WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD in ../../scripts/.env.wp or ../../Inthecircle/scripts/.env.wp or ../.env
 */

const fs = require('fs');
const path = require('path');

const ENV_PATHS = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env.wp'),
  path.join(__dirname, '..', '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
];
const CSS_PATH = path.join(__dirname, '../blog-single-ui.css');

function loadEnv() {
  const env = { url: '', user: '', appPassword: '' };
  for (const envPath of ENV_PATHS) {
    if (!fs.existsSync(envPath)) continue;
    const c = fs.readFileSync(envPath, 'utf8');
    c.split('\n').forEach((line) => {
      const m = line.match(/^\s*(?:WP_)?(?:SITE_URL|USERNAME|APP_PASSWORD)\s*=\s*["']?([^"'\n]*)["']?/i);
      const m2 = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m2) {
        const key = m2[1], val = m2[2].replace(/^["']|["']$/g, '').trim();
        if (key === 'WP_SITE_URL' || key === 'WORDPRESS_URL') env.url = val.replace(/\/$/, '');
        else if (key === 'WP_USERNAME' || key === 'WORDPRESS_USER') env.user = val;
        else if (key === 'WP_APP_PASSWORD' || key === 'WORDPRESS_APP_PASSWORD') env.appPassword = val.replace(/\s/g, '');
      }
    });
    if (env.url && env.appPassword) return env;
  }
  console.error('Missing WordPress credentials. Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD in one of:', ENV_PATHS.join(', '));
  process.exit(1);
}

function getAuthHeader(env) {
  return 'Basic ' + Buffer.from(env.user + ':' + env.appPassword).toString('base64');
}

async function getActiveTheme(base, headers) {
  try {
    const r = await fetch(`${base}/wp-json/wp/v2/themes?status=active`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const themes = await r.json();
      if (themes.length > 0) {
        return themes[0].stylesheet;
      }
    }
  } catch (e) {
    console.error('Could not get active theme:', e.message);
  }
  return 'extendable';
}

async function getTemplate(base, headers, themeSlug, templateSlug) {
  const id = encodeURIComponent(`${themeSlug}//${templateSlug}`);
  const url = `${base}/wp-json/wp/v2/templates/${id}?context=edit`;
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (r.ok) {
      return await r.json();
    }
    console.log(`Template ${templateSlug} not found (${r.status})`);
  } catch (e) {
    console.log(`Template ${templateSlug} fetch error:`, e.message);
  }
  return null;
}

async function updateTemplate(base, headers, themeSlug, templateSlug, newContent) {
  const id = encodeURIComponent(`${themeSlug}//${templateSlug}`);
  const url = `${base}/wp-json/wp/v2/templates/${id}`;
  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content: newContent }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      console.log(`✓ Updated template: ${templateSlug}`);
      return true;
    }
    const err = await r.text();
    console.error(`✗ Failed to update ${templateSlug}:`, r.status, err.slice(0, 200));
  } catch (e) {
    console.error(`✗ Error updating ${templateSlug}:`, e.message);
  }
  return false;
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

  let css = fs.readFileSync(CSS_PATH, 'utf8');

  console.log('Applying blog UI CSS to WordPress templates...\n');

  const themeSlug = await getActiveTheme(base, headers);
  console.log('Active theme:', themeSlug);

  const styleBlock = `<!-- wp:html --><style id="itc-blog-single-ui">${css}</style><!-- /wp:html -->`;
  const templates = ['home', 'single', 'index'];
  let updated = 0;

  for (const tpl of templates) {
    const data = await getTemplate(base, headers, themeSlug, tpl);
    if (!data || !data.content || typeof data.content.raw !== 'string') {
      console.log(`Skipping ${tpl} (no content.raw)`);
      continue;
    }

    let content = data.content.raw;

    // Remove existing style block if present
    content = content.replace(/<!-- wp:html --><style id="itc-blog-single-ui">[\s\S]*?<\/style><!-- \/wp:html -->\s*/g, '');

    // Prepend new style block
    content = styleBlock + '\n\n' + content;

    const ok = await updateTemplate(base, headers, themeSlug, tpl, content);
    if (ok) updated++;
  }

  console.log(`\nDone. Updated ${updated}/${templates.length} templates.`);
  if (updated > 0) {
    console.log('Clear your cache and refresh https://inthecircle.co/blog/');
  }
}

main();
