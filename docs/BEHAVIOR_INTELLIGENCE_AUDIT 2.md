# Behavior Intelligence Audit

Run a **Behavior Intelligence Audit** against your analytics data to get:

1. **Activation definition** — Which event best predicts retention and at what rate users reach it.
2. **Biggest friction point** — Funnel step with the largest drop-off.
3. **Highest retention driver** — Events/features more common in retained vs churned users.
4. **Top ROI product changes** — From funnel + retention (improve drop-off step, double down on retention driver, improve activation).
5. **Features to reconsider** — Low-usage features that may be candidates for removal or improvement.

## Prerequisites

- **Migrations applied** (including `20260303100001_analytics_behavior_audit_rpcs.sql`). From project root:
  ```bash
  npx supabase db push
  ```
- **Env** (e.g. `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## How to run

```bash
npm run audit:behavior
```

Or with a custom window (default 30 days):

```bash
AUDIT_DAYS=60 npm run audit:behavior
```

Or directly:

```bash
node scripts/behavior-intelligence-audit.mjs
```

## What it calls

| Section | RPC / source |
|--------|----------------|
| Activation | `analytics_behavior_audit_activation(p_days)` |
| Retention drivers | `analytics_behavior_audit_retention_drivers(14)` |
| Funnel drop-off | `analytics_get_funnel_steps('App Activation', 'app', from, to)` |
| Feature utilization | `analytics_get_feature_usage(days, 100)` |

## Reading the output

- **Section 1** — Rows are activation candidates; the **first row** is the chosen “true” activation event (highest D1 retention among those who reached it). **Activation rate** = % of all app users who reached that event.
- **Section 2** — Events/features ordered by **retention lift** (higher % in retained users than in churned). Top row = highest retention driver.
- **Section 3** — Funnel steps with conversion from previous step. **Biggest drop-off** = step where the most users are lost; **estimated lift** = rough extra users if that step’s conversion improved by 10%.
- **Section 4** — **Top 10** / **Bottom 10** by usage; then features with strong retention lift (used more by retained than churned).
- **Output summary** — The five requested outputs in one block for quick reference.

## Note on application events

The current funnel is **signup → onboarding → first_core_action → return_within_7d**. `application_submitted` and `application_approved` are not in the default event taxonomy or funnel; add them to analytics and funnel config if you want them in the audit.
