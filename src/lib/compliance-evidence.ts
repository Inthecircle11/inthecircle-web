/**
 * Phase 7: Compliance evidence generation.
 * Produces evidence records for control codes (audit export, verify, escalation summary, sessions, approvals).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type EvidenceType = 'query' | 'export' | 'report' | 'screenshot'

export interface GenerateResult {
  evidence_type: EvidenceType
  reference: string
  summary?: string
}

/** Map control_code (and framework+code) to evidence generation. Returns what to store in admin_control_evidence. */
export async function generateEvidenceForControl(
  supabase: SupabaseClient,
  controlCode: string
): Promise<GenerateResult | null> {
  const code = controlCode.trim().toUpperCase()
  const codeLower = controlCode.trim()

  // Normalize common codes (e.g. CC7.2, A.12.4.1)
  if (code === 'CC6.1' || code === 'A.9.4.1') {
    const { count } = await supabase.from('admin_roles').select('*', { count: 'exact', head: true })
    const { count: c2 } = await supabase.from('admin_user_roles').select('*', { count: 'exact', head: true })
    return {
      evidence_type: 'query',
      reference: 'GET /api/admin/roles, GET /api/admin/admin-users',
      summary: `RBAC: ${count ?? 0} roles, ${c2 ?? 0} role assignments`,
    }
  }

  if (code === 'CC7.2' || code === 'A.12.4.1' || code === 'A.12.4.3' || codeLower === 'art 30') {
    const { count } = await supabase.from('admin_audit_log').select('*', { count: 'exact', head: true })
    const isChain = code === 'CC7.2'
    return {
      evidence_type: isChain ? 'report' : 'export',
      reference: isChain
        ? 'GET /api/admin/audit/verify'
        : 'GET /api/admin/audit?format=csv',
      summary: isChain
        ? `Tamper chain verification. Audit log count: ${count ?? 0}. Export: GET /api/admin/audit?format=csv`
        : `Audit log: ${count ?? 0} entries. Export CSV via /api/admin/audit?format=csv`,
    }
  }

  if (code === 'CC7.3') {
    const { data: open } = await supabase
      .from('admin_escalations')
      .select('id, metric_name, threshold_level, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50)
    return {
      evidence_type: 'report',
      reference: 'GET /api/admin/risk',
      summary: `Escalation summary: ${(open ?? []).length} open. Full: GET /api/admin/risk`,
    }
  }

  if (code === 'A.6.1.2') {
    const { data: approvals } = await supabase
      .from('admin_approval_requests')
      .select('id, status, action_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    const pending = (approvals ?? []).filter((r: { status: string }) => r.status === 'pending').length
    return {
      evidence_type: 'report',
      reference: 'GET /api/admin/approvals',
      summary: `Approval requests: ${(approvals ?? []).length} total, ${pending} pending`,
    }
  }

  if (code === 'CC6.2') {
    const { count } = await supabase
      .from('admin_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    const { data: anomalies } = await supabase
      .from('admin_escalations')
      .select('id')
      .eq('metric_name', 'session_anomaly')
      .eq('status', 'open')
    return {
      evidence_type: 'report',
      reference: 'GET /api/admin/sessions',
      summary: `Active admin sessions: ${count ?? 0}; session_anomaly escalations open: ${(anomalies ?? []).length}`,
    }
  }

  if (codeLower.includes('art 30') || codeLower.includes('data')) {
    const { count } = await supabase.from('data_requests').select('*', { count: 'exact', head: true })
    return {
      evidence_type: 'export',
      reference: 'GET /api/admin/data-requests',
      summary: `Data requests (Art 30): ${count ?? 0} total`,
    }
  }

  // Fallback for any other control_code from control mapping (e.g. framework-specific variants)
  return {
    evidence_type: 'query',
    reference: 'See control mapping evidence_source for this control',
    summary: `No dedicated generator for "${controlCode}". Use evidence_source from Control mapping table.`,
  }
}

/** Reproduce instructions per control code for GET evidence response. */
export const REPRODUCE_INSTRUCTIONS: Record<string, string> = {
  'CC6.1': 'GET /api/admin/roles and GET /api/admin/admin-users (with admin auth).',
  'CC7.2': 'GET /api/admin/audit?format=csv for export; GET /api/admin/audit/verify for tamper chain.',
  'CC7.3': 'GET /api/admin/risk for open escalations and KPIs.',
  'CC6.2': 'GET /api/admin/sessions for active sessions.',
  'A.9.4.1': 'GET /api/admin/roles and GET /api/admin/admin-users.',
  'A.12.4.1': 'GET /api/admin/audit?format=csv.',
  'A.12.4.3': 'GET /api/admin/audit (administrator/operator logs).',
  'A.6.1.2': 'GET /api/admin/approvals for approval request log.',
  'ART 30': 'GET /api/admin/audit and GET /api/admin/data-requests.',
}

export function getReproduceInstruction(controlCode: string): string {
  const key = controlCode.trim().toUpperCase()
  return REPRODUCE_INSTRUCTIONS[key] ?? `Use evidence_source from control mapping for control ${controlCode}.`
}
