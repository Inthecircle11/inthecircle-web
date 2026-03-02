# Architecture enforcement layer

Strict governance to prevent drift and regression after the admin refactor (centralized API routes, no client-side admin RPC, partitioned analytics, retention/orphan cron).

---

## How this prevents drift

| Mechanism | What it enforces | Prevents |
|-----------|------------------|----------|
| **CI (GitHub Actions)** | Every PR/push runs lint, typecheck, `test:admin`, `test:guards`, `check:migrations`, then build. Any failure blocks merge. | Untested or broken code from being merged; tests must pass before merge. |
| **RPC guardrail** | No file under `src/app/admin` may contain `supabase.rpc('admin_` or `.rpc("admin_`. | Reintroducing client-side admin RPCs; all admin actions stay behind API routes. |
| **Route coverage** | Every admin route under `src/app/api/admin` (except gate/identity) must be referenced in `tests/admin.integration.test.ts`. | New routes without at least one test reference; forces explicit coverage. |
| **Permission consistency** | Every non-gate admin route must call `requireAdmin()`; every mutation (POST/PATCH/DELETE/PUT) must call `requirePermission()`. | Routes that skip auth or permission checks. |
| **Migration safety** | No `ALTER FUNCTION admin_*` without a matching `CREATE` (or allowlisted) in the migration set. | Altering admin functions that were never created in migrations; keeps DB and code in sync. |
| **Release checklist** | Pre-merge checklist: tests, migration check, cron/partitions, no new RPC, admin analytics health. | Releasing without verifying deployments, crons, and partitions. |

No new product features are added; this is governance and enforcement only. New code that violates any of the above will fail CI or the checklist.

---

## Artifacts

- **CI:** `.github/workflows/ci.yml` — install, lint, typecheck, test:admin, test:guards, check:migrations, build.
- **Guards:** `tests/guards/rpc-guard.test.ts`, `route-coverage.test.ts`, `permission-consistency.test.ts`.
- **Migration check:** `scripts/check-migrations.mjs`; npm script: `check:migrations`.
- **Checklist:** `docs/RELEASE_CHECKLIST.md`.
