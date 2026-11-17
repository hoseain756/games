#!/usr/bin/env node
/**
 * Production front server — ONE public port for the whole app.
 *
 * Replicates the sandbox Caddy gateway:
 *   - any request (HTTP or WebSocket upgrade) whose URL carries
 *     ?XTransformPort=3003|3004 is proxied to 127.0.0.1:<port>, where the
 *     realtime game engines listen (started in-process by
 *     src/instrumentation.ts when the Next server boots);
 *   - everything else is proxied to the Next.js standalone server.
 *
 * Zero client-side changes: the socket hooks keep using
 * io('/?XTransformPort=3004') exactly as behind Caddy.
 *
 * Works on Railway / Render / Fly / any VPS — needs only Node (or Bun, via
 * process.execPath) and the standalone build produced by `bun run build`.
 */
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PORT = Number(process.env.PORT || 3000)
const NEXT_PORT = Number(process.env.NEXT_INTERNAL_PORT || 3001)
const DIST_DIR = process.env.NEXT_BUILD_DIST || '.next'
const UPSTREAM_HOST = '127.0.0.1'
const ENGINE_PORTS = new Set([3003, 3004])
// ---------------------------------------------------------------------------
// 1. Next.js standalone child process (auto-restart on crash)
// ---------------------------------------------------------------------------
const standaloneEntry = path.join(ROOT, DIST_DIR, 'standalone', 'server.js')

function startNext() {
  // NEXT_BUILD_DIST must NOT leak into the child: the standalone layout is
  // always `.next` internally, and the env would change config resolution.
  const childEnv = { ...process.env, PORT: String(NEXT_PORT), HOSTNAME: UPSTREAM_HOST, NODE_ENV: 'production' }
  delete childEnv.NEXT_BUILD_DIST
  const child = spawn(process.execPath, [standaloneEntry], {
    cwd: path.join(ROOT, DIST_DIR, 'standalone'),
    env: childEnv,
    stdio: 'inherit',
  })
  child.on('error', err => {
    // Do NOT crash the front server on spawn failure (missing build, missing
    // runtime binary...): keep proxying whatever is reachable and retry.
    console.error(`[front] cannot spawn Next standalone: ${err.message} — retrying in 2s`)
  })
  child.on('exit', code => {
    console.error(`[front] Next standalone exited (${code}) — restarting in 2s`)
    setTimeout(startNext, 2000)
  })
}
startNext()

// ---------------------------------------------------------------------------
// 2. Target resolution — the Caddy ?XTransformPort= clone
// ---------------------------------------------------------------------------
function targetPortFor(rawUrl) {
  try {
    const xtp = Number(new URL(rawUrl, 'http://internal').searchParams.get('XTransformPort'))
    if (ENGINE_PORTS.has(xtp)) return xtp
  } catch {
    // malformed URL — fall through to Next
  }
  return NEXT_PORT
}

// ---------------------------------------------------------------------------
// 3. HTTP proxying
// ---------------------------------------------------------------------------
function proxyHttp(req, res, port) {
  const upstream = http.request(
    {
      host: UPSTREAM_HOST,
      port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `${UPSTREAM_HOST}:${port}` },
    },
    upRes => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers)
      upRes.pipe(res)
    }
  )
  upstream.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    }
    res.end(`front server: upstream :${port} unavailable (${err.code || err.message})`)
  })
  req.pipe(upstream)
}

// ---------------------------------------------------------------------------
// 4. WebSocket upgrade piping (raw TCP — protocol agnostic)
// ---------------------------------------------------------------------------
function pipeUpgrade(req, socket, head, port) {
  const upstream = net.connect(port, UPSTREAM_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`]
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue
      const v = Array.isArray(value) ? value.join(', ') : value
      lines.push(`${name}: ${name.toLowerCase() === 'host' ? `${UPSTREAM_HOST}:${port}` : v}`)
    }
    upstream.write(lines.join('\r\n') + '\r\n\r\n')
    if (head && head.length > 0) upstream.write(head)
    socket.pipe(upstream)
    upstream.pipe(socket)
  })
  const abort = () => {
    socket.destroy()
    upstream.destroy()
  }
  upstream.on('error', abort)
  socket.on('error', abort)
}

// ---------------------------------------------------------------------------
// 5. Front server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  proxyHttp(req, res, targetPortFor(req.url))
})

server.on('upgrade', (req, socket, head) => {
  pipeUpgrade(req, socket, head, targetPortFor(req.url))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[front] listening on 0.0.0.0:${PORT} → next :${NEXT_PORT} | engines :3003 :3004`
  )
})

process.on('SIGTERM', () => {
  server.close()
  process.exit(0)
})
