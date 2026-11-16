// ---------------------------------------------------------------------------
// Letters service — standalone Bun + socket.io mini-service (port 3004).
// All game logic lives in the shared engine module; this wrapper only adds
// process-level safety nets for standalone operation. When the Next.js server
// already hosts the engine (src/instrumentation.ts), the port is busy and
// this process exits its listener quietly.
// ---------------------------------------------------------------------------

import { startLettersEngine } from '../../src/lib/letters-engine'

const PORT = 3004

process.on('uncaughtException', err => {
  console.error('[letters-service] uncaught exception:', err)
})
process.on('unhandledRejection', reason => {
  console.error('[letters-service] unhandled rejection:', reason)
})

startLettersEngine(PORT)
