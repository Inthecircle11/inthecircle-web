import type { SupabaseClient } from '@supabase/supabase-js'

const TABLE = 'admin_idempotency_keys'

export async function getIdempotencyResponse(
  supabase: SupabaseClient,
  key: string,
  adminUserId: string,
  action: string
): Promise<{ status: number; body: string } | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('response_status, response_body')
    .eq('idempotency_key', key)
    .eq('admin_user_id', adminUserId)
    .eq('action', action)
    .single()
  if (error || !data) return null
  return {
    status: (data as { response_status: number }).response_status,
    body: (data as { response_body: string }).response_body,
  }
}

export async function setIdempotencyResponse(
  supabase: SupabaseClient,
  key: string,
  adminUserId: string,
  action: string,
  status: number,
  body: string,
  responseHash?: string
): Promise<void> {
  await supabase.from(TABLE).upsert(
    {
      idempotency_key: key,
      admin_user_id: adminUserId,
      action,
      response_status: status,
      response_body: body,
      response_hash: responseHash ?? null,
    },
    { onConflict: 'idempotency_key' }
  )
}
