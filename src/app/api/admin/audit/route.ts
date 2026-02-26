import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import {
  writeAuditLog,
  validateReasonForDestructive,
  checkDestructiveRateLimit,
  DESTRUCTIVE_ACTIONS,
} from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 1000
const MAX_CSV_ROWS = 1000

function parseIsoDate(s: string | null): string | null {
  if (!s || typeof s !== 'string') return null
  const trimmed = s.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function escapeCsvCell(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  const needsQuotes = /[",\n\r]/.test(s)
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s
}

/** GET - List audit log. Requires read_audit; export requires export_audit. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const params = req.nextUrl.searchParams
  const format = (params.get('format') ?? 'json').toLowerCase() === 'csv' ? 'csv' : 'json'
  const perm = format === 'csv' ? ADMIN_PERMISSIONS.export_audit : ADMIN_PERMISSIONS.read_audit
  const forbidden = requirePermission(result, perm)
  if (forbidden) return forbidden
  const { supabase } = result
  const adminUserId = params.get('admin_user_id')?.trim() || null
  const actionParam = params.get('action')?.trim() || null
  const targetType = params.get('target_type')?.trim() || null
  const targetId = params.get('target_id')?.trim() || null
  const dateFrom = parseIsoDate(params.get('date_from'))
  const dateTo = parseIsoDate(params.get('date_to'))
  const limit = Math.min(
    Math.max(1, Number(params.get('limit')) || 50),
    MAX_LIMIT
  )
  const offset = Math.max(0, Number(params.get('offset')) || 0)

  if (adminUserId && !/^[0-9a-f-]{36}$/i.test(adminUserId)) {
    return NextResponse.json({ error: 'invalid admin_user_id' }, { status: 400 })
  }

  let query = supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })

  if (adminUserId) query = query.eq('admin_user_id', adminUserId)
  if (targetType) query = query.eq('target_type', targetType)
  if (targetId) query = query.eq('target_id', targetId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  if (actionParam) {
    query = query.ilike('action', `%${actionParam.replace(/%/g, '\\%')}%`)
  }

  const cap = format === 'csv' ? Math.min(limit, MAX_CSV_ROWS) : limit
  query = query.range(offset, offset + cap - 1)

  const { data, error } = await query

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }
  const entries = data ?? []

  if (format === 'csv') {
    const headers = [
      'id',
      'admin_user_id',
      'admin_email',
      'action',
      'target_type',
      'target_id',
      'details',
      'reason',
      'client_ip',
      'session_id',
      'created_at',
    ]
    const rows = entries.map((e: Record<string, unknown>) =>
      headers.map((h) => escapeCsvCell(e[h]))
    )
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  return NextResponse.json({ entries })
}

/** POST - Append an audit log entry. Destructive actions require corresponding permission. */
export async function POST(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const { user, supabase } = result

  const body = await req.json().catch(() => ({}))
  const { action, target_type, target_id, details, reason } = body

  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action required' }, { status: 400 })
  }

  if (DESTRUCTIVE_ACTIONS.has(action)) {
    const perm =
      action === 'user_delete'
        ? ADMIN_PERMISSIONS.delete_users
        : action === 'user_anonymize'
          ? ADMIN_PERMISSIONS.anonymize_users
          : ADMIN_PERMISSIONS.bulk_applications
    const forbidden = requirePermission(result, perm)
    if (forbidden) return forbidden
  }

  const reasonErr = validateReasonForDestructive(action, reason)
  if (reasonErr) {
    return NextResponse.json({ error: reasonErr }, { status: 400 })
  }

  if (DESTRUCTIVE_ACTIONS.has(action)) {
    const rateErr = await checkDestructiveRateLimit(supabase, user.id, action, 1)
    if (rateErr) {
      return NextResponse.json(
        { error: rateErr },
        { status: 429, headers: { 'Retry-After': '3600' } }
      )
    }
  }

  const { error: insertError } = await writeAuditLog(supabase, req, user, {
    action,
    target_type: target_type ?? null,
    target_id: target_id ?? null,
    details: details ?? {},
    reason: reason ?? null,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
