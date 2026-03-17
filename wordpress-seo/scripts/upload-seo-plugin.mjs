#!/usr/bin/env node
/**
 * Upload inthecircle-seo-enhancements.php to the WordPress plugin folder via FTP.
 * This deploys the version WITHOUT the sticky CTA bar.
 *
 * Reads from wordpress-seo/.env.sftp.
 * Plugin folder on server: plugins/inthecircle-seo (or set WP_PLUGIN_FOLDER=wordpress-seo).
 *
 * Usage: cd wordpress-seo && node scripts/upload-seo-plugin.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PLUGIN_PHP = path.join(ROOT, 'inthecircle-seo-enhancements.php');

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
  const pluginFolder = process.env.WP_PLUGIN_FOLDER || 'inthecircle-seo';
  const pluginPathOverride = process.env.WP_PLUGIN_REMOTE_PATH || '';

  if (!host || !user || !password) {
    console.error('Missing FTP config. In wordpress-seo/.env.sftp set:');
    console.error('  WP_SFTP_HOST, WP_SFTP_USER, WP_SFTP_PASSWORD');
    process.exit(1);
  }

  if (!fs.existsSync(PLUGIN_PHP)) {
    console.error('Missing', PLUGIN_PHP);
    process.exit(1);
  }

  let remoteFile;
  if (pluginPathOverride) {
    remoteFile = pluginPathOverride.replace(/\/$/, '') + '/inthecircle-seo-enhancements.php';
  } else {
    const themePath = remoteTheme.replace(/^\/+/, '');
    const base = themePath.replace(/\/themes\/[^/]+$/, '') || `public_html/wp-content`;
    remoteFile = `${base}/plugins/${pluginFolder}/inthecircle-seo-enhancements.php`.replace(/\/+/g, '/');
  }

  const ftpUrl = `ftp://${user}:${encodeURIComponent(password)}@${host}/${remoteFile}`;

  console.log('Uploading plugin (no sticky bar) to server...');
  console.log('  Local:', PLUGIN_PHP);
  console.log('  Remote:', remoteFile);

  try {
    execSync(`curl -T "${PLUGIN_PHP}" "${ftpUrl}"`, { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 });
    console.log('\nUpload succeeded. Hard refresh the site (and purge LiteSpeed cache); the black bar should be gone.');
  } catch (e) {
    if (e.status === 550) {
      console.error('\nServer returned 550: folder or file path may not exist.');
      console.error('Check that the plugin folder exists. Remote path used:', remoteFile);
      console.error('If your plugin folder is named "wordpress-seo", add to .env.sftp:');
      console.error('  WP_PLUGIN_FOLDER=wordpress-seo');
    }
    process.exit(1);
  }
}

main();
