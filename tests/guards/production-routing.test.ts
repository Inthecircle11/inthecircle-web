/**
 * Production smoke test: ensures production isn't serving legacy static HTML.
 * This test can be run against production URL to catch regressions that slip through.
 */
describe('production routing guard', () => {
  const PROD_URL = process.env.PRODUCTION_URL || 'https://app.inthecircle.co'

  it('home page should NOT be static "Coming Soon" HTML', async () => {
    if (process.env.SKIP_PROD_TESTS === 'true') {
      return // Skip in CI unless explicitly enabled
    }
    const res = await fetch(`${PROD_URL}/`, { redirect: 'follow' })
    const html = await res.text()
    // Legacy static page has these markers
    const isLegacyStatic = 
      html.includes('We\'re building something new. Stay tuned.') ||
      html.includes('<title>Inthecircle – Coming Soon</title>') ||
      (html.includes('index.html') && !html.includes('next'))
    
    expect(isLegacyStatic).toBe(false)
    expect(res.status).toBe(200)
  }, 30000)

  it('forgot-password should be Next.js page, not 404', async () => {
    if (process.env.SKIP_PROD_TESTS === 'true') {
      return
    }
    const res = await fetch(`${PROD_URL}/forgot-password`, { redirect: 'follow' })
    expect(res.status).not.toBe(404)
    const html = await res.text()
    // Should have Next.js markers or the actual form
    const isNextApp = html.includes('Reset password') || html.includes('_next') || html.includes('next')
    expect(isNextApp).toBe(true)
  }, 30000)

  it('health/routing endpoint should report clean config', async () => {
    if (process.env.SKIP_PROD_TESTS === 'true') {
      return
    }
    const res = await fetch(`${PROD_URL}/api/health/routing`, { redirect: 'follow' })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('ok')
  }, 30000)
})
