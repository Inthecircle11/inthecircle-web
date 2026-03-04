#!/usr/bin/env node
/**
 * One-time: enable branch protection on main so CI must pass before merge.
 * Requires: gh CLI authenticated with admin rights, or GITHUB_TOKEN with repo admin.
 *
 * Usage:
 *   node scripts/enable-branch-protection.mjs
 *   GITHUB_TOKEN=ghp_xxx node scripts/enable-branch-protection.mjs
 *
 * What it sets:
 *   - Require PR before merging to main
 *   - Require status check "build" (CI job) to pass
 *   - Do not allow force push
 *   - Do not allow branch deletion
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const repo = process.env.GITHUB_REPOSITORY || 'Inthecircle11/inthecircle-web'
const branch = process.env.BRANCH || 'main'

const payload = {
  required_status_checks: {
    strict: true,
    contexts: ['build'],
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    required_approving_review_count: 0,
    dismiss_stale_reviews: false,
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
}

const payloadPath = path.join(process.cwd(), '.branch-protection-payload.json')
fs.writeFileSync(payloadPath, JSON.stringify(payload))

try {
  const env = process.env.GITHUB_TOKEN ? { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN } : process.env
  execSync(
    `gh api -X PUT repos/${repo}/branches/${branch}/protection -H "Accept: application/vnd.github+json" --input ${payloadPath}`,
    { stdio: 'inherit', env }
  )
  console.log('Branch protection enabled for', branch)
} catch (e) {
  console.error('Failed. Ensure gh is installed and you have admin rights: gh auth login')
  process.exit(1)
} finally {
  try { fs.unlinkSync(payloadPath) } catch (_) {}
}
