#!/usr/bin/env node
/**
 * ONE-TIME FIX: Ensures app.inthecircle.co is ONLY on inthecircle-web, then deploys.
 * Run once from inthecircle-web repo. After this, the domain will never point at another project.
 *
 * 1. Removes app.inthecircle.co from EVERY other project in the team.
 * 2. Adds app.inthecircle.co to inthecircle-web if missing.
 * 3. Runs vercel deploy --prod.
 *
 * Prereq: vercel login (or set VERCEL_TOKEN)
 * Usage: npm run one-time-fix
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'
import { spawn } from 'child_process'

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
  if (!token) throw new Error('No Vercel token. Run: vercel login')
  const url = path.startsWith('http') ? path : `${VERCEL_API}${path}`
  const res = await fetch(url, {
    method: 'GET',
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
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('application/json')) return res.json()
  return undefined
}

async function apiDelete(path) {
  const token = getToken()
  if (!token) throw new Error('No Vercel token. Run: vercel login')
  const url = path.startsWith('http') ? path : `${VERCEL_API}${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Vercel API DELETE ${res.status}: ${text}`)
  }
  return res
}

async function apiPost(path, body) {
  const token = getToken()
  if (!token) throw new Error('No Vercel token. Run: vercel login')
  const url = path.startsWith('http') ? path : `${VERCEL_API}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vercel API POST ${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('application/json')) return res.json()
  return undefined
}

function domainNames(projectOrList) {
  const raw = Array.isArray(projectOrList) ? projectOrList : (projectOrList.domains ?? [])
  return raw.map((d) => (typeof d === 'string' ? d : (d && (d.name || d.domain)) || '')).filter(Boolean)
}

async function main() {
  if (!getToken()) {
    console.error('No Vercel token. Run: vercel login  (or set VERCEL_TOKEN)')
    process.exit(1)
  }

  console.log('ONE-TIME FIX: Making sure app.inthecircle.co is ONLY on inthecircle-web, then deploying.\n')

  const projects = await api(`/v9/projects?teamId=${TEAM_ID}&limit=100`)
  const list = projects.projects ?? projects
  if (!Array.isArray(list)) {
    console.error('Unexpected API response')
    process.exit(1)
  }

  let ownerProjectId = null
  const toRemove = [] // { id, name }

  for (const p of list) {
    const name = p.name
    const id = p.id ?? p.projectId
    let names = []
    try {
      const project = await api(`/v9/projects/${id}?teamId=${TEAM_ID}`)
      names = domainNames(project)
      if (names.length === 0) {
        const domainsRes = await api(`/v9/projects/${id}/domains?teamId=${TEAM_ID}`)
        const domainsList = domainsRes.domains ?? domainsRes
        names = domainNames(Array.isArray(domainsList) ? domainsList : [domainsList])
      }
    } catch (e) {
      console.warn(`Could not get domains for ${name}:`, e.message)
      continue
    }
    const hasDomain = names.includes(PRODUCTION_DOMAIN)
    if (name === OWNER_PROJECT_NAME) {
      ownerProjectId = id
      if (!hasDomain) {
        console.log(`Adding ${PRODUCTION_DOMAIN} to ${OWNER_PROJECT_NAME}...`)
        await apiPost(`/v10/projects/${id}/domains?teamId=${TEAM_ID}`, { name: PRODUCTION_DOMAIN })
        console.log('Done.\n')
      }
      continue
    }
    if (hasDomain) toRemove.push({ id, name })
  }

  if (!ownerProjectId) {
    console.error(`Project "${OWNER_PROJECT_NAME}" not found in team.`)
    process.exit(1)
  }

  for (const { id, name } of toRemove) {
    console.log(`Removing ${PRODUCTION_DOMAIN} from project "${name}"...`)
    await apiDelete(`/v9/projects/${id}/domains/${encodeURIComponent(PRODUCTION_DOMAIN)}?teamId=${TEAM_ID}`)
    console.log('Removed.\n')
  }

  if (toRemove.length === 0) {
    console.log('Domain was not on any other project. Proceeding to deploy.\n')
  }

  console.log('Deploying inthecircle-web to production...\n')
  const child = spawn('vercel', ['deploy', '--prod'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  child.on('close', (code) => process.exit(code != null ? code : 0))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
