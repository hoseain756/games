// ---------------------------------------------------------------------------
// Realtime engine base URL — platform-flexible socket connections.
//
// - EMPTY (default): sockets use the same origin. This covers the sandbox
//   Caddy gateway, the production front server (scripts/prod-server.mjs) and
//   any single-container deploy (Railway / Render / Docker / VPS) where the
//   engines run in-process next to Next.js.
//
// - SET: split deployment — frontend on Vercel (no WebSocket support there)
//   with the realtime engines hosted on a separate always-on service.
//   NEXT_PUBLIC_ENGINE_BASE=https://<engine-service-host>
//   NOTE: NEXT_PUBLIC_* is inlined at BUILD time — redeploy after changing it.
// ---------------------------------------------------------------------------

export const ENGINE_BASE = (process.env.NEXT_PUBLIC_ENGINE_BASE ?? '')
  .trim()
  .replace(/\/+$/, '')
