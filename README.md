# Inthecircle Web

Next.js app for Inthecircle (app.inthecircle.co). Includes admin panel, auth, and Vercel deployment.

## Production deployment flow

- **Production** is deployed automatically when code is merged into **`main`**.
- Vercel is connected to this repo; every push to `main` triggers a build and production deploy.
- **No manual deploy** for normal releases: merge a PR to `main` and wait for Vercel to finish.

**Check deployment**

- Vercel dashboard: [vercel.com](https://vercel.com) → project **inthecircle-web**.
- Production URL: **https://app.inthecircle.co**
- Admin build fingerprint is shown in the admin panel footer (commit SHA or build timestamp).

## Development workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/your-feature
   ```

2. **Make changes**, then commit and push:
   ```bash
   git add .
   git commit -m "feat: your change"
   git push -u origin feature/your-feature
   ```

3. **Open a pull request** (PR) into `main` on GitHub.
   - CI runs automatically (lint, typecheck, build). Fix any failures.

4. **Merge** the PR when CI is green (and after review if required).
   - Merging to `main` triggers a production deploy on Vercel.

5. **Delete the feature branch** after merge (optional).

## Emergency rollback

If a bad deploy reaches production:

1. **Revert via Git (recommended)**  
   - On GitHub: open the **Commits** list for `main`, find the last good commit.  
   - Open it → **Revert** → create a new PR, merge.  
   - Vercel will deploy the revert as the new production.

2. **Redeploy a previous deployment in Vercel**  
   - Vercel Dashboard → project → **Deployments**.  
   - Find the last known-good deployment → **⋯** → **Promote to Production**.  
   - Use this when you need to roll back without a new commit.

3. **Emergency deploy from CLI** (only if Git is unavailable)  
   - From repo root: `vercel deploy --prod` (or `npm run one-time-fix` after `vercel login`).  
   - Ensure your local branch is at the commit you want to deploy.

After rollback, fix the issue on a branch and ship again via a PR to `main`.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `.env.local` for local env vars (see `.env.example`).

## Required environment variables

Set these in **Vercel** (Production / Preview) or in **`.env.local`** for local dev. Do **not** commit secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `ADMIN_BASE_PATH` | Yes (production) | Obscure path for admin (e.g. a random string). Set in Vercel → Settings → Environment Variables. |
| `SENTRY_DSN` | No (production monitoring) | Sentry DSN for error reporting. If set in production, unhandled errors are reported. Omit or leave empty to disable. |

## Health check

A health endpoint is available for load balancers and monitoring:

- **URL:** `GET /api/health`
- **Response:** `200` with JSON `{ "status": "ok", "version": "<VERCEL_GIT_COMMIT_SHA or unknown>" }`
- **Auth:** None; safe to call from external checks.

**Test locally:**
```bash
curl -s http://localhost:3000/api/health
# Expect: {"status":"ok","version":"unknown"}
```

**Test in production:**
```bash
curl -s https://app.inthecircle.co/api/health
# Expect: {"status":"ok","version":"<commit-sha>"}
```

## Scripts

| Command           | Description                                      |
|-------------------|--------------------------------------------------|
| `npm run dev`     | Start dev server                                 |
| `npm run build`   | Production build                                 |
| `npm run start`   | Start production server (after build)            |
| `npm run lint`    | Lint entire project                              |
| `npm run lint:ci` | Lint app + config (used in CI; fix errors if CI fails) |
| `npm run typecheck` | TypeScript check (no emit)                     |
| `npm run preview` | Deploy a preview to Vercel (no production)       |
| `npm run verify-domain` | Check app.inthecircle.co is only on this project |

## Docs

- **Deployment & domain:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Branch protection:** [docs/BRANCH_PROTECTION.md](./docs/BRANCH_PROTECTION.md)
- **Git → Vercel migration:** [docs/GIT_VERCEL_MIGRATION.md](./docs/GIT_VERCEL_MIGRATION.md)
- **Admin panel:** [docs/ADMIN_PANEL.md](./docs/ADMIN_PANEL.md)

**CI:** Pull requests to `main` run lint, typecheck, and build. No secrets required. If the **CI** check fails on lint, run `npm run lint:ci` locally and fix the reported errors.
<!-- trigger CI -->
<!-- test CI clean run -->
