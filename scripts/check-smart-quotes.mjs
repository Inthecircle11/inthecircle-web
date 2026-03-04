#!/usr/bin/env node
/**
 * Fail if source files under src/ contain Unicode smart/curly quotes.
 * These can cause parse/syntax errors during build (e.g. in JSX strings).
 *
 * Usage: node scripts/check-smart-quotes.mjs
 * Exit: 0 if none found, 1 if any file contains curly quotes (and list them).
 */

import fs from 'fs'
import path from 'path'

const srcDir = path.join(process.cwd(), 'src')
const ext = /\.(ts|tsx|js|jsx)$/

// Unicode curly/smart quotes and apostrophes that break or confuse parsers
const SMART_QUOTES = [
  '\u2018', // '
  '\u2019', // '
  '\u201A', // ‚
  '\u201B', // ‛
  '\u201C', // “
  '\u201D', // "
  '\u201E', // „
  '\u201F', // ‟
  '\u2039', // ‹
  '\u203A', // ›
]

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, list)
    else if (ext.test(e.name)) list.push(full)
  }
  return list
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const found = []
  for (const q of SMART_QUOTES) {
    const idx = content.indexOf(q)
    if (idx !== -1) {
      const line = content.slice(0, idx).split('\n').length
      found.push({ char: q, line })
    }
  }
  return found
}

const files = walk(srcDir)
const violations = []
for (const f of files) {
  const rel = path.relative(process.cwd(), f)
  const hits = checkFile(f)
  if (hits.length) violations.push({ file: rel, hits })
}

if (violations.length === 0) {
  process.exit(0)
}

console.error('Smart/curly quotes found in source (use straight ASCII quotes):')
for (const { file, hits } of violations) {
  const details = hits.map((h) => `line ${h.line} (U+${h.char.codePointAt(0).toString(16)})`).join(', ')
  console.error(`  ${file}: ${details}`)
}
process.exit(1)
