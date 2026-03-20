# `vercel.json` rules (read this before editing)

**Do not add keys that are not in the [official Vercel schema](https://vercel.com/docs/project-configuration/vercel-json)** — Vercel validates `vercel.json` and **rejects unknown keys** (including `_comment`). That will fail the deployment before `next build` runs.

## Allowed in this repo

- **`headers`** only (security headers + Apple association file).

## Forbidden

- **`rewrites`** that point to `*.html` or shadow Next.js routes (`/`, `/signup`, `/admin`, …). Next.js App Router owns those paths.
- **Random documentation keys** in `vercel.json` — put notes here or in `DEPLOYMENT.md` instead.

## Checks

- `npm run check:vercel-routing`
- `next.config.ts` also validates rewrites at build time
