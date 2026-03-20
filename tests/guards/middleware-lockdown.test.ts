/**
 * Ensures global "send everyone to /download" lockdown stays behind WEB_LOCKDOWN only.
 */
import fs from 'fs'
import path from 'path'

describe('middleware lockdown guard', () => {
  it('redirect to /download must be gated by WEB_LOCKDOWN', () => {
    const p = path.join(__dirname, '..', '..', 'src', 'middleware.ts')
    const src = fs.readFileSync(p, 'utf8')
    const redirectNeedle = "url.pathname = '/download'"
    const idxRedirect = src.indexOf(redirectNeedle)
    if (idxRedirect === -1) {
      // No redirect — nothing to guard
      return
    }
    const idxLock = src.indexOf("process.env.WEB_LOCKDOWN === 'true'")
    expect(idxLock).toBeGreaterThan(-1) // WEB_LOCKDOWN gate must exist when /download redirect exists
    expect(idxLock).toBeLessThan(idxRedirect) // gate must appear before redirect
  })
})
