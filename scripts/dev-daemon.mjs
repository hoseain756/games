// Double-fork daemon launcher for the Next.js dev server.
// The intermediate parent exits immediately, so the server is re-parented to
// init in its own session — the same pattern the agent-browser daemon uses.
import { spawn } from 'child_process'
import { openSync } from 'fs'

const out = openSync('/home/z/my-project/dev.log', 'a')
const child = spawn('bun', ['run', 'dev'], {
  cwd: '/home/z/my-project',
  detached: true,
  stdio: ['ignore', out, out],
})
child.unref()
console.log('daemonized dev server, pid =', child.pid)
