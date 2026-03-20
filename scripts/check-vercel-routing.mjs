#!/usr/bin/env node
/**
 * Prevents regressions where vercel.json "rewrites" send traffic to legacy root *.html
 * (Coming Soon, static signup, static admin). That shadows Next.js App Router and looks
 * like the "wrong" or broken webapp.
 *
 * Usage: node scripts/check-vercel-routing.mjs
 * Exit: 0 ok, 1 violation.
 */

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const vercelPath = path.join(root, 'vercel.json')

if (!fs.existsSync(vercelPath)) {
  process.exit(0)
}

let raw
try {
  raw = fs.readFileSync(vercelPath, 'utf8')
} catch (e) {
  console.error('check-vercel-routing: cannot read vercel.json:', e.message)
  process.exit(1)
}

let config
try {
  config = JSON.parse(raw)
} catch (e) {
  console.error('check-vercel-routing: vercel.json is not valid JSON:', e.message)
  process.exit(1)
}

const rewrites = config.rewrites
if (Array.isArray(rewrites)) {
  for (const rule of rewrites) {
    const dest = rule?.destination ?? ''
    if (typeof dest === 'string' && /\.html(\/|$|\?|#)/i.test(dest)) {
      console.error(
        'check-vercel-routing: vercel.json rewrites must not point to *.html (legacy static shell).\n' +
          `  Forbidden destination: ${JSON.stringify(dest)}\n` +
          '  Next.js App Router owns /. Remove static index.html/signup.html/admin rewrites.\n' +
          '  See DEPLOYMENT.md → "Legacy vercel.json rewrites".'
      )
      process.exit(1)
    }
  }
}

// Empty static-export style keys break or confuse Next on Vercel
if (config.outputDirectory != null && String(config.outputDirectory).trim() !== '') {
  console.error(
    'check-vercel-routing: remove `outputDirectory` from vercel.json for this Next.js app (unless you truly use static export).'
  )
  process.exit(1)
}

if (config.buildCommand === '') {
  console.error(
    'check-vercel-routing: remove empty `buildCommand` from vercel.json (let Vercel use the Next.js build).'
  )
  process.exit(1)
}

console.log('check-vercel-routing: OK (no legacy HTML rewrites).')
