#!/usr/bin/env node
/**
 * Upload ITC landing template and images via SFTP.
 * Reads credentials from wordpress-seo/.env.sftp (see .env.sftp.example).
 *
 * Steps: upload PHP, create assets/images, upload 9 PNGs, verify all.
 * Usage: node scripts/upload-itc-landing-sftp.mjs
 */

import SftpClient from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const THEME_DIR = path.join(ROOT, 'theme-extendable');
const PHP_FILE = path.join(THEME_DIR, 'page-itc-landing.php');
const ASSETS_IMAGES = path.join(THEME_DIR, 'assets', 'images');

const PNG_FILES = [
  'itc-landing-1.png', 'itc-landing-2.png', 'itc-landing-3.png', 'itc-landing-4.png',
  'itc-landing-5.png', 'itc-landing-6.png', 'itc-landing-7.png', 'itc-landing-8.png', 'itc-landing-9.png',
];

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

function sftpConfig() {
  const host = process.env.WP_SFTP_HOST;
  const user = process.env.WP_SFTP_USER;
  const port = parseInt(process.env.WP_SFTP_PORT || '22', 10);
  const password = process.env.WP_SFTP_PASSWORD;
  const keyPath = process.env.WP_SFTP_KEY;

  const config = {
    host,
    port,
    username: user,
    readyTimeout: 20000,
  };
  if (keyPath && fs.existsSync(keyPath)) {
    config.privateKey = fs.readFileSync(keyPath, 'utf8');
  } else if (password) {
    config.password = password;
  }
  return config;
}

async function main() {
  loadEnv();

  const host = process.env.WP_SFTP_HOST;
  const user = process.env.WP_SFTP_USER;
  const remoteBase = (process.env.WP_SFTP_REMOTE_PATH || 'wp-content/themes/extendable').replace(/\/$/, '');

  if (!host || !user) {
    console.error('Missing SFTP config. Set WP_SFTP_HOST and WP_SFTP_USER in wordpress-seo/.env.sftp');
    console.error('See .env.sftp.example. Also set WP_SFTP_PASSWORD or WP_SFTP_KEY.');
    process.exit(1);
  }

  if (!fs.existsSync(PHP_FILE)) {
    console.error('Missing', PHP_FILE);
    process.exit(1);
  }
  if (!fs.existsSync(ASSETS_IMAGES)) {
    console.error('Missing', ASSETS_IMAGES);
    process.exit(1);
  }

  const config = sftpConfig();
  const sftp = new SftpClient();

  try {
    const port = config.port || 22;
    console.log('Connecting to', host + ':' + port, 'as', user, '...');
    await sftp.connect(config);

    // 3. Upload page-itc-landing.php
    const remotePhp = `${remoteBase}/page-itc-landing.php`;
    console.log('Uploading page-itc-landing.php ->', remotePhp);
    await sftp.put(PHP_FILE, remotePhp);
    console.log('  OK');

    // 4. Create assets/images/
    const remoteImagesDir = `${remoteBase}/assets/images`;
    console.log('Creating directory', remoteImagesDir);
    await sftp.mkdir(remoteImagesDir, true);
    console.log('  OK');

    // 5. Upload 9 PNGs
    console.log('Uploading 9 PNG files...');
    for (const name of PNG_FILES) {
      const local = path.join(ASSETS_IMAGES, name);
      const remote = `${remoteImagesDir}/${name}`;
      await sftp.put(local, remote);
      console.log('  ', name, '-> OK');
    }

    // 6. Verify
    console.log('Verifying files on server...');
    const phpExists = await sftp.exists(remotePhp);
    if (phpExists) console.log('  page-itc-landing.php: exists');
    else throw new Error('page-itc-landing.php not found after upload');

    const list = await sftp.list(remoteImagesDir);
    const names = list.filter((e) => e.type === '-' && e.name.endsWith('.png')).map((e) => e.name);
    const expected = new Set(PNG_FILES);
    for (const n of expected) {
      if (!names.includes(n)) throw new Error('Missing on server: ' + n);
    }
    console.log('  assets/images/:', names.length, 'PNG files verified');

    console.log('\nAll uploads succeeded.');
    console.log('Live URL to check: https://inthecircle.co/');
  } finally {
    await sftp.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
