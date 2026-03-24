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
const MU_PLUGIN_PHP = path.join(ROOT, 'mu-plugins', 'itc-hide-legacy-sticky-cta.php');

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
  let wpContentBase;
  if (pluginPathOverride) {
    remoteFile = pluginPathOverride.replace(/\/$/, '') + '/inthecircle-seo-enhancements.php';
    wpContentBase = pluginPathOverride.replace(/\/plugins\/[^/]+$/, '').replace(/\/$/, '');
  } else {
    const themePath = remoteTheme.replace(/^\/+/, '');
    wpContentBase = themePath.replace(/\/themes\/[^/]+$/, '') || `public_html/wp-content`;
    remoteFile = `${wpContentBase}/plugins/${pluginFolder}/inthecircle-seo-enhancements.php`.replace(/\/+/g, '/');
  }

  const ftpUrl = `ftp://${user}:${encodeURIComponent(password)}@${host}/${remoteFile}`;

  console.log('Uploading plugin (no sticky bar) to server...');
  console.log('  Local:', PLUGIN_PHP);
  console.log('  Remote:', remoteFile);

  try {
    // --ftp-pasv: required on many shared hosts; --ftp-create-dirs: ensure plugin folder exists
    execSync(
      `curl -sS --fail --ftp-pasv --ftp-create-dirs -T "${PLUGIN_PHP}" "${ftpUrl}"`,
      { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 }
    );
    console.log('\nMain plugin upload succeeded.');

    if (fs.existsSync(MU_PLUGIN_PHP)) {
      const muRemote = `${wpContentBase}/mu-plugins/itc-hide-legacy-sticky-cta.php`.replace(/\/+/g, '/');
      const muUrl = `ftp://${user}:${encodeURIComponent(password)}@${host}/${muRemote}`;
      console.log('\nUploading must-use helper (hides #itc-sticky-cta even if PHP OPcache is stale)...');
      console.log('  Local:', MU_PLUGIN_PHP);
      console.log('  Remote:', muRemote);
      execSync(
        `curl -sS --fail --ftp-pasv --ftp-create-dirs -T "${MU_PLUGIN_PHP}" "${muUrl}"`,
        { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 }
      );
      console.log('\nMU-plugin upload succeeded.');
    }

    console.log('\nDone. Purge LiteSpeed cache if needed; hard-refresh the homepage.');
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
