# Release checklist (architecture enforcement)

Use this checklist before merging to `main` or cutting a release. Do not skip steps.

---

## 1. Tests

- [ ] **Run full test suite**
  ```bash
  npm run test
  ```
- [ ] **Run admin integration tests**
  ```bash
  npm run test:admin
  ```
- [ ] **Run architecture guards**
  ```bash
  npm run test:guards
  ```
  Ensures: no client-side `admin_*` RPC, route coverage, permission consistency.

---

## 2. Migration safety

- [ ] **Run migration check**
  ```bash
  npm run check:migrations
  ```
  Fails if any `ALTER FUNCTION admin_*` exists without a corresponding `CREATE` in the migration set.

---

## 3. Cron jobs

- [ ] **Confirm cron jobs are scheduled** (Supabase Dashboard → Database → Cron or `pg_cron`):
  - Analytics retention / orphan cleanup (if applicable)
  - Any other admin-related crons

---

## 4. Partitions

- [ ] **Confirm partitions exist for the next month** (analytics / partitioned tables):
  - Check that the next calendar month has a partition created (or that auto-creation is in place).

---

## 5. No new client-side admin RPC

- [ ] **Confirm no new `admin_*` RPC was added client-side**
  - `src/app/admin` must not contain `supabase.rpc('admin_` or `.rpc("admin_`.
  - CI runs `test:guards` which enforces this.

---

## 6. Admin analytics health

- [ ] **Confirm admin analytics are healthy**
  - Overview/dashboard loads
  - No unexpected 500s on admin API routes
  - Audit log / compliance endpoints respond as expected

---

## Sign-off

- [ ] All items above completed.
- [ ] Branch is up to date with `main`; merge only when CI is green.

**Reminder:** Pushing to `main` triggers production deploy (Vercel). Do not push until this checklist is done.
