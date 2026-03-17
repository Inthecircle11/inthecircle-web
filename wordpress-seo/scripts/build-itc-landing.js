#!/usr/bin/env node
/**
 * Build page-itc-landing.php from inthecircle-v5.html
 * - Extracts body, style, script
 * - Saves base64 images to theme assets/images
 * - Scopes CSS with .itc-page prefix
 * - Outputs PHP template file
 *
 * Usage: node scripts/build-itc-landing.js [path-to-inthecircle-v5.html]
 * Default HTML path: ../../../Library/Mobile Documents/com~apple~CloudDocs/inthecircle-v5.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const THEME_DIR = path.join(ROOT, 'theme-extendable');
const ASSETS_IMAGES = path.join(THEME_DIR, 'assets', 'images');
const OUT_PHP = path.join(THEME_DIR, 'page-itc-landing.php');

const HTML_PATH = process.argv[2] || path.join(ROOT, '..', '..', 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'inthecircle-v5.html');

function extractSections(html) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  let bodyContent = bodyMatch ? bodyMatch[1].trim() : '';
  const scriptMatch = bodyContent.match(/<script>([\s\S]*?)<\/script>/);
  const script = scriptMatch ? scriptMatch[1].trim() : '';
  if (scriptMatch) {
    bodyContent = bodyContent.replace(/<script>[\s\S]*?<\/script>/, '').trim();
  }
  return {
    style: styleMatch ? styleMatch[1].trim() : '',
    body: bodyContent,
    script,
  };
}

function splitSelectors(selectorStr) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < selectorStr.length; i++) {
    const c = selectorStr[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function scopeCss(css) {
  return css.replace(/(^|\})\s*([^{}]+)\{/g, (match, before, selectors) => {
    const trimmed = selectors.trim();
    if (trimmed.startsWith('@')) return match;
    if (trimmed.startsWith('/*')) return match;
    if (/^(\d+%|from|to)\s*$/i.test(trimmed)) return match;
    const withoutBlockComments = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!withoutBlockComments) return match;
    const parts = splitSelectors(withoutBlockComments);
    const prefixed = parts.map((s) => '.itc-page ' + s.trim()).filter(Boolean).join(', ');
    if (!prefixed) return match;
    const commentMatch = trimmed.match(/^(\s*\/\*[\s\S]*?\*\/\s*)/);
    const comment = commentMatch ? commentMatch[1] : '';
    return (before === '' ? '' : before + '\n') + comment + prefixed + ' {';
  });
}

function extractBase64Images(str) {
  const list = [];
  const re = /(src=)["'](data:image\/(jpeg|png|gif|webp);base64,([^"']+))["']/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    list.push({
      full: m[0],
      mime: m[3],
      data: m[4],
    });
  }
  return list;
}

function replaceBase64InBody(body, imageList, imageNames) {
  let out = body;
  imageList.forEach((img, i) => {
    const name = imageNames[i];
    const replacement = `src="<?php echo get_template_directory_uri(); ?>/assets/images/${name}"`;
    out = out.replace(img.full, replacement);
  });
  return out;
}

function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('HTML file not found:', HTML_PATH);
    process.exit(1);
  }

  console.log('Reading', HTML_PATH);
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const { style, body, script } = extractSections(html);

  const imageList = extractBase64Images(body);
  console.log('Found', imageList.length, 'base64 images');

  if (!fs.existsSync(ASSETS_IMAGES)) {
    fs.mkdirSync(ASSETS_IMAGES, { recursive: true });
  }

  const imageNames = [];
  imageList.forEach((img, i) => {
    const name = `itc-landing-${i + 1}.png`;
    imageNames.push(name);
    const buf = Buffer.from(img.data, 'base64');
    fs.writeFileSync(path.join(ASSETS_IMAGES, name), buf);
    console.log('  Wrote', name);
  });

  const bodyReplaced = replaceBase64InBody(body, imageList, imageNames);
  const scopedCss = scopeCss(style);

  const phpContent = `<?php /* Template Name: ITC Home v2 */ get_header(); ?>
<style id="itc-landing-v2">
${scopedCss}
</style>
<div class="itc-page">
${bodyReplaced}
</div>
<script>
${script}
</script>
<?php get_footer(); ?>
`;

  fs.writeFileSync(OUT_PHP, phpContent, 'utf8');
  console.log('Wrote', OUT_PHP);
  console.log('Theme dir:', THEME_DIR);
  console.log('Active theme (for upload): extendable');
}

main();
