'use client'

import { useState } from 'react'

export interface ComplianceControlHealth {
  control_code: string
  status: string
  score: number
  last_checked_at: string
  notes: string | null
}

export interface ComplianceHealth {
  overall_score: number | null
  controls: ComplianceControlHealth[]
  last_checked_at: string | null
}

export interface ComplianceTabProps {
  controls: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  health: ComplianceHealth | null
  loading: boolean
  generatingCode: string | null
  onRefresh: () => void
  onRunHealthCheck: () => Promise<void>
  onRepairChain: () => Promise<void>
  onGenerateEvidence: (controlCode: string) => Promise<void>
  onAddReview: (reviewPeriod: string, summary: string) => Promise<void>
  canExportAudit: boolean
}

export function ComplianceTab({
  controls,
  evidence,
  reviews,
  health,
  loading,
  generatingCode,
  onRefresh,
  onRunHealthCheck,
  onRepairChain,
  onGenerateEvidence,
  onAddReview,
  canExportAudit,
}: ComplianceTabProps) {
  const [runningHealth, setRunningHealth] = useState(false)
  const [repairingChain, setRepairingChain] = useState(false)
  const [evidenceFilter, setEvidenceFilter] = useState('')
  const [reviewPeriod, setReviewPeriod] = useState('')
  const [reviewSummary, setReviewSummary] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const filteredEvidence = evidenceFilter.trim()
    ? evidence.filter((e) =>
        String(e.control_code ?? '').toLowerCase().includes(evidenceFilter.trim().toLowerCase())
      )
    : evidence

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Control framework & evidence</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Control health (Phase 8 CCM) */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Control health</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Overall governance score and per-control status. Run checks daily (e.g. via cron calling
          POST /api/admin/compliance/health/run).
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {health != null && health.overall_score != null && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--text)]">
                Overall: {health.overall_score}
              </span>
              <span className="text-sm text-[var(--text-muted)]">/ 100</span>
            </div>
          )}
          {health?.last_checked_at && (
            <span className="text-xs text-[var(--text-muted)]">
              Last run: {new Date(health.last_checked_at).toLocaleString()}
            </span>
          )}
          {canExportAudit && (
            <button
              type="button"
              disabled={runningHealth}
              onClick={async () => {
                setRunningHealth(true)
                await onRunHealthCheck()
                setRunningHealth(false)
              }}
              className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50"
            >
              {runningHealth ? 'Running…' : 'Run health checks'}
            </button>
          )}
          {canExportAudit && (
            <button
              type="button"
              disabled={repairingChain}
              onClick={async () => {
                setRepairingChain(true)
                await onRepairChain()
                setRepairingChain(false)
              }}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--separator)] text-sm font-medium disabled:opacity-50 text-[var(--text-secondary)]"
              title="Recompute audit log hash chain (fixes CC7.2 when chain is broken)"
            >
              {repairingChain ? 'Repairing…' : 'Repair chain'}
            </button>
          )}
        </div>
        {loading && !health ? (
          <div className="h-20 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
        ) : health?.controls?.length ? (
          <ul className="space-y-2">
            {health.controls.map((c) => (
              <li
                key={c.control_code}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--separator)] last:border-0"
              >
                <span className="font-medium">{c.control_code}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    c.status === 'healthy'
                      ? 'bg-green-500/20 text-green-400'
                      : c.status === 'warning'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {c.status}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">Score: {c.score}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {c.last_checked_at ? new Date(c.last_checked_at).toLocaleString() : ''}
                </span>
                {c.notes && (
                  <span
                    className="text-xs text-[var(--text-muted)] w-full mt-1"
                    title={c.notes}
                  >
                    {c.notes}
                  </span>
                )}
                {c.notes && String(c.notes).includes('No super_admin') && (
                  <span className="text-xs text-[var(--text-muted)] w-full mt-1 block">
                    Ensure{' '}
                    <code className="bg-[var(--surface-hover)] px-1 rounded">
                      SUPABASE_SERVICE_ROLE_KEY
                    </code>{' '}
                    is set in your deployment, then open Admin (or Settings) once so your
                    allowlisted account is assigned super_admin.
                  </span>
                )}
                <a
                  href="#compliance-evidence"
                  onClick={() => setEvidenceFilter(c.control_code)}
                  className="text-xs text-[var(--accent-purple)] hover:underline"
                >
                  Evidence →
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No health data yet. Run health checks (or run migration 20260228000005) and call POST
            /api/admin/compliance/health/run.
          </p>
        )}
      </div>

      {/* Control Mapping */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Control mapping</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          SOC2, ISO 27001, GDPR controls mapped to system components and evidence sources.
        </p>
        {loading && controls.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : controls.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Run migration 20260228000004_control_framework_evidence_phase7.sql to seed controls.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--separator)]">
                  <th className="p-2 font-medium">Framework</th>
                  <th className="p-2 font-medium">Control</th>
                  <th className="p-2 font-medium">Description</th>
                  <th className="p-2 font-medium">Component</th>
                  <th className="p-2 font-medium">Evidence source</th>
                  {canExportAudit && <th className="p-2 font-medium">Generate</th>}
                </tr>
              </thead>
              <tbody>
                {controls.map((c) => (
                  <tr
                    key={String(c.id)}
                    className="border-b border-[var(--separator)] last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="p-2">{String(c.framework)}</td>
                    <td className="p-2 font-medium">{String(c.control_code)}</td>
                    <td
                      className="p-2 text-[var(--text-secondary)] max-w-[200px] truncate"
                      title={String(c.control_description ?? '')}
                    >
                      {String(c.control_description ?? '')}
                    </td>
                    <td className="p-2">{String(c.system_component)}</td>
                    <td
                      className="p-2 text-xs text-[var(--text-muted)] max-w-[240px] truncate"
                      title={String(c.evidence_source ?? '')}
                    >
                      {String(c.evidence_source ?? '')}
                    </td>
                    {canExportAudit && (
                      <td className="p-2">
                        <button
                          type="button"
                          disabled={generatingCode !== null}
                          onClick={() => onGenerateEvidence(String(c.control_code))}
                          className="px-2 py-1 rounded-lg bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-xs font-medium disabled:opacity-50"
                        >
                          {generatingCode === c.control_code ? 'Generating…' : 'Generate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evidence export / registry */}
      <div
        id="compliance-evidence"
        className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]"
      >
        <h3 className="text-base font-semibold mb-3">Evidence registry</h3>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Generated evidence records. Filter by control code.
        </p>
        <input
          type="text"
          placeholder="Filter by control code (e.g. CC7.2)"
          value={evidenceFilter}
          onChange={(e) => setEvidenceFilter(e.target.value)}
          className="input-field w-full max-w-xs mb-4"
        />
        {loading && evidence.length === 0 ? (
          <div className="h-24 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
        ) : filteredEvidence.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No evidence records yet. Use Generate on a control above.
          </p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {filteredEvidence.slice(0, 50).map((e) => (
              <li
                key={String(e.id)}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--separator)] last:border-0 text-sm"
              >
                <span className="font-medium">{String(e.control_code)}</span>
                <span className="text-[var(--text-muted)]">
                  {String(e.evidence_type)} · {String(e.reference ?? '')}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {e.generated_at ? new Date(String(e.generated_at)).toLocaleString() : ''}
                </span>
              </li>
            ))}
            {filteredEvidence.length > 50 && (
              <p className="text-xs text-[var(--text-muted)]">
                … and {filteredEvidence.length - 50} more
              </p>
            )}
          </ul>
        )}
      </div>

      {/* Quarterly review log */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--separator)]">
        <h3 className="text-base font-semibold mb-3">Quarterly governance review log</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Log governance reviews for compliance (e.g. 2025-Q1).
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Review period (e.g. 2025-Q1)"
            value={reviewPeriod}
            onChange={(e) => setReviewPeriod(e.target.value)}
            className="input-field max-w-[180px]"
          />
          <textarea
            placeholder="Summary (optional)"
            value={reviewSummary}
            onChange={(e) => setReviewSummary(e.target.value)}
            className="input-field min-w-[240px] min-h-[80px]"
            rows={2}
          />
          <button
            type="button"
            disabled={!reviewPeriod.trim() || submittingReview}
            onClick={async () => {
              setSubmittingReview(true)
              await onAddReview(reviewPeriod.trim(), reviewSummary.trim())
              setReviewPeriod('')
              setReviewSummary('')
              setSubmittingReview(false)
            }}
            className="px-4 py-2 rounded-xl bg-[var(--accent-purple)] text-white text-sm font-medium disabled:opacity-50"
          >
            {submittingReview ? 'Saving…' : 'Log review'}
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No governance reviews logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li
                key={String(r.id)}
                className="py-2 border-b border-[var(--separator)] last:border-0"
              >
                <p className="font-medium">{String(r.review_period)}</p>
                {r.summary != null && r.summary !== '' && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{String(r.summary)}</p>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  {r.created_at ? new Date(String(r.created_at)).toLocaleString() : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
