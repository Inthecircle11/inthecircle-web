import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { writeAuditLog } from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

const ESCALATION_DEDUPE_HOURS = 24
const OVERDUE_DATA_REQUEST_HOURS = 24

/** Thresholds: [yellow, red]. Escalate when value >= threshold. */
const THRESHOLDS: Record<string, [number, number]> = {
  pending_applications: [20, 50],
  pending_reports: [10, 25],
  overdue_data_requests: [3, 10],
}

function getThresholdLevel(metricName: string, value: number): 'yellow' | 'red' | null {
  const [yellow, red] = THRESHOLDS[metricName] ?? [999999, 999999]
  if (value >= red) return 'red'
  if (value >= yellow) return 'yellow'
  return null
}

/** GET - Risk dashboard: KPIs + open escalations + last escalation time. Triggers new escalations when metrics cross thresholds (dedupe 24h per metric). Requires read_risk. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_risk)
  if (forbidden) return forbidden

  const supabase = getServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const now = new Date()
  const since24h = new Date(now.getTime() - ESCALATION_DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const overdueCutoff = new Date(now.getTime() - OVERDUE_DATA_REQUEST_HOURS * 60 * 60 * 1000).toISOString()

  // Count pending applications (status in pending set)
  const { count: pendingAppsCount } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .in('status', ['SUBMITTED', 'PENDING_REVIEW', 'DRAFT', 'PENDING'])

  // Count pending reports
  const { count: pendingReportsCount } = await supabase
    .from('user_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Count overdue data requests (pending and created before cutoff)
  const { count: overdueDataRequestsCount } = await supabase
    .from('data_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', overdueCutoff)

  const pending_applications = pendingAppsCount ?? 0
  const pending_reports = pendingReportsCount ?? 0
  const overdue_data_requests = overdueDataRequestsCount ?? 0

  // Trigger new escalations when metrics cross thresholds (dedupe: no duplicate per metric in last 24h)
  const metrics = [
    { name: 'pending_applications', value: pending_applications },
    { name: 'pending_reports', value: pending_reports },
    { name: 'overdue_data_requests', value: overdue_data_requests },
  ] as const

  for (const { name, value } of metrics) {
    const level = getThresholdLevel(name, value)
    if (!level) continue

    const { data: recent } = await supabase
      .from('admin_escalations')
      .select('id')
      .eq('metric_name', name)
      .gte('created_at', since24h)
      .limit(1)
    if (recent && recent.length > 0) continue

    const { data: inserted, error: insertErr } = await supabase
      .from('admin_escalations')
      .insert({
        metric_name: name,
        metric_value: value,
        threshold_level: level,
        status: 'open',
      })
      .select('id')
      .single()

    if (!insertErr && inserted) {
      await writeAuditLog(supabase, req, result.user, {
        action: 'escalation_create',
        target_type: 'escalation',
        target_id: (inserted as { id: string }).id,
        details: { metric_name: name, metric_value: value, threshold_level: level },
      })
    }
  }

  // Fetch open escalations and latest escalation time (after trigger so new ones are visible)
  const { data: openRows } = await supabase
    .from('admin_escalations')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const { data: latestRow } = await supabase
    .from('admin_escalations')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const open_escalations = (openRows ?? []) as Array<Record<string, unknown>>
  const last_escalation_time = latestRow?.created_at ?? null

  return NextResponse.json({
    pending_applications,
    pending_reports,
    overdue_data_requests,
    open_escalations,
    last_escalation_time,
  })
}
