#!/usr/bin/env node
/**
 * Migration safety check: ALTER FUNCTION admin_* must have a CREATE (or CREATE OR REPLACE)
 * somewhere in the migration set. Fails if any ALTER targets an admin_* function that is
 * never created in any migration.
 *
 * Usage: node scripts/check-migrations.mjs
 * Exit: 0 if ok, 1 if violation.
 */

import fs from 'fs'
import path from 'path'

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
if (!fs.existsSync(migrationsDir)) {
  console.error('Migrations dir not found:', migrationsDir)
  process.exit(1)
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
const created = new Set()
const altered = new Set()

// Functions that are ALTERed in migrations but created elsewhere (e.g. prior to migration set). Do not add new names here.
const ALTER_ONLY_ALLOWLIST = new Set([
  'admin_get_applications_fast',
  'admin_get_application_counts',
  'admin_get_all_stats',
])

// Match CREATE [OR REPLACE] FUNCTION public.admin_XXX
const createRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(admin_\w+)/gi
// Match ALTER FUNCTION public.admin_XXX (and dynamic EXECUTE format('ALTER FUNCTION public.admin_XXX ...')
const alterRe = /ALTER\s+FUNCTION\s+public\.(admin_\w+)/gi
const alterDynamicRe = /format\s*\(\s*['"]ALTER\s+FUNCTION\s+public\.(admin_\w+)/gi

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
  let m
  createRe.lastIndex = 0
  while ((m = createRe.exec(content)) !== null) created.add(m[1].toLowerCase())
  alterRe.lastIndex = 0
  while ((m = alterRe.exec(content)) !== null) altered.add(m[1].toLowerCase())
  alterDynamicRe.lastIndex = 0
  while ((m = alterDynamicRe.exec(content)) !== null) altered.add(m[1].toLowerCase())
}

const alteredWithoutCreate = [...altered].filter(
  (name) => !created.has(name) && !ALTER_ONLY_ALLOWLIST.has(name)
)
if (alteredWithoutCreate.length > 0) {
  console.error('Migration safety check failed: ALTER FUNCTION admin_* without CREATE in migration set:')
  alteredWithoutCreate.forEach((n) => console.error('  -', n))
  console.error('Add a migration that CREATEs (or CREATE OR REPLACE) these functions, or remove the ALTER.')
  process.exit(1)
}

console.log('check-migrations: ok (all ALTER FUNCTION admin_* have CREATE in migration set)')
