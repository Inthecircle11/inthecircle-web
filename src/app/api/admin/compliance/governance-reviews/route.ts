import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

/** GET - List quarterly governance reviews. Requires read_audit. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: rows, error } = await supabase
    .from('admin_governance_reviews')
    .select('id, review_period, reviewer, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ reviews: rows ?? [] })
}

/** POST - Create a quarterly governance review. Requires read_audit (compliance officer). */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_audit)
  if (forbidden) return forbidden

  const body = await req.json().catch(() => ({}))
  const reviewPeriod = typeof body.review_period === 'string' ? body.review_period.trim() : null
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 10000) : null

  if (!reviewPeriod) {
    return NextResponse.json({ error: 'review_period required (e.g. 2025-Q1)' }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: inserted, error } = await supabase
    .from('admin_governance_reviews')
    .insert({
      review_period: reviewPeriod,
      reviewer: result.user.id,
      summary: summary || null,
    })
    .select('id, review_period, reviewer, summary, created_at')
    .single()

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, review: inserted })
}
