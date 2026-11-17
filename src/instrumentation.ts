/**
 * Next.js instrumentation hook — runs once when the server boots (dev and
 * standalone production alike).
 *
 * It boots the two realtime game engines (letters :3004, questions :3003)
 * INSIDE the Next.js server process. On single-container deployments
 * (Railway / Render / Docker / VPS) nothing else owns those ports, so the
 * engines bind here and scripts/prod-server.mjs routes every request that
 * carries ?XTransformPort=3003|3004 to them — a drop-in replacement for the
 * sandbox Caddy gateway.
 *
 * In this sandbox the supervised mini-services already own the ports; both
 * engines tolerate EADDRINUSE and stand aside quietly (see
 * src/lib/engine-host.ts), so starting them here is always safe.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { ensureGameEngines } = await import('./lib/engine-host')
  ensureGameEngines()
}
