# Daily Enterprise Execution Dashboard

Turn the 30-Day Enterprise Activation Plan into daily execution pressure.

---

## SECTION 1 — Daily Activity Metrics

**Daily targets** (per sales owner; scale by team size)

| Metric | Daily target | Weekly equivalent | Notes |
|--------|--------------|-------------------|--------|
| **Outreach sent** | 8–12 | 40–60 | Cold email + LinkedIn. ICP only. |
| **Replies** | 2–4 | 10–20 | Track positive / negative / question. |
| **Calls booked** | 1–2 | 5–10 | Discovery or walkthrough. |
| **Calls completed** | 1–2 | 5–10 | 30-min discovery or 20–30 min walkthrough. |
| **Governance walkthroughs booked** | 0.5–1 | 2–5 | From discovery or direct request. |
| **Security reviews started** | 0–1 | 1–3 | “Security/procurement has been looped in” or questionnaire sent. |
| **Proposals sent** | 0–1 | 1–3 | Only when governance blockers cleared. |

**Daily minimum (floor)**  
If pipeline is thin: **6 outreach, 1 call completed.** If pipeline is healthy: **4 outreach, 2 calls completed, 1 walkthrough booked or completed.**

**Tracking**  
Log each metric daily. End of day: did we hit floor? Which metric was short?

---

## SECTION 2 — Pipeline Stages

### Five enterprise stages

| Stage | Definition | Exit criteria to next stage |
|-------|-------------|-----------------------------|
| **1. Contacted** | Outreach sent (email/LinkedIn); no reply yet or reply received, call not yet held. | Discovery call completed. |
| **2. Discovery completed** | 30-min discovery held; governance intro done; Trust Center + deck + FAQ sent. | Governance walkthrough booked or completed. |
| **3. Governance walkthrough completed** | 20–30 min walkthrough held; security/compliance saw Trust Center, audit chain, 4-eyes, control health. | Security/procurement explicitly engaged (questionnaire, review, or procurement thread). |
| **4. Security / Procurement in progress** | Questionnaire sent or review started; evidence-on-demand offered; procurement or security in loop. | Proposal sent. |
| **5. Proposal sent** | Commercial proposal or formal quote sent; no open governance blockers. | Close (won/lost). |

### Expected conversion % between stages

| From → To | Conversion target | Implication |
|-----------|--------------------|-------------|
| Contacted → Discovery completed | 15–25% | Need 40–60 contacted to get 8–12 discoveries. |
| Discovery completed → Governance walkthrough completed | 50–70% | Most discoveries should lead to walkthrough. |
| Governance walkthrough completed → Security/Procurement in progress | 60–80% | Walkthrough often triggers or unblocks review. |
| Security/Procurement in progress → Proposal sent | 40–60% | Some reviews stall; some accelerate to proposal. |
| Proposal sent → Closed won | 25–40% | Enterprise close rate. |

**Funnel math (example)**  
To get 2 proposals/week: need ~3–5 in Security/Procurement → need ~5–8 walkthroughs completed → need ~8–12 discoveries → need ~40–60 contacted. Daily: ~8–12 outreach, ~1–2 discoveries, ~1–2 walkthroughs.

---

## SECTION 3 — Weekly Review Structure

**30-minute weekly review** (same day/time each week)

### Agenda

| Block | Time | Content |
|-------|------|---------|
| **Pipeline by stage** | 5 min | Count per stage: Contacted, Discovery completed, Walkthrough completed, Security/Procurement, Proposal sent. Compare to targets (e.g. 12–20 contacted, 5–8 discovery done, 4–6 walkthrough done, 3–5 in review, 2–4 proposal sent). |
| **Bottleneck detection** | 10 min | Where is pipeline stuck? (e.g. low reply rate → Contacted; no walkthroughs → Discovery; long review → Security/Procurement.) Agree one fix per bottleneck. |
| **Objection patterns** | 5 min | What are we hearing? “Not ready for review,” “Procurement is slow,” “Competitor in the deal,” “No budget yet.” Update scripts or assets for top 2. |
| **Message iteration** | 5 min | One change: subject line, email body, or LinkedIn message to test next week. Decide and document. |
| **Next week commitments** | 5 min | Daily targets confirmed; who owns outreach, who owns walkthroughs; any handoffs to SE or compliance. |

### Outputs each week

- Pipeline count by stage (logged).
- Bottlenecks and one action each.
- Top 2 objection patterns and response.
- One message iteration to test.
- Clear owner for next week’s outreach and walkthroughs.

---

## SECTION 4 — Risk Indicators

**Early warning signals** — act when any is true

