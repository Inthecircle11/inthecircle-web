/**
 * ROUTE COVERAGE — Every admin API route must have at least one test reference.
 * Scans src/app/api/admin for route.ts files and tests/admin.integration.test.ts
 * for references (import or path string). Fails if any route is uncovered.
 */

import * as fs from 'fs'
import * as path from 'path'

const API_ADMIN_ROOT = path.join(process.cwd(), 'src', 'app', 'api', 'admin')
const INTEGRATION_TEST = path.join(process.cwd(), 'tests', 'admin.integration.test.ts')

/** Route keys that are excluded from coverage (e.g. gate, identity). Add new routes here only if explicitly not covered. */
const COVERAGE_EXCLUDED: Set<string> = new Set([
  'gate',
  'identity',
])

function* walkRouteFiles(dir: string, baseDir: string): Generator<string> {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkRouteFiles(full, baseDir)
    } else if (e.isFile() && e.name === 'route.ts') {
      const relative = path.relative(baseDir, path.dirname(full))
      yield relative
    }
  }
}

function getCoveredKeys(testContent: string): Set<string> {
  const covered = new Set<string>()
  // import('@/app/api/admin/.../route') or "/api/admin/..."
  const importRe = /@\/app\/api\/admin\/([^'"]+?)(?:\/route)?['"]/g
  const pathRe = /['"`]\/api\/admin\/([^'"]+)['"`]/g
  // Any occurrence of api/admin/... (e.g. coverage constant or comment)
  const anyRe = /api\/admin\/([a-zA-Z0-9\/_[\]-]+)/g
  let m: RegExpExecArray | null
  while ((m = importRe.exec(testContent)) !== null) {
    covered.add(m[1].replace(/\/route$/, ''))
  }
  while ((m = pathRe.exec(testContent)) !== null) {
    covered.add(m[1].replace(/\/route$/, ''))
  }
  while ((m = anyRe.exec(testContent)) !== null) {
    covered.add(m[1])
  }
  return covered
}

describe('Route coverage', () => {
  it('every admin route (except excluded) must be referenced in admin.integration.test.ts', () => {
    const routeKeys = new Set(walkRouteFiles(API_ADMIN_ROOT, API_ADMIN_ROOT))
    const testContent = fs.existsSync(INTEGRATION_TEST)
      ? fs.readFileSync(INTEGRATION_TEST, 'utf8')
      : ''
    const covered = getCoveredKeys(testContent)

    const uncovered: string[] = []
    for (const key of routeKeys) {
      if (COVERAGE_EXCLUDED.has(key)) continue
      if (!covered.has(key)) uncovered.push(key)
    }
    uncovered.sort()

    expect(uncovered).toEqual([])
  })
})
