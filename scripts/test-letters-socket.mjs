/* Test letters socket through the Caddy gateway using Node (reliable XHR).
 * Usage: node scripts/test-letters-socket.mjs [wsFirst|pollingFirst]
 */
import { io } from 'socket.io-client'

const mode = process.argv[2] || 'wsFirst'
const transports = mode === 'wsFirst' ? ['websocket', 'polling'] : ['polling', 'websocket']

const started = Date.now()
const ts = () => `+${Date.now() - started}ms`

console.log(`[${ts()}] connecting (${mode}) ...`)
const socket = io('/?XTransformPort=3004&role=teamA', {
  transports,
  forceNew: true,
  reconnection: true,
  timeout: 10000,
})

const hardStop = setTimeout(() => {
  console.log(`[${ts()}] RESULT: TIMEOUT — no letters:state after 20s`)
  process.exit(2)
}, 20000)

socket.on('connect', () => console.log(`[${ts()}] CONNECTED via ${socket.io.engine.transport.name}`))
socket.on('connect_error', err => console.log(`[${ts()}] connect_error: ${err.message}`))
socket.on('reconnect_attempt', n => console.log(`[${ts()}] reconnect attempt #${n}`))
socket.on('letters:state', s => {
  console.log(`[${ts()}] STATE RECEIVED: phase=${s.phase} bank=${JSON.stringify(s.bankInfo)}`)
  clearTimeout(hardStop)
  socket.disconnect()
  process.exit(0)
})
