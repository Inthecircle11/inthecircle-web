'use client'

import Link from 'next/link'

const SECTIONS = [
  { id: 'overview', title: 'Governance Architecture Overview' },
  { id: 'access', title: 'Access Control & Segregation of Duties' },
  { id: 'audit', title: 'Tamper-Evident Audit Logging' },
  { id: 'approval', title: '4-Eyes Approval Workflow' },
  { id: 'incident', title: 'Incident Detection & Escalation' },
  { id: 'session', title: 'Session Monitoring & MFA' },
  { id: 'monitoring', title: 'Continuous Control Monitoring' },
  { id: 'dsar', title: 'Data Subject Request Handling' },
  { id: 'compliance', title: 'Compliance Mapping (SOC 2, ISO, GDPR)' },
  { id: 'contact', title: 'Contact Security Team' },
]

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--separator)] bg-[var(--surface)]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--text)] hover:text-[var(--accent-purple)] transition-colors">
            ← Back
          </Link>
          <span className="text-sm text-[var(--text-muted)]">Trust Center</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 pb-16">
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Security & Governance</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-10">
          How we run administrative controls, logging, and compliance-relevant processes. No certification claims unless explicitly stated as certified.
        </p>

        <nav className="mb-10 pb-6 border-b border-[var(--separator)]" aria-label="Page sections">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`} className="text-[var(--accent-purple)] hover:underline underline-offset-2">
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="overview" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Governance Architecture Overview</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Administrative operations use a structured control system: role-based access, approval workflows for high-impact actions, an append-only tamper-evident audit log, session tracking, escalation rules, and continuous control health checks. Access is allowlisted and permission-scoped; no single role has all powers by default.
          </p>
        </section>

        <section id="access" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Access Control & Segregation of Duties</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            Admin access is restricted by allowlist and by role. Permissions (e.g. read audit, export data, assign roles, perform destructive actions) are granted per role. High-impact actions can require a second authority: one person requests, another approves or rejects. Role assignments and changes are logged.
          </p>
          <p className="text-[var(--text-muted)] text-xs">Relevant: SOC 2 CC6.1, ISO 27001 A.9.4.1, A.6.1.2.</p>
        </section>

        <section id="audit" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Tamper-Evident Audit Logging</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            Every administrative action is written to an append-only audit log. Each row is linked to the previous by a cryptographic hash; altering or deleting any row breaks the chain. Verification endpoints confirm chain integrity. Optional daily snapshots sign the latest chain hash for point-in-time attestation. The audit table does not support row deletion.
          </p>
          <p className="text-[var(--text-muted)] text-xs">Relevant: SOC 2 CC7.2, ISO 27001 A.12.4.1, A.12.4.3.</p>
        </section>

        <section id="approval" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">4-Eyes Approval Workflow</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Destructive or sensitive operations (e.g. user deletion, anonymization, bulk actions) can be gated by an approval request. A first authority submits the request; a second authority (e.g. supervisor or super_admin) approves or rejects. Requests, outcomes, and timestamps are stored and auditable.
          </p>
        </section>

        <section id="incident" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Incident Detection & Escalation</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            Operational metrics (pending reports, overdue data requests, session anomalies, governance review overdue) are compared to thresholds. When a threshold is exceeded, an escalation is created with metric, value, and severity. Escalations are resolved with notes and timestamps, not deleted. Open escalations older than a set window are visible in control health to surface delayed response.
          </p>
          <p className="text-[var(--text-muted)] text-xs">Relevant: SOC 2 CC7.3.</p>
        </section>

        <section id="session" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Session Monitoring & MFA</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            Admin sessions are recorded (identifier, IP, user-agent, last activity). Sessions can be revoked; session rows are not deleted. New sessions from a different IP for the same admin can trigger an audit event and optional escalation. MFA for admin access can be enforced via configuration when the identity provider supports it.
          </p>
          <p className="text-[var(--text-muted)] text-xs">Relevant: SOC 2 CC6.2.</p>
        </section>

        <section id="monitoring" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Continuous Control Monitoring</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Daily checks evaluate defined controls (e.g. RBAC consistency, audit chain validity, escalation age, session anomalies, overdue data requests). Each control receives a status and a 0–100 score. An overall governance score is available for internal and board reporting. Results are stored and exposed via secure APIs.
          </p>
        </section>

        <section id="dsar" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Data Subject Request Handling</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            Data subject requests (e.g. export, deletion) are tracked in a dedicated system with status and age. Overdue pending requests feed into control health and escalation. Processing is documented in the audit log where applicable.
          </p>
          <p className="text-[var(--text-muted)] text-xs">Relevant: GDPR Article 30.</p>
        </section>

        <section id="compliance" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Compliance Mapping (SOC 2, ISO, GDPR)</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            We map implemented controls to framework criteria (e.g. SOC 2 CC6.1, CC7.2, CC7.3, CC6.2; ISO 27001 A.9.4.1, A.12.4.1, A.12.4.3, A.6.1.2; GDPR Art 30). Evidence can be generated by control code (audit export, chain verification, escalation summary, etc.) and stored for auditors. We do not claim certification unless we have obtained and published a formal certification.
          </p>
        </section>

        <section id="contact" className="mb-10 scroll-mt-6">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Contact Security Team</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
            For security concerns, abuse reports, or governance-related inquiries, use the main contact channels published on our website (e.g. support or legal contact). For enterprise or audit evidence requests, refer to the same channels and mention governance or compliance so your request is routed appropriately.
          </p>
        </section>

        <p className="text-[var(--text-muted)] text-xs mt-12 pt-6 border-t border-[var(--separator)]">
          Last updated: governance controls as implemented in the platform. For technical evidence paths and API details, see internal Due Diligence Fast-Track Package and Security & Governance Whitepaper.
        </p>
      </main>
    </div>
  )
}