| Indicator | Threshold | Action |
|-----------|------------|--------|
| **Reply rate** | Below 15% (replies / outreach over 7 days) | Iterate subject lines and first line; shorten email; try LinkedIn for same segment. |
| **Discovery show rate** | Below 60% (showed / booked) | Confirm calendar; send reminder + Trust Center link 24h before; reduce no-shows with shorter booking window. |
| **Walkthrough conversion** | Below 40% (walkthrough completed / discovery completed) | Push walkthrough in discovery close; send “next step: 20-min walkthrough” in same-day follow-up; offer 2–3 times. |
| **Procurement stall** | No movement in Security/Procurement stage for 10+ days | Champion follow-up: “Can you nudge security or share our Trust Center + FAQ?”; offer live walkthrough again; ask for one concrete blocker. |
| **Proposal delay** | Proposal not sent within 5 days of “go” from security/procurement | Treat as process failure; assign owner and date; use “no open governance blockers” checklist. |
| **Pipeline shrinkage** | Contacted count drops week-over-week | Increase daily outreach target; replenish list; use existing pipeline (re-contact, different contact). |

**Review in weekly meeting:** Are we above or below each threshold? If below, apply the action and re-check next week.

---

## SECTION 5 — Scoreboard Format

**Simple structure for Notion or Google Sheets**

### Columns

| Column | Type | Purpose |
|-------|------|---------|
| **Company** | Text | Account name. |
| **Contact** | Text | Primary contact (name + role). Add rows for multiple contacts if needed. |
| **Stage** | Single select | Contacted | Discovery completed | Governance walkthrough completed | Security/Procurement in progress | Proposal sent. |
| **Last Touch** | Date | Last meaningful activity (email, call, meeting). |
| **Next Step** | Text | Concrete next action and owner (e.g. “Send questionnaire — [Name]”; “Book walkthrough — [Name]”). |
| **Governance Used?** | Single select or checkbox | Yes / No. “Yes” = Trust Center sent, or walkthrough done, or questionnaire/evidence sent. |
| **Blocker** | Text | Short note: none, “waiting procurement,” “competitor,” “budget,” “champion left,” etc. |
| **Expected Close** | Month or date | Best guess: e.g. “Mar” or “15 Mar.” |

### Optional columns

| Column | Purpose |
|--------|---------|
| **Source** | Cold / Inbound / Referral. |
| **ICP?** | Yes / No. |
| **Governance walkthrough date** | When walkthrough was or will be. |
| **Proposal sent date** | When proposal went out. |

### Example rows

| Company | Contact | Stage | Last Touch | Next Step | Governance Used? | Blocker | Expected Close |
|---------|---------|--------|------------|-----------|-------------------|---------|----------------|
| Acme Corp | Jane Ops, Head of Ops | Discovery completed | 12 Feb | Book walkthrough — AE | Yes (Trust Center sent) | — | Mar |
| Beta Inc | Tom Compliance | Governance walkthrough completed | 14 Feb | Send questionnaire; offer evidence pack — AE | Yes | — | Mar |
| Gamma Ltd | Sam CTO, Lisa Procurement | Security/Procurement in progress | 18 Feb | CFO one-pager when Lisa responds — AE | Yes | Waiting procurement 8 days | Apr |

### Daily use

- **Start of day:** Filter by Stage = Contacted, Next Step = today or empty. Do outreach and set Next Step.
- **End of day:** Update Last Touch, Stage, Next Step for any activity. Log daily metrics (outreach, replies, calls, walkthroughs, proposals).
- **Weekly:** Export or view counts by Stage; run weekly review; update Blocker and Expected Close.

---

## Output Summary

| Deliverable | Location |
|-------------|----------|
| **Daily numbers** | Section 1 — outreach 8–12, replies 2–4, calls booked 1–2, calls completed 1–2, walkthroughs booked 0.5–1, security reviews started 0–1, proposals 0–1; daily floor 6 outreach + 1 call. |
| **Stage conversion targets** | Section 2 — 5 stages; Contacted→Discovery 15–25%, Discovery→Walkthrough 50–70%, Walkthrough→Security/Procurement 60–80%, Security/Procurement→Proposal 40–60%, Proposal→Won 25–40%. |
| **Review ritual** | Section 3 — 30 min weekly: pipeline by stage (5), bottleneck detection (10), objection patterns (5), message iteration (5), next week commitments (5). |
| **Accountability structure** | Section 4 — risk indicators with thresholds and actions; Section 5 — scoreboard with Company, Contact, Stage, Last Touch, Next Step, Governance Used?, Blocker, Expected Close; daily update of Last Touch / Stage / Next Step and daily metric log. |

---

*Use with 30-Day Enterprise Activation Plan for targets and scripts.*
