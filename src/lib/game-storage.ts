import type { GameOptions } from '@/lib/game-types'

/**
 * Storage helpers. The player identity uses sessionStorage so every browser
 * tab acts as an independent player (useful when several people share a
 * device during testing). Host data uses localStorage to survive reloads.
 */

const IDENTITY_KEY = 'qg-identity'
const HOST_ROOM_KEY = 'qg-host-room'
const OPTS_KEY = 'qg-opts'

export interface StoredIdentity {
  playerId: string
  name: string
  selfie: string
  code: string
}

export interface StoredHostRoom {
  code: string
}

function safeSession(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null
    return window.sessionStorage
  } catch {
    return null
  }
}

function safeLocal(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Stable per-tab player id (uuid). */
export function getPlayerId(): string {
  const session = safeSession()
  if (!session) return `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  let id = session.getItem('qg-player-id')
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    try {
      session.setItem('qg-player-id', id)
    } catch {
      /* ignore */
    }
  }
  return id
}

export function loadIdentity(code?: string): StoredIdentity | null {
  const session = safeSession()
  if (!session) return null
  try {
    const raw = session.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredIdentity
    if (!parsed?.playerId || !parsed?.name || !parsed?.code) return null
    if (code && parsed.code !== code) return null
    return parsed
  } catch {
    return null
  }
}

export function saveIdentity(identity: StoredIdentity): void {
  const session = safeSession()
  if (!session) return
  try {
    session.setItem(IDENTITY_KEY, JSON.stringify(identity))
  } catch {
    /* ignore */
  }
}

export function clearIdentity(): void {
  const session = safeSession()
  if (!session) return
  try {
    session.removeItem(IDENTITY_KEY)
  } catch {
    /* ignore */
  }
}

export function loadHostRoom(): StoredHostRoom | null {
  const local = safeLocal()
  if (!local) return null
  try {
    const raw = local.getItem(HOST_ROOM_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredHostRoom
    return parsed?.code ? parsed : null
  } catch {
    return null
  }
}

export function saveHostRoom(code: string): void {
  const local = safeLocal()
  if (!local) return
  try {
    local.setItem(HOST_ROOM_KEY, JSON.stringify({ code }))
  } catch {
    /* ignore */
  }
}

export function clearHostRoom(): void {
  const local = safeLocal()
  if (!local) return
  try {
    local.removeItem(HOST_ROOM_KEY)
  } catch {
    /* ignore */
  }
}

export function loadOpts(): GameOptions | null {
  const local = safeLocal()
  if (!local) return null
  try {
    const raw = local.getItem(OPTS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { opts?: GameOptions }
    if (!parsed?.opts || typeof parsed.opts !== 'object') return null
    return { norepeat: parsed.opts.norepeat === true, shuffle: parsed.opts.shuffle === true }
  } catch {
    return null
  }
}

export function saveOpts(opts: GameOptions): void {
  const local = safeLocal()
  if (!local) return
  try {
    local.setItem(OPTS_KEY, JSON.stringify({ opts }))
  } catch {
    /* ignore */
  }
}
