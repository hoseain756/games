#!/usr/bin/env node
/**
 * Sandbox prod daemon — serves the PRODUCTION Next.js build on port 3000
 * (the sandbox's externally-exposed default) instead of the dev server.
 *
 * Why: the Z.AI preview edge (WAF + function relay) chokes on the dev
 * bundle (~5.5 MB of unminified chunks, no-store caching) — phones scanning
 * the join QR codes wait forever and never open the page. The production
 * build ships the same app in a few hundred KB and opens in 1-3s.
 *
 * How it survives the sandbox process reaper: same double-fork pattern as
 * scripts/services-daemon.mjs — spawn(detached: true) + unref() from this
 * short-lived parent, stdio appended to dev.log.
 *
 * The standalone server's instrumentation.ts boots the game engines
 * (:3003 / :3004) inside the same process; if the mini-service daemons
 * already own those ports they stand aside quietly (EADDRINUSE tolerated).
 *
 * Rebuild + restart loop for code changes:
 *   kill <pid of next-server on :3000>
 *   node scripts/sandbox-prod-daemon.mjs
 */
import { spawn } from 'child_process'
import { appendFileSync, openSync } from 'node:fs'

const PORT = 3000
const ROOT = '/home/z/my-project'
const LOG = `${ROOT}/dev.log`

const out = openSync(LOG, 'a')
appendFileSync(
  LOG,
  `\n[sandbox-prod] starting production server on :${PORT} (${new Date().toISOString()})\n`,
)

const child = spawn('node', ['.next/standalone/server.js'], {
  cwd: ROOT,
  detached: true,
  stdio: ['ignore', out, out],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '0.0.0.0',
    NEXT_TELEMETRY_DISABLED: '1',
  },
})
child.unref()
console.log(`[sandbox-prod] daemonized production server, pid = ${child.pid}`)
