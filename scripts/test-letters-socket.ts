import { io } from 'socket.io-client'

// Reproduce exactly what use-letters-socket.ts does (through Caddy, ws first).
const url = process.env.SOCKET_URL || '/?XTransformPort=3004&role=teamA'
const origin = process.env.SOCKET_ORIGIN || 'http://localhost:81'

console.log(`connecting to ${origin}${url}`)
const socket = io(url, {
  transports: ['websocket', 'polling'],
  forceNew: true,
  reconnection: true,
  timeout: 10000,
})

const deadline = setTimeout(() => {
  console.log('RESULT: TIMEOUT after 15s — no state received')
  process.exit(2)
}, 15000)

socket.on('connect', () => {
  console.log('CONNECTED, transport =', socket.io.engine.transport.name)
})
socket.on('letters:state', state => {
  clearTimeout(deadline)
  console.log('STATE RECEIVED: phase =', state.phase, '| round =', state.roundNumber, '| bank =', JSON.stringify(state.bankInfo))
  socket.disconnect()
  process.exit(0)
})
socket.on('connect_error', err => {
  console.log('connect_error:', err.message)
})
