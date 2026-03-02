/**
 * RPC GUARDRAIL — No client-side admin RPC.
 * Fails if any file under src/app/admin contains supabase.rpc('admin_ or .rpc("admin_
 */

import * as fs from 'fs'
import * as path from 'path'

const ADMIN_UI_ROOT = path.join(process.cwd(), 'src', 'app', 'admin')
const RPC_PATTERN = /\.rpc\s*\(\s*['"]admin_/

function* walk(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(tsx?|jsx?|mjs|cjs)$/.test(e.name)) yield full
  }
}

describe('RPC guardrail', () => {
  it('no file under src/app/admin must call supabase.rpc("admin_*")', () => {
    const violations: { file: string; line: number; snippet: string }[] = []
    for (const file of walk(ADMIN_UI_ROOT)) {
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (RPC_PATTERN.test(lines[i])) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: i + 1,
            snippet: lines[i].trim().slice(0, 80),
          })
        }
      }
    }
    expect(violations).toEqual([])
  })
})
