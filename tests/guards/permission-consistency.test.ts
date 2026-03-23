/**
 * PERMISSION CONSISTENCY — Every non-gate route must call requireAdmin();
 * every mutation (POST/PATCH/DELETE/PUT) must call requirePermission().
 */

import * as fs from 'fs'
import * as path from 'path'

const API_ADMIN_ROOT = path.join(process.cwd(), 'src', 'app', 'api', 'admin')

/** Routes that intentionally do not call requireAdmin (e.g. gate, identity). */
const REQUIRE_ADMIN_EXCLUDED: Set<string> = new Set([
  'gate',
  'identity',
  // Public admin sign-in endpoint by design.
  'sign-in',
])

const MUTATION_METHODS = ['POST', 'PATCH', 'DELETE', 'PUT']

function* walkRouteFiles(dir: string, baseDir: string): Generator<{ key: string; file: string }> {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkRouteFiles(full, baseDir)
    } else if (e.isFile() && e.name === 'route.ts') {
      const relative = path.relative(baseDir, path.dirname(full))
      yield { key: relative, file: full }
    }
  }
}

function hasExport(content: string, method: string): boolean {
  return new RegExp(`export\\s+async\\s+function\\s+${method}\\b|export\\s+const\\s+${method}\\s*=`).test(content)
}

describe('Permission consistency', () => {
  it('every non-excluded admin route must call requireAdmin()', () => {
    const missing: string[] = []
    for (const { key, file } of walkRouteFiles(API_ADMIN_ROOT, API_ADMIN_ROOT)) {
      if (REQUIRE_ADMIN_EXCLUDED.has(key)) continue
      const content = fs.readFileSync(file, 'utf8')
      if (!content.includes('requireAdmin(')) missing.push(key)
    }
    missing.sort()
    expect(missing).toEqual([])
  })

  it('every route that exports a mutation (POST/PATCH/DELETE/PUT) must call requirePermission()', () => {
    const missing: string[] = []
    for (const { key, file } of walkRouteFiles(API_ADMIN_ROOT, API_ADMIN_ROOT)) {
      if (REQUIRE_ADMIN_EXCLUDED.has(key)) continue
      const content = fs.readFileSync(file, 'utf8')
      const hasMutation = MUTATION_METHODS.some((m) => hasExport(content, m))
      if (hasMutation && !content.includes('requirePermission(')) missing.push(key)
    }
    missing.sort()
    expect(missing).toEqual([])
  })
})
