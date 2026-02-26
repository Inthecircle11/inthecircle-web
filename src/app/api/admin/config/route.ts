import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requirePermission } from '@/lib/admin-auth'
import { ADMIN_PERMISSIONS } from '@/lib/admin-rbac'
import { getServiceRoleClient } from '@/lib/supabase-service'
import { writeAuditLog } from '@/lib/audit-server'

export const dynamic = 'force-dynamic'

/** GET - Read app config. Requires read_config. */
export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.read_config)
  if (forbidden) return forbidden
  const { supabase } = result

  const { data, error } = await supabase
    .from('app_config')
    .select('key, value, updated_at')

  if (error) {
    console.error('[admin 500]', error)
    return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
  }

  const config: Record<string, string> = {}
  ;(data ?? []).forEach((row: { key: string; value: string | null }) => {
    config[row.key] = row.value ?? ''
  })
  return NextResponse.json(config)
}

/** PATCH - Update app config. Requires manage_config. */
export async function PATCH(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('response' in result) return result.response
  const forbidden = requirePermission(result, ADMIN_PERMISSIONS.manage_config)
  if (forbidden) return forbidden
  const { supabase } = result

  const body = await req.json().catch(() => ({}))
  const allowedKeys = ['signups_open', 'verification_requests_open', 'maintenance_mode', 'maintenance_banner']
  const updates: Record<string, string> = {}
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      updates[key] = String(body[key])
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No allowed keys to update' }, { status: 400 })
  }

  for (const [key, value] of Object.entries(updates)) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      console.error('[admin 500]', error)
      return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 })
    }
  }
  const supabaseService = getServiceRoleClient()
  if (supabaseService) {
    await writeAuditLog(supabaseService, req, result.user, {
      action: 'control_drift_detected',
      target_type: 'config',
      target_id: null,
      details: { drift: 'config_changed', keys: Object.keys(updates) },
      reason: null,
    })
  }
  return NextResponse.json({ ok: true })
}
