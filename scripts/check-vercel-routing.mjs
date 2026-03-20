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

// HARDENING: Multiple checks to prevent routing regressions
const rewrites = config.rewrites
if (Array.isArray(rewrites)) {
  const violations = []
  for (const rule of rewrites) {
    const dest = rule?.destination ?? ''
    const source = rule?.source ?? ''
    
    // Check 1: No *.html destinations (legacy static shell)
    if (typeof dest === 'string' && /\.html(\/|$|\?|#)/i.test(dest)) {
      violations.push(`Rewrite "${source}" → "${dest}" points to legacy HTML file`)
    }
    
    // Check 2: No rewrites for core app routes (Next.js owns these)
    const coreRoutes = ['^/$', '^/signup', '^/login', '^/admin', '^/feed', '^/forgot-password']
    for (const route of coreRoutes) {
      const re = new RegExp(route.replace('^', ''))
      if (re.test(source) && dest && !dest.startsWith('/api/')) {
        violations.push(`Rewrite "${source}" → "${dest}" shadows Next.js route ${source}`)
      }
    }
  }
  
  if (violations.length > 0) {
    console.error('check-vercel-routing: BLOCKED — vercel.json contains forbidden rewrites:\n')
    violations.forEach(v => console.error(`  ❌ ${v}`))
    console.error('\n  Next.js App Router owns these routes. Remove static HTML rewrites.')
    console.error('  See DEPLOYMENT.md → "Legacy vercel.json rewrites"')
    console.error('  See .cursor/rules/vercel-next-routing.mdc')
    process.exit(1)
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
