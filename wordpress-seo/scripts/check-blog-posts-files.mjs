#!/usr/bin/env node
/**
 * Verify every file in POST_ORDER exists under blog-posts/.
 * Run: node wordpress-seo/scripts/check-blog-posts-files.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publishPath = path.join(__dirname, 'publish-posts-to-wordpress.js');
const raw = fs.readFileSync(publishPath, 'utf8');
const m = raw.match(/const POST_ORDER = \[([\s\S]*?)\];/);
if (!m) {
  console.error('Could not find POST_ORDER in publish-posts-to-wordpress.js');
  process.exit(1);
}
const files = [...m[1].matchAll(/'([^']+\.md)'/g)].map((x) => x[1]);
const blogDir = path.join(__dirname, '..', 'blog-posts');
const missing = [];
for (const f of files) {
  if (!fs.existsSync(path.join(blogDir, f))) missing.push(f);
}
if (missing.length) {
  console.error('Missing Markdown files:', missing.join(', '));
  process.exit(1);
}
console.log(`OK: ${files.length} blog-posts files match POST_ORDER.`);
