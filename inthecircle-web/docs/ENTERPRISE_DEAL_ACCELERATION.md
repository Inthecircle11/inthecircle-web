# Enterprise Deal Acceleration Strategy

Use governance maturity to shorten enterprise sales cycles.

---

## SECTION 1 — Security-First Outreach Angle

Cold outreach variations. **Position:** *We built institutional-grade governance before scale.*

### Head of Operations

**Subject:** Fewer fires to put out — governance built in from day one

**Angle:** You're balancing ops at scale with risk. We built an admin layer with segregation of duties, 4-eyes approval for destructive actions, tamper-evident audit, and continuous control monitoring — so ops isn't chasing policy after the fact. Happy to show the Trust Center and control health in 15 min.

---

### Compliance Lead

**Subject:** Controls and evidence in product, not only in policy docs

**Angle:** We know your team needs answers and exports, not promises. We have role segregation, 4-eyes approval, tamper-evident audit chain, session monitoring, and evidence-on-demand by control code (SOC 2 / ISO / GDPR). Trust Center is public; control health is in-admin. Can we walk through your checklist?

---

### CTO

**Subject:** Governance infra that doesn't block ship

**Angle:** RBAC, tamper-evident audit, 4-eyes for destructive ops — all in-app. No “we'll add it post-sale.” Trust Center + control health API for your security review. 15 min?

---

### Procurement

**Subject:** Shorter security review — we're already built for it

**Angle:** We built for enterprise procurement: Trust Center, evidence-on-demand exports, control health dashboard, 4-eyes + tamper-evident audit. We can support your review process instead of extending it. Want a one-pager and a call?

---

## SECTION 2 — Procurement Fast-Track Script

**Trigger:** *“We need security review.”*

**Response script:**

“We're built for that. Four things that cut review time:

**One — Trust Center.** Public page: governance architecture, access control, audit, 4-eyes, incident escalation, session and MFA, continuous monitoring, data subject requests, compliance mapping, contact. No hype; no uncertified claims. Send the link; they see the structure.

**Two — Evidence on demand.** You need proof, not PDFs. We have audit export, chain verification, escalation and session summaries, evidence registry by control code. Your team gets exactly what they need for SOC 2 / ISO / GDPR, with reproduce steps.

**Three — Control health dashboard.** In admin we show an overall governance score and per-control status. You see RBAC consistency, audit chain validity, escalation age, session anomalies, overdue data requests. Not a promise — live state.

**Four — 4-eyes + tamper-evident audit.** Destructive actions need a second approval. Every action is in an append-only, hash-chained log. Verification and optional signed snapshots. That's what we mean by reducing review friction — less back-and-forth, fewer “send us a doc” cycles.”

**Close:** “Can we do a 20-min walkthrough? I'll send the Trust Center link and a one-page FAQ so your security team has quick answers.”

---

## SECTION 3 — Competitive Differentiation

**Typical startup**

- Basic admin; maybe a few roles.
- No real segregation — same people can request and approve.
- No approval workflow for destructive actions.
- No tamper evidence — logs can be edited or missing.
- Security = policy docs and manual evidence when asked.

**Us**

Institutional control system: RBAC with distinct permissions, 4-eyes for high-impact actions, append-only tamper-evident audit chain, continuous control monitoring, session anomaly detection, evidence-on-demand, escalation engine with SLA. Built for enterprise procurement and regulated environments — governance as product, not an afterthought.

---

## SECTION 4 — Enterprise FAQ Sheet (one page)

| Topic | Quick answer |
|-------|------------|
| **Logging** | All admin actions logged to append-only table. Each row hashed and chained to previous; altering a row breaks the chain. Verification runs regularly; optional daily signed snapshots. No delete on audit table. |
| **Role segregation** | Roles (e.g. viewer, moderator, supervisor, compliance, super_admin) have defined permissions. No single role has everything. Assignments and changes audited. Control health checks flag conflicts and drift. |
| **Data request SLAs** | Data subject requests (export/delete) tracked with status and age. Overdue items feed control health and escalation. Processing documented in audit. We can share target SLAs and how we monitor them. |
| **Incident response** | Escalations tracked (e.g. threshold breaches, overdue items). Open escalations aged past SLA surface in control health. Security contact on Trust Center; incidents logged and triaged with same audit trail. |
| **Audit exports** | Permission-gated. We provide CSV export, chain verification, summaries (escalations, sessions, approvals, data requests). Each export recorded in evidence registry with timestamp. Reproduce instructions per control. |
| **Session governance** | New sessions (e.g. new IP) audited and can trigger escalation. Sessions revocable. Session metrics feed control health. We can outline session policy and retention. |

---

*Use with Trust Center, Security Slide, and Security Questionnaire for full narrative.*
