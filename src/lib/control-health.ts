/**
 * Phase 8: Continuous Control Monitoring.
 * Runs health checks per control_code, computes status and score (0-100).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyChain } from '@/lib/audit-verify'
import type { AuditRow } from '@/lib/audit-verify'

const VERIFY_PAGE_SIZE = 5000
const GOVERNANCE_REVIEW_DAYS = 90
const ESCALATION_WARNING_HOURS = 48
const SESSION_ANOMALY_THRESHOLD = 5
const OVERDUE_DATA_REQUEST_HOURS = 24

export type HealthStatus = 'healthy' | 'warning' | 'failed'

export interface ControlHealthResult {
  control_code: string
  status: HealthStatus
  score: number
  notes: string | null
}

/** CC6.1: No admin has both moderator + super_admin; at least 1 super_admin. */
async function checkCC61(supabase: SupabaseClient): Promise<ControlHealthResult> {
  const { data: assignments } = await supabase
    .from('admin_user_roles')
    .select('admin_user_id, admin_roles(name)')
  const byUser = new Map<string, Set<string>>()
  let hasSuperAdmin = false
  for (const row of assignments ?? []) {
    const r = row as { admin_user_id: string; admin_roles: { name: string } | { name: string }[] }
    const name = Array.isArray(r.admin_roles) ? r.admin_roles[0]?.name : (r.admin_roles as { name: string })?.name
    if (!name) continue
    if (!byUser.has(r.admin_user_id)) byUser.set(r.admin_user_id, new Set())
    byUser.get(r.admin_user_id)!.add(name)
    if (name === 'super_admin') hasSuperAdmin = true
  }
  let conflict = false
  for (const roles of byUser.values()) {
    if (roles.has('moderator') && roles.has('super_admin')) conflict = true
  }
  if (conflict) {
    return { control_code: 'CC6.1', status: 'failed', score: 0, notes: 'An admin has both moderator and super_admin' }
  }
  if (!hasSuperAdmin) {
    return { control_code: 'CC6.1', status: 'failed', score: 0, notes: 'No super_admin exists' }
  }
  return { control_code: 'CC6.1', status: 'healthy', score: 100, notes: null }
}

/** CC7.2: Audit chain valid. */
async function checkCC72(supabase: SupabaseClient): Promise<ControlHealthResult> {
  const rows: AuditRow[] = []
  let offset = 0
  let hasMore = true
  while (hasMore && rows.length < 100_000) {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id, admin_user_id, action, target_type, target_id, details, created_at, previous_hash, row_hash')
      .order('created_at', { ascending: true })
      .range(offset, offset + VERIFY_PAGE_SIZE - 1)
    if (error) {
      return { control_code: 'CC7.2', status: 'failed', score: 0, notes: error.message }
    }
    const chunk = (data ?? []) as AuditRow[]
    rows.push(...chunk)
    hasMore = chunk.length === VERIFY_PAGE_SIZE
    offset += VERIFY_PAGE_SIZE
  }
  const result = verifyChain(rows)
  if (!result.valid) {
    return {
      control_code: 'CC7.2',
      status: 'failed',
      score: 0,
      notes: result.firstCorruptedId ? `Chain broken at row ${result.firstCorruptedId}` : 'Chain invalid',
    }
  }
  return { control_code: 'CC7.2', status: 'healthy', score: 100, notes: null }
}

/** CC7.3: Open escalations > 0 for > 48h → warning. */
async function checkCC73(supabase: SupabaseClient): Promise<ControlHealthResult> {
  const cutoff = new Date(Date.now() - ESCALATION_WARNING_HOURS * 60 * 60 * 1000).toISOString()
  const { data: open } = await supabase
    .from('admin_escalations')
    .select('id, created_at')
    .eq('status', 'open')
  const stale = (open ?? []).filter((e: { created_at: string }) => e.created_at < cutoff)
  if (stale.length > 0) {
    return {
      control_code: 'CC7.3',
      status: 'warning',
      score: Math.max(0, 100 - stale.length * 15),
      notes: `${stale.length} escalation(s) open > ${ESCALATION_WARNING_HOURS}h`,
    }
  }
  return { control_code: 'CC7.3', status: 'healthy', score: 100, notes: null }
}

