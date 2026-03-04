# Why Vercel Deployments Failed (and How to Prevent It)

This doc explains the root causes of the recent production build failures and the safeguards we added so they do not happen again.

---

## What Broke (Summary)

1. **Type error:** `page.tsx` passed `applicationsCountsError` to `ApplicationsTab`, but `ApplicationsTabProps` did not declare it → **TypeScript build error on Vercel**.
2. **Curly apostrophe:** A string in `SettingsTab.tsx` used a smart/curly apostrophe (`'`) instead of ASCII `'` → **parse/syntax error during build**.
3. **Lockfile mismatch:** `package-lock.json` was out of sync with `package.json` (e.g. different `import-in-the-middle` version) → **`npm ci` failed on Vercel**.

---

## Root Cause 1: Type Drift (Missing Prop in Interface)

**What happened:** The parent (`page.tsx`) was updated to pass a new prop (`applicationsCountsError`), but the child component’s props interface (`ApplicationsTabProps` in `ApplicationsTab.tsx`) was never updated. TypeScript only checks that the **call site** matches the **declared** props; the declaration lived in the child, so the call site was wrong relative to that declaration.

**Why it reached production:** Either:

- Changes were **pushed directly to `main`** without going through a PR, so CI ran *after* the push and Vercel started building the same commit. A failed CI does not undo an already-pushed commit.
- Or **branch protection was not enforced**: CI was not required to pass before merging, so a failing (or not-yet-run) CI did not block the merge.

**Prevention:**

- **Require CI to pass before merging** (see [Branch protection](#branch-protection) below). All changes to `main` should go through a PR, and the **CI** status check must pass before merge.
- **Run the same checks locally before pushing:** `npm run ci:local` (runs typecheck and build with the same placeholder env as CI). If it fails, fix before pushing.
- **Keep props in sync:** When adding a prop at the call site, add it to the component’s props interface in the same commit (or use a shared type so the compiler forces consistency).

---

## Root Cause 2: Smart/Curly Quotes in Source

**What happened:** A copy-paste or editor auto-correction introduced a Unicode apostrophe (e.g. `'` U+2019) instead of ASCII `'` (U+0027) in a string. The parser treated it as part of the string in a way that broke parsing (e.g. unbalanced quotes), causing a build failure.

**Why it reached production:** Same as above: direct push or merge before CI passed.

**Prevention:**

- **Branch protection** so CI must pass before merge.
- **CI check for smart quotes:** The workflow runs `scripts/check-smart-quotes.mjs` and fails if curly/smart quotes are found in `.ts`, `.tsx`, `.js`, `.jsx` under `src/`. Fix any reported files (replace with straight quotes).
- **Editor/OS:** Disable “smart quotes” in your editor and in system text substitution for code directories.

---

## Root Cause 3: package-lock.json Out of Sync

**What happened:** `package.json` was changed (or a dependency was updated) and `package-lock.json` was not regenerated, or was regenerated with a different Node/npm version. Vercel runs `npm ci`, which strictly installs from the lockfile; if the lockfile does not match `package.json`, `npm ci` fails.

**Why it reached production:** Direct push or merge before CI passed. CI runs `npm ci` and would have failed with the same error.

**Prevention:**

- **Branch protection** so CI must pass before merge.
- **Discipline:** After editing `package.json`, run `npm install` and commit the updated `package-lock.json` in the same commit.
- **CI:** Already runs `npm ci`; with branch protection, no merge without a green CI.

---

## Safeguards We Added

### 1. Branch protection (you must enable on GitHub)

**If not already enabled:** Follow [docs/BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md).

- **Require a pull request** before merging to `main`.
- **Require status checks to pass** and add the **CI** workflow as a required check.
- **Do not allow force push** to `main`.

Result: Only commits that passed CI (lint, typecheck, tests, build) can land on `main`, so Vercel only builds commits that already built successfully in CI.

### 2. Run CI locally before pushing: `npm run ci:local`

Same sequence as GitHub Actions: typecheck, then production build with placeholder env (no secrets required). Run this before pushing to `main` or before opening a PR. If it fails, fix the errors before pushing.

### 3. CI check for smart quotes

The CI workflow runs `scripts/check-smart-quotes.mjs`. It fails the build if any `.ts`, `.tsx`, `.js`, `.jsx` file under `src/` contains common Unicode curly/smart quote characters. Fix the reported files (use straight ASCII quotes) and push again.

### 4. Documentation

- This doc: root causes and prevention.
- [DEPLOYMENT.md](../DEPLOYMENT.md): short “Prevent deployment failures” section that points here and to branch protection and `npm run ci:local`.

---

## Branch protection

Configure once in GitHub:

1. Repo → **Settings** → **Branches** → **Branch protection rules** → Add rule for `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass** and add **CI**.
4. Disable force push and branch deletion for `main`.

See [docs/BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) for step-by-step details.

---

## Quick checklist before pushing to main

- [ ] Run `npm run ci:local` and fix any failures.
- [ ] Commit `package-lock.json` if you changed `package.json`.
- [ ] Prefer opening a PR and merging after CI passes; avoid direct push to `main` when possible.
