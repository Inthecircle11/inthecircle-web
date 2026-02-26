# Migrate to Git-Based Production Deployments

This guide converts the project from **manual CLI production deploys** (`vercel deploy --prod`) to **Git-based production**: push to `main` → Vercel auto-deploys. Environment variables are preserved; production is not disrupted if you follow the checklist.

---

## 1. Current state (what we inspected)

### Repository structure

- **Git root:** The Git repository is at the **parent** folder (`macbook pro m4 VIPP`), not inside `inthecircle-web`. From inside `inthecircle-web`, `git status` still reports the parent repo (branch `main`, no commits yet, untracked files include sibling folders and `./` for inthecircle-web).
- **Web app location:** The Next.js app lives in the subfolder **`inthecircle-web/`**. For Vercel to use “push to main → deploy” with **no Root Directory** override, the **GitHub repo should have the app at its root**. So we use a **dedicated repo** whose root is `inthecircle-web`.

### GitHub connection

- **Not connected.** There are **no Git remotes** (`git remote -v` is empty). The project has never been pushed to GitHub.

### Vercel

- **Project:** `inthecircle-web` (projectId in `.vercel/project.json`). Deploys today are via **CLI** from this folder. Environment variables (e.g. `ADMIN_BASE_PATH`, `ADMIN_GATE_PASSWORD`, Supabase keys) are set in Vercel **Production** (and some in Preview). Connecting a Git repo to this **existing** project does **not** remove or reset env vars.

---

## 2. Exact steps

### Step 1 — Initialize Git inside `inthecircle-web` (recommended)

Use a repo whose root is the Next.js app so Vercel can deploy with default settings (no Root Directory).

From your machine:

```bash
cd "/Users/ahmedkhalifa/Documents/macbook pro m4 VIPP/inthecircle-web"
git init
git add .
git status   # ensure no .env.local, .vercel, .next, node_modules
git commit -m "chore: initial commit for Git-based Vercel deployment"
```

- `.gitignore` already excludes `.vercel`, `.next`, `node_modules`, `.env*.local`, so they will not be committed.
- If the **parent** folder also has a Git repo and you want to avoid it tracking `inthecircle-web` as nested content, add `inthecircle-web/` to the **parent’s** `.gitignore` (optional).

---

### Step 2 — Create a GitHub repository and push

1. On GitHub: **New repository** (e.g. `inthecircle-web` or `inthecircle-app`). Do **not** add a README, .gitignore, or license (you already have them).
2. Then in `inthecircle-web`:

```bash
cd "/Users/ahmedkhalifa/Documents/macbook pro m4 VIPP/inthecircle-web"
git remote add origin https://github.com/YOUR_ORG/inthecircle-web.git
git branch -M main
git push -u origin main
```

Replace `YOUR_ORG/inthecircle-web` with your actual org/username and repo name.

---

### Step 3 — Connect Vercel to the GitHub repo

1. Open **Vercel Dashboard** → **Team** → project **inthecircle-web**.
2. Go to **Settings** → **Git**.
3. Click **Connect Git Repository** (or **Edit** if something is already connected).
4. Choose **GitHub** and authorize if needed.
5. Select the **repository** you just pushed (e.g. `YOUR_ORG/inthecircle-web`).
6. **Production Branch:** set to **`main`**.
7. **Root Directory:** leave **empty** (repo root = app root).
8. Save. Vercel may run an initial deployment from `main`; that becomes production.

- **Environment variables:** They are tied to the **project**, not to Git. After connecting, go to **Settings** → **Environment Variables** and confirm **Production** still has `ADMIN_BASE_PATH`, `ADMIN_GATE_PASSWORD`, Supabase keys, etc. No need to re-enter unless something is missing.

---

### Step 4 — Remove manual CLI production workflow

Already done in this repo:

- **package.json:** `deploy` no longer runs `vercel deploy --prod`; it runs only domain verification and prints that production deploys via Git. `fix-production` removed. Optional `preview` script added for preview deploys.
- **Docs and rules:** `DEPLOYMENT.md` and `.cursor/rules` updated to describe Git-based production and when to use CLI (preview only, or one-time emergency).

You can still run `vercel deploy --prod` manually in emergencies (e.g. `npm run one-time-fix` or `vercel deploy --prod`); the normal workflow is **push to `main`**.

---

### Step 5 — Ensure environment variables are preserved

- Connecting Git to an **existing** Vercel project does **not** clear env vars.
- After connecting (Step 3), open **Vercel** → **inthecircle-web** → **Settings** → **Environment Variables**.
- Confirm for **Production**: `ADMIN_BASE_PATH`, `ADMIN_GATE_PASSWORD`, `ADMIN_USER_IDS`, `ADMIN_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc. If anything is missing, add it (value is not shown; re-paste from your backup or password manager).

---

## 3. Safe migration checklist

Use this so production is not disrupted.

- [ ] **Backup env list**  
  In Vercel → inthecircle-web → Settings → Environment Variables, note which variables exist for **Production** (names only; values are encrypted). Optionally export or screenshot for your records.

- [ ] **Confirm no secrets in repo**  
  Run `git status` and `git diff` before first commit; ensure `.env`, `.env.local`, `.env.production.local` are ignored and not staged. `.gitignore` already has `.env*.local`.

- [ ] **Init Git in inthecircle-web and first commit**  
  `git init`, `git add .`, `git commit -m "chore: initial commit for Git-based Vercel deployment"`.

- [ ] **Create GitHub repo and push**  
  New repo on GitHub (no extra files), then `git remote add origin ...`, `git push -u origin main`.

- [ ] **Connect Vercel to GitHub**  
  Settings → Git → Connect repository → select repo → Production Branch = **main** → Root Directory empty.

- [ ] **Verify env vars**  
  Settings → Environment Variables → confirm Production vars (and Preview if you use it).

- [ ] **Trigger first Git deploy**  
  Option A: Vercel may auto-deploy from `main` when you connect.  
  Option B: Make a tiny change (e.g. a comment), commit, push to `main`; confirm a new deployment appears and completes.

- [ ] **Confirm production**  
  Open https://app.inthecircle.co in an incognito window; confirm the app and admin (obscure URL or /admin) load as expected.

- [ ] **Stop using CLI for normal production**  
  From now on, deploy to production by **pushing to `main`**. Use `npm run preview` or `vercel` only for preview URLs. Use `vercel deploy --prod` or `npm run one-time-fix` only in emergencies.

---

## 4. After migration

- **Production deploys:** Push (or merge) to `main` → Vercel builds and deploys; that deployment becomes production.
- **Preview deploys:** Push to another branch → Vercel creates a preview URL. Or run `npm run preview` for a one-off preview from local.
- **Domain check:** Run `npm run verify-domain` anytime to ensure app.inthecircle.co is only on inthecircle-web (e.g. before connecting a new domain or if something looks wrong).
- **Emergency prod deploy from CLI:** If Git is down or you must deploy from local: `vercel deploy --prod` from `inthecircle-web`. Prefer Git when possible so there is a clear “deployed commit.”

---

## 5. Summary

| Before | After |
|--------|--------|
| Production = last `vercel deploy --prod` from local | Production = last deployment from branch `main` |
| No “deployed commit” | Every production deploy has a Git commit |
| Manual deploy from any machine | Push to `main` from any clone (or CI) |
| Env vars in Vercel | Unchanged; still in Vercel project |

Steps in short: **init Git in inthecircle-web → commit → create GitHub repo → push `main` → connect Vercel to repo → set Production Branch = main → verify env vars → confirm production.**
