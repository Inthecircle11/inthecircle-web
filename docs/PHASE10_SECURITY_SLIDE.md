# Enterprise Deck — Security Slide

**One slide**

---

## Title

**Enterprise-Grade Governance & Control Infrastructure**

---

## Bullets

- **Segregation of duties (RBAC)** — Role-based access with distinct permissions; no single role holds all powers.
- **4-eyes destructive control** — High-impact actions require request → approve/reject by a second authority.
- **Tamper-evident audit chain** — Append-only log with per-row hash chain; verification and optional daily signed snapshots.
- **Continuous monitoring & drift detection** — Daily control health checks; drift events (e.g. new super_admin, role change, config change) logged.
- **Session anomaly detection** — New session from different IP triggers audit and optional escalation; sessions revocable.
- **Evidence-on-demand exports** — Audit CSV, chain verify, escalation/session summaries, evidence registry by control code (SOC 2, ISO, GDPR).
- **Escalation engine with SLA enforcement** — Automatic escalations when metrics cross thresholds; open escalations aged beyond window surface in control health.

---

## Positioning line

*Designed for enterprise procurement and regulated environments.*

---

*Use with Due Diligence Fast-Track and Trust Center for technical detail.*
