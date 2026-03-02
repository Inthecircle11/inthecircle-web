import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_HEADER = 'x-admin-internal'
const REQUEST_ID_HEADER = 'x-request-id'

function parseCommaList(env: string | undefined): string[] {
  if (!env?.trim()) return []
  return env.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Phase 13: Add x-request-id for /api/admin routes (used by route wrapper). */
function addRequestId(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith('/api/admin/')) return null
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, crypto.randomUUID())
  return NextResponse.next({ request: { headers: requestHeaders } })
}

/**
 * When ADMIN_BASE_PATH is set, only that path serves the admin panel.
 * Direct /admin and /admin/* return 404. Use a LONG random string (24+ chars) for security.
 * Optional ADMIN_ALLOWED_IPS: comma-separated IPs; only those can reach admin.
 * Note: middleware cannot read runtime env on Vercel; obscure path is handled by next.config rewrites.
 */
export function middleware(request: NextRequest) {
  const requestIdResponse = addRequestId(request)
  if (requestIdResponse) return requestIdResponse

  const basePath = process.env.ADMIN_BASE_PATH?.trim()
  const pathname = request.nextUrl.pathname

  if (!basePath || pathname.length < 2) {
    return NextResponse.next()
  }

  const pathLower = pathname.toLowerCase()
  const baseLower = basePath.toLowerCase()
  const segment =
    pathLower === `/${baseLower}` ||
    pathLower === `/${baseLower}/` ||
    pathLower.startsWith(`/${baseLower}/`)

  // Common typo: admin path with an extra slash (e.g. /K7x2mN9pQ4/T1vW6yB0cD3eF8gH2jL5n).
  // Redirect to the correct single path so the panel loads.
  if (!segment && pathname.startsWith('/') && pathname.length > 2) {
    const noLeading = pathname.slice(1)
    const onePath = noLeading.replace(/\/+/g, '')
    if (onePath.toLowerCase() === baseLower) {
      const url = request.nextUrl.clone()
      url.pathname = `/${basePath}`
      return NextResponse.redirect(url, 301)
    }
    // Typo: path has one slash where there should be "r".
    const parts = noLeading.split('/').filter(Boolean)
    if (parts.length === 2 && (parts[0] + 'r' + parts[1]).toLowerCase() === baseLower) {
      const url = request.nextUrl.clone()
      url.pathname = `/${basePath}`
      return NextResponse.redirect(url, 301)
    }
  }

  if (segment) {
    const allowedIps = parseCommaList(process.env.ADMIN_ALLOWED_IPS)
    if (allowedIps.length > 0) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? ''
      if (!allowedIps.includes(ip)) {
        return new NextResponse(null, { status: 403 })
      }
    }

    const rewritePath = pathLower === `/${baseLower}/login` ? '/admin/login' : '/admin'
    const url = request.nextUrl.clone()
    url.pathname = rewritePath
    const headers = new Headers(request.headers)
    headers.set(ADMIN_HEADER, basePath)
    headers.set('x-admin-base-path', basePath)
    return NextResponse.rewrite(url, { request: { headers } })
  }

  // When ADMIN_BASE_PATH is set, direct /admin is normally 404. Allow it if ADMIN_ALLOW_DIRECT_ACCESS=true (recovery).
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const allowDirect = process.env.ADMIN_ALLOW_DIRECT_ACCESS === 'true'
    const hasInternalHeader = request.headers.get(ADMIN_HEADER) === basePath
    if (!hasInternalHeader && !allowDirect) {
      return new NextResponse(null, { status: 404 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|api/|auth/|favicon|icon\\.svg|.*\\.).*)', '/api/admin/:path*'],
}
