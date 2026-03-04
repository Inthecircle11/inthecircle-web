import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminSuccess, adminErrorFromResponse, getAdminRequestId } from '@/lib/admin-response'

export const dynamic = 'force-dynamic'

/** GET - Identity check: returns app name so admin UI can detect wrong deployment. Requires admin auth. */
export async function GET(req: NextRequest) {
  const requestId = getAdminRequestId(req)
  const result = await requireAdmin(req)
  if ('response' in result) return adminErrorFromResponse(result.response, requestId)
  return adminSuccess(
    {
      app: 'inthecircle-web',
      hint: 'If you see a different admin UI, run: npm run deploy from inthecircle-web repo',
    },
    requestId
  )
}
