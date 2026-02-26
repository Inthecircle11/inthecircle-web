# Security & Governance

**Website-ready section copy**

---

## Security & Governance

We run our admin and moderation operations on a structured control system so that we can show what we do, not only claim it.

**Access control**  
Administrative access is restricted by allowlist and role. Permissions are granular (e.g. who can read audit logs, export data, assign roles, or perform destructive actions). No one has full power by default; roles are assigned explicitly and changes are logged.

**Segregation of duties**  
High-impact actions (e.g. user deletion, anonymization, bulk actions) can require a second authority. One person requests; another approves or rejects. Requests and outcomes are stored and auditable.

**Tamper-evident audit**  
Every administrative action is written to an append-only audit log. Each entry is linked to the previous one by a hash, so any change or deletion breaks the chain. We run verification regularly and support signed daily snapshots for point-in-time integrity.

**Incident and escalation**  
We track operational metrics (e.g. pending reports, overdue data requests, session anomalies). When a threshold is exceeded, an escalation is created. Escalations are resolved with notes and timestamps, not deleted. Open escalations older than a set window are visible in our control health view so we can act on delays.

**Session governance**  
Admin sessions are recorded (e.g. IP, last activity) and can be revoked. We detect anomalies (e.g. same admin, different IP) and log or escalate them. Session data is not deleted; revocation is done by marking the session inactive.

**Continuous control monitoring**  
We run daily checks on defined controls (e.g. at least one super-admin, audit chain valid, no overdue data requests beyond X). Each control gets a status and a score. The overall governance score is available for internal and board reporting and supports SOC 2 / ISO 27001 / GDPR-oriented attestation.

**Data subject requests**  
Data subject requests (e.g. export, deletion) are tracked in a dedicated system with status and age. Overdue items feed into control health and escalation so we can meet our commitments.

**Evidence on demand**  
We map our controls to common frameworks (SOC 2, ISO 27001, GDPR) and can generate evidence (e.g. audit export, chain verification, escalation summary) by control code. Evidence generation is logged and stored for auditors and due diligence.

No marketing fluff: the above corresponds to implemented controls, APIs, and data structures. For technical mapping and evidence paths, see our Due Diligence Fast-Track Package and Security & Governance Whitepaper.
