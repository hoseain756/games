#!/usr/bin/env node
/**
 * Post-build step for `next build` (runs under Node or Bun).
 *
 * Copies the browser static assets into the standalone server bundle —
 * Next.js does not include them automatically:
 *   <dist>/static  →  <dist>/standalone/.next/static
 *   public/        →  <dist>/standalone/public
 *
 * NOTE: the dist dir name must stay the default `.next`. A custom distDir
 * (env override) gets baked into the standalone server.js paths and breaks
 * static asset serving. Isolated builds should copy the project instead
 * (see the deployment probe / CI).
 */
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, '.next')
const standalone = path.join(dist, 'standalone')

if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('[postbuild] standalone output missing — run `next build` first')
  process.exit(1)
}

cpSync(path.join(dist, 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
})
if (existsSync(path.join(root, 'public'))) {
  cpSync(path.join(root, 'public'), path.join(standalone, 'public'), {
    recursive: true,
  })
}
console.log('[postbuild] static assets + public copied into standalone')
