#!/usr/bin/env node
/**
 * One-time: enable branch protection on main so CI must pass before merge.
 * Uses GitHub REST API. No gh CLI required when GITHUB_TOKEN is set.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/enable-branch-protection.mjs
 *   # Or with gh CLI: gh auth login && node scripts/enable-branch-protection.mjs
 *
 * What it sets:
 *   - Require PR before merging to main
 *   - Require status check "build" (CI job) to pass
 *   - Do not allow force push / branch deletion
 */

import fs from 'fs'
import https from 'https'

const repo = process.env.GITHUB_REPOSITORY || 'Inthecircle11/inthecircle-web'
const branch = process.env.BRANCH || 'main'
const token = process.env.GITHUB_TOKEN

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

async function main() {
  if (!token) {
    console.error('Set GITHUB_TOKEN (with repo admin scope) and run again.')
    console.error('  Create token: https://github.com/settings/tokens')
    console.error('  GITHUB_TOKEN=ghp_xxx node scripts/enable-branch-protection.mjs')
    process.exit(1)
  }

  const [owner, repoName] = repo.split('/')
  const path = `/repos/${owner}/${repoName}/branches/${branch}/protection`
  const body = JSON.stringify(payload)

  const res = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (r) => {
        let data = ''
        r.on('data', (c) => (data += c))
        r.on('end', () => resolve({ statusCode: r.statusCode, data }))
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log('Branch protection enabled for', branch)
    return
  }
  console.error('Failed:', res.statusCode, res.data)
  process.exit(1)
}

main()
