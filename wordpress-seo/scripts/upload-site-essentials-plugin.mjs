#!/usr/bin/env node
/**
 * Upload inthecircle-site-essentials.php (clean replacement plugin, no sticky bar).
 * Reads wordpress-seo/.env.sftp (same as upload-seo-plugin.mjs).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PLUGIN_PHP = path.join(ROOT, 'inthecircle-site-essentials', 'inthecircle-site-essentials.php');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.sftp');
  if (fs.existsSync(envPath)) {
    const c = fs.readFileSync(envPath, 'utf8');
    c.split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        process.env[k] = v;
      }
    });
  }
}

function main() {
  loadEnv();
  const host = process.env.WP_SFTP_HOST;
  const user = process.env.WP_SFTP_USER;
  const password = process.env.WP_SFTP_PASSWORD;
  const remoteTheme = (process.env.WP_SFTP_REMOTE_PATH || '').replace(/\/$/, '');
  const pluginFolder = process.env.WP_SITE_ESSENTIALS_FOLDER || 'inthecircle-site-essentials';

  if (!host || !user || !password) {
    console.error('Missing FTP config in wordpress-seo/.env.sftp (WP_SFTP_HOST, WP_SFTP_USER, WP_SFTP_PASSWORD)');
    process.exit(1);
  }
  if (!fs.existsSync(PLUGIN_PHP)) {
    console.error('Missing', PLUGIN_PHP);
    process.exit(1);
  }

  const themePath = remoteTheme.replace(/^\/+/, '');
  const wpContentBase = themePath.replace(/\/themes\/[^/]+$/, '') || 'public_html/wp-content';
  const remoteFile = `${wpContentBase}/plugins/${pluginFolder}/inthecircle-site-essentials.php`.replace(/\/+/g, '/');
  const ftpUrl = `ftp://${user}:${encodeURIComponent(password)}@${host}/${remoteFile}`;

  console.log('Uploading Inthecircle Site Essentials...');
  console.log('  Local:', PLUGIN_PHP);
  console.log('  Remote:', remoteFile);
  try {
    execSync(`curl -sS --fail --ftp-pasv --ftp-create-dirs -T "${PLUGIN_PHP}" "${ftpUrl}"`, {
      stdio: 'inherit',
      maxBuffer: 10 * 1024 * 1024,
    });
    console.log('\nDone. In WP: deactivate legacy “Inthecircle SEO Enhancements”, activate “Inthecircle Site Essentials”, purge LiteSpeed cache.');
  } catch {
    process.exit(1);
  }
}

main();
