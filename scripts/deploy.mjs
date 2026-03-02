#!/usr/bin/env node
/**
 * Run domain verification (when token is available), then always run production deploy.
 * If verification fails (403, no token, etc.), we still deploy so you are not blocked.
 *
 * Usage: npm run deploy
 */

import { spawn } from 'child_process'

async function runVerify() {
  const { spawnSync } = await import('child_process')
  const r = spawnSync('node', ['scripts/verify-domain-ownership.mjs'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  return r.status === 0
}

async function runDeploy() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['vercel', 'deploy', '--prod'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    })
    child.on('close', (code) => resolve(code === 0))
  })
}

async function main() {
  const verifyOk = await runVerify()
  if (!verifyOk) {
    console.warn('\nDomain verification failed or skipped — continuing with deploy anyway.\n')
  }
  const deployOk = await runDeploy()
  process.exit(deployOk ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