/** CC6.2: Active sessions and session_anomaly escalations. */
async function checkCC62(supabase: SupabaseClient): Promise<ControlHealthResult> {
  const { count: activeCount } = await supabase
    .from('admin_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  const { data: anomalies } = await supabase
    .from('admin_escalations')
    .select('id')
    .eq('metric_name', 'session_anomaly')
    .eq('status', 'open')
  const total = activeCount ?? 0
  const anomalyCount = (anomalies ?? []).length
  let score = 100
  const notes: string[] = []
  if (total > SESSION_ANOMALY_THRESHOLD * 5) {
    score -= 20
    notes.push(`High active session count: ${total}`)
  }
  if (anomalyCount > 0) {
    score = Math.max(0, score - anomalyCount * 25)
    notes.push(`${anomalyCount} unresolved session_anomaly escalation(s)`)
  }
  return {
    control_code: 'CC6.2',
    status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'failed',
    score: Math.max(0, Math.min(100, score)),
    notes: notes.length ? notes.join('; ') : null,
  }
}

/** Art 30: Overdue data requests (pending and old). */
async function checkArt30(supabase: SupabaseClient): Promise<ControlHealthResult> {
  const cutoff = new Date(Date.now() - OVERDUE_DATA_REQUEST_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('data_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
  const overdue = count ?? 0
  if (overdue > 10) {
    return {
      control_code: 'Art 30',
      status: 'failed',
      score: Math.max(0, 50 - overdue),
      notes: `${overdue} overdue data requests (>${OVERDUE_DATA_REQUEST_HOURS}h)`,
    }
  }
  if (overdue > 3) {
    return {
      control_code: 'Art 30',
      status: 'warning',
      score: Math.max(50, 100 - overdue * 15),
      notes: `${overdue} overdue data requests`,
    }
  }
  return { control_code: 'Art 30', status: 'healthy', score: 100, notes: overdue > 0 ? `${overdue} overdue` : null }
}

/** Governance review: if none in last 90 days, create escalation. */
export async function ensureGovernanceReviewEscalation(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - GOVERNANCE_REVIEW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: latest } = await supabase
    .from('admin_governance_reviews')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (latest && (latest as { created_at: string }).created_at >= cutoff) return
  const { data: existing } = await supabase
    .from('admin_escalations')
    .select('id')
    .eq('metric_name', 'governance_review_overdue')
    .eq('status', 'open')
    .limit(1)
  if (existing && existing.length > 0) return
  await supabase.from('admin_escalations').insert({
    metric_name: 'governance_review_overdue',
    metric_value: GOVERNANCE_REVIEW_DAYS,
    threshold_level: 'yellow',
    status: 'open',
    notes: `No governance review logged in last ${GOVERNANCE_REVIEW_DAYS} days`,
  })
}

const CONTROL_CHECKS: Record<string, (supabase: SupabaseClient) => Promise<ControlHealthResult>> = {
  'CC6.1': checkCC61,
  'CC7.2': checkCC72,
  'CC7.3': checkCC73,
  'CC6.2': checkCC62,
  'Art 30': checkArt30,
}

/** Run all control checks and return health results. */
export async function runControlHealthChecks(supabase: SupabaseClient): Promise<ControlHealthResult[]> {
  const results: ControlHealthResult[] = []
  for (const [code, fn] of Object.entries(CONTROL_CHECKS)) {
    try {
      results.push(await fn(supabase))
    } catch (e) {
      results.push({
        control_code: code,
        status: 'failed',
        score: 0,
        notes: e instanceof Error ? e.message : 'Check failed',
      })
    }
  }
  return results
}

/** Upsert admin_control_health from results. */
export async function upsertControlHealth(
  supabase: SupabaseClient,
  results: ControlHealthResult[]
): Promise<void> {
  const now = new Date().toISOString()
  for (const r of results) {
    await supabase
      .from('admin_control_health')
      .upsert(
        {
          control_code: r.control_code,
          status: r.status,
          score: r.score,
          notes: r.notes,
          last_checked_at: now,
        },
        { onConflict: 'control_code' }
      )
  }
}
