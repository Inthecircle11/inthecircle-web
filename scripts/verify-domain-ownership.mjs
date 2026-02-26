#!/usr/bin/env node
/**
 * Ensures app.inthecircle.co is ONLY attached to the inthecircle-web project.
 * Run before deploy or in CI to prevent the domain pointing at the wrong app.
 *
 * Token: VERCEL_TOKEN env, or (if not set) token from `vercel login` auth file.
 * Optional: TEAM_ID (defaults to Ahmed Khalifa's team)
 *
 * Usage: node scripts/verify-domain-ownership.mjs
 *        npm run verify-domain
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'

const PRODUCTION_DOMAIN = 'app.inthecircle.co'
const OWNER_PROJECT_NAME = 'inthecircle-web'
const TEAM_ID = process.env.TEAM_ID || 'team_pPf6WSH38ILGLhFASbKqYYgL'
const VERCEL_API = 'https://api.vercel.com'

function getToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  const dirs = {
    darwin: join(homedir(), 'Library', 'Application Support', 'com.vercel.cli'),
    linux: join(homedir(), '.local', 'share', 'com.vercel.cli'),
    win32: join(process.env.APPDATA || homedir(), 'com.vercel.cli'),
  }
  const dir = dirs[platform()] || dirs.linux
  try {
    const raw = readFileSync(join(dir, 'auth.json'), 'utf8')
    const data = JSON.parse(raw)
    return data.token || null
  } catch {
    return null
  }
}

async function api(path, options = {}) {
  const token = getToken()
  if (!token) {
    throw new Error('VERCEL_TOKEN is required for verification')
  }
  const url = path.startsWith('http') ? path : `${VERCEL_API}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vercel API ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  if (!getToken()) {
    console.warn('No Vercel token found — skipping domain verification.')
    console.warn('From CLI: run  vercel login  once, or set env  VERCEL_TOKEN  (from https://vercel.com/account/tokens).\n')
    process.exit(0)
  }

  console.log(`Checking that "${PRODUCTION_DOMAIN}" is only on project "${OWNER_PROJECT_NAME}"...\n`)

  const projects = await api(`/v9/projects?teamId=${TEAM_ID}&limit=100`)
  const list = projects.projects ?? projects
  if (!Array.isArray(list)) {
    console.error('Unexpected API response (no projects array)')
    process.exit(1)
  }

  const projectsWithDomain = []
  let ownerHasDomain = false

  function domainNames(projectOrList) {
    const raw = Array.isArray(projectOrList) ? projectOrList : (projectOrList.domains ?? [])
    return raw.map((d) => (typeof d === 'string' ? d : (d && (d.name || d.domain)) || '')).filter(Boolean)
  }

  for (const p of list) {
    const name = p.name
    const id = p.id ?? p.projectId
    const project = await api(`/v9/projects/${id}?teamId=${TEAM_ID}`)
    let names = domainNames(project)
    if (names.length === 0) {
      try {
        const domainsRes = await api(`/v9/projects/${id}/domains?teamId=${TEAM_ID}`)
        const domainsList = domainsRes.domains ?? domainsRes
        names = domainNames(Array.isArray(domainsList) ? domainsList : [domainsList])
      } catch {
        // no separate domains endpoint or error
      }
    }
    const hasDomain = names.includes(PRODUCTION_DOMAIN)
    if (hasDomain) {
      projectsWithDomain.push(name)
      if (name === OWNER_PROJECT_NAME) ownerHasDomain = true
    }
  }

  if (projectsWithDomain.length === 0) {
    console.error(`Domain "${PRODUCTION_DOMAIN}" is not attached to any project in this team.`)
    console.error(`Add it to "${OWNER_PROJECT_NAME}" in Vercel Dashboard → Project → Settings → Domains.\n`)
    process.exit(1)
  }

  if (projectsWithDomain.length > 1) {
    console.error(`Domain "${PRODUCTION_DOMAIN}" is attached to MULTIPLE projects:`)
    projectsWithDomain.forEach((n) => console.error(`  - ${n}`))
    console.error(`\nOnly "${OWNER_PROJECT_NAME}" should have this domain.`)
    console.error(`Remove it from the other project(s) in Vercel Dashboard, or run:`)
    console.error(`  ./scripts/move-domain-to-inthecircle-web.sh\n`)
    process.exit(1)
  }

  if (projectsWithDomain[0] !== OWNER_PROJECT_NAME) {
    console.error(`Domain "${PRODUCTION_DOMAIN}" is on project "${projectsWithDomain[0]}", not "${OWNER_PROJECT_NAME}".`)
    console.error(`Move the domain to inthecircle-web: run ./scripts/move-domain-to-inthecircle-web.sh\n`)
    process.exit(1)
  }

  if (!ownerHasDomain) {
    console.error(`Unexpected: owner project "${OWNER_PROJECT_NAME}" should have the domain.`)
    process.exit(1)
  }

  console.log(`OK: "${PRODUCTION_DOMAIN}" is only on "${OWNER_PROJECT_NAME}". Safe to deploy.\n`)
  console.log('Production deploys via Git: push to main. Use "npm run preview" for a preview deploy.\n')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
