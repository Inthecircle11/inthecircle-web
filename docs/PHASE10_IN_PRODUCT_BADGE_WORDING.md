# In-Product Trust Indicator — Badge Wording

**Admin sidebar: Governance Health badge**

---

## Badge label

**Governance Health: {score} / 100**

- If score is available: show numeric value (e.g. `92`).
- If not yet loaded or no data: show `—` (em dash).

---

## Tooltip (title attribute)

**Full text:**

"Overall control health score (0–100). Based on daily checks: RBAC consistency, audit chain validity, escalation age, session anomalies, overdue data requests. See Compliance tab for details."

**Short version (if space-limited):**

"Control health score 0–100 from daily checks. See Compliance for details."

---

## Placement

- Admin panel left sidebar, above "Log out" and "Back to app".
- Visible to any authenticated admin; score is loaded from GET /api/admin/compliance/health (read_audit required; 403 leaves badge as —).

---

## Implementation

- Badge shows "Governance Health" as heading and "{score} / 100" as value.
- Score is set from (1) initial fetch of /api/admin/compliance/health when admin is authorized, (2) complianceHealth.overall_score when user opens Compliance tab and data is loaded.
