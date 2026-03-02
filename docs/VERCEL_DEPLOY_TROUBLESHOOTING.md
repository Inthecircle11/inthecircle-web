# Vercel Deploy Troubleshooting

## Current behavior

- **CLI production deploys** (`vercel deploy --prod`): Build completes successfully (Next.js 15.2.8, webpack). Failure happens at **"Deploying outputs..."** with: `Error: We encountered an internal error. Please try again.`
- **Production** is still served by an older deployment (e.g. `63FF6qcRT`) from a previous Git push when the project was building from a different repo/setup.

## What was fixed in the repo

1. **Next.js 15** (patched 15.2.8) — avoids Next 16/Turbopack and meets Vercel security checks.
2. **Build-time rewrites** in `next.config.ts` for the admin obscure path (`ADMIN_BASE_PATH` → `/admin`), so the admin URL works once a new deploy is live.
3. **Middleware** (`src/middleware.ts`) for Next 15; typo redirects and request-id still apply.
4. **ESLint** — `ignoreDuringBuilds: true` in `next.config.ts` so the build does not fail on ESLint plugin resolution on Vercel.

## What to do next

1. **Confirm Git connection**  
   Vercel → **inthecircle-web** → **Settings** → **Git**: ensure the connected repository is **Inthecircle11/inthecircle-web** (this repo). If it is connected to a different repo (e.g. **Inthecircle** monorepo), either connect **inthecircle-web** or merge these changes into that repo and push there.

2. **Rely on Git deploys**  
   Push to `main` and let Vercel deploy from Git. Git-triggered deploys sometimes succeed when CLI deploys fail at "Deploying outputs."

3. **If Git deploy also fails**  
   Contact **Vercel Support** and include:
   - Project: **inthecircle-web**
   - Message: Build completes successfully; failure occurs at **"Deploying outputs..."** with "We encountered an internal error. Please try again."
   - Example deployment URL (from the Inspect link in the CLI output).

4. **After a successful production deploy**  
   The admin link will work:  
   `https://app.inthecircle.co/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`  
   (with `ADMIN_BASE_PATH` set in Vercel Production env).
