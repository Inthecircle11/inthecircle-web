/**
 * Tamper-evident audit chain: hash computation and verification.
 * Must match DB trigger formula: SHA256(id|admin_user_id|action|target_type|target_id|details|created_at|previous_hash).
 */

import { createHmac, createHash } from 'crypto'

export type AuditRow = {
  id: string
  admin_user_id: string | null
  action: string | null
  target_type: string | null
  target_id: string | null
  details: unknown
  created_at: string | null
  previous_hash: string | null
  row_hash: string | null
}

function safeStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Deterministic payload string matching PostgreSQL concat_ws('|', ...). */
export function auditPayloadString(row: AuditRow, previousHash: string): string {
  return [
    row.id,
    safeStr(row.admin_user_id),
    safeStr(row.action),
    safeStr(row.target_type),
    safeStr(row.target_id),
    row.details != null ? (typeof row.details === 'object' ? JSON.stringify(row.details) : String(row.details)) : '{}',
    safeStr(row.created_at),
    previousHash,
  ].join('|')
}

/** Compute SHA256 hex hash of the audit row payload (same as DB). */
export function computeRowHash(row: AuditRow, previousHash: string): string {
  const payload = auditPayloadString(row, previousHash)
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/** Verify chain by linkage only (previous_hash → row_hash). Does not recompute hashes (avoids Node/DB payload format mismatch). */
export function verifyChain(rows: AuditRow[]): { valid: boolean; firstCorruptedId: string | null } {
  let prevHash = ''
  for (const row of rows) {
    const expectedPrev = prevHash
    const actualPrev = String(row.previous_hash ?? '')
    if (actualPrev !== expectedPrev) {
      return { valid: false, firstCorruptedId: row.id }
    }
    const rowHash = row.row_hash ?? ''
    if (!rowHash) {
      return { valid: false, firstCorruptedId: row.id }
    }
    prevHash = rowHash
  }
  return { valid: true, firstCorruptedId: null }
}

/** HMAC-SHA256(secret, lastRowHash) as hex. For daily snapshot. */
export function computeSnapshotSignature(lastRowHash: string, secret: string): string {
  return createHmac('sha256', secret).update(lastRowHash, 'utf8').digest('hex')
}

/** Verify snapshot: recompute signature and compare. */
export function verifySnapshotSignature(lastRowHash: string, signature: string, secret: string): boolean {
  const expected = computeSnapshotSignature(lastRowHash, secret)
  return expected === signature
}
