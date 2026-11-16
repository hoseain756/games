// ---------------------------------------------------------------------------
// Game service — standalone Bun + socket.io mini-service (port 3003).
// All game logic lives in the shared engine module; this wrapper only adds
// process-level safety nets for standalone operation. When the Next.js server
// already hosts the engine (src/instrumentation.ts), the port is busy and
// this process exits its listener quietly.
// ---------------------------------------------------------------------------

import { startGameEngine } from '../../src/lib/game-engine'

const PORT = 3003

process.on('uncaughtException', err => {
  console.error('[game-service] uncaught exception:', err)
})
process.on('unhandledRejection', reason => {
  console.error('[game-service] unhandled rejection:', reason)
})

startGameEngine(PORT)
