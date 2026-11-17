import { spawn } from 'child_process'
import { openSync } from 'fs'

/**
 * Daemonizes the socket.io mini-services (letters-engine :3004, game-engine
 * :3003) so they survive the sandbox process reaper — double-fork style with
 * detached: true + unref(), logging into dev.log.
 */
const out = openSync('/home/z/my-project/dev.log', 'a')

const services = [
  { name: 'letters-engine', cwd: '/home/z/my-project/mini-services/letters-service' },
  { name: 'game-engine', cwd: '/home/z/my-project/mini-services/game-service' },
]

for (const svc of services) {
  const child = spawn('bun', ['run', 'dev'], {
    cwd: svc.cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  child.unref()
  console.log(`daemonized ${svc.name}, pid = ${child.pid}`)
}
