import { NextRequest } from 'next/server'
import { adminSuccess, getAdminRequestId } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - Identity check: returns app name so admin UI can detect wrong deployment. No auth required. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  return adminSuccess(
    {
      app: 'inthecircle-web',
      hint: 'If you see a different admin UI, run: npm run deploy from inthecircle-web repo',
    },
    requestId
  )
}
