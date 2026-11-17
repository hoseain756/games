'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { ENGINE_BASE } from '@/lib/realtime'
import type { LettersRole, LettersState } from '@/lib/letters-types'

/**
 * Connection to the letters realtime engine. Same-origin by default (Caddy
 * gateway / prod front server / single-container deploys), or an absolute
 * ENGINE_BASE for split deploys (Vercel frontend + external engines).
 * Never use a port in the URL — always XTransformPort.
 *
 * `code` is the session join code (required when the host locks the session).
 * When the engine rejects the join, `denied` flips true and the screen can
 * show a code entry form.
 */
export function useLettersSocket(role: LettersRole, code?: string) {
  const [state, setState] = useState<LettersState | null>(null)
  const [connected, setConnected] = useState(false)
  const [denied, setDenied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  /** serverNow - clientNow, updated inside the state event callback. */
  const [offset, setOffset] = useState(0)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // The role MUST travel inside the URL query (not the `query` option):
    // when the URI already carries `XTransformPort`, socket.io ignores the
    // option query, and Caddy forwards URL params reliably.
    const codePart = code ? `&code=${encodeURIComponent(code)}` : ''
    const instance = io(`${ENGINE_BASE}/?XTransformPort=3004&role=${role}${codePart}`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    })

    socketRef.current = instance

    const onConnect = () => {
      setConnected(true)
      // NOTE: `denied` is NOT cleared here — a connection can still be
      // rejected right after connecting. It clears only when real game
      // state arrives (onState), so the code gate keeps the typed value.
    }
    const onDisconnect = () => setConnected(false)
    const onDenied = () => {
      setConnected(false)
      setDenied(true)
      // Stop the retry loop — the user must enter the code first.
      instance.disconnect()
    }
    const onState = (next: LettersState) => {
      setOffset(next.serverNow - Date.now())
      setDenied(false)
      setState(next)
    }

    instance.on('connect', onConnect)
    instance.on('disconnect', onDisconnect)
    instance.on('letters:join_denied', onDenied)
    instance.on('letters:state', onState)

    return () => {
      instance.off('connect', onConnect)
      instance.off('disconnect', onDisconnect)
      instance.off('letters:join_denied', onDenied)
      instance.off('letters:state', onState)
      instance.removeAllListeners()
      instance.disconnect()
      socketRef.current = null
    }
  }, [role, code])

  // Local ticker so countdowns re-render smoothly.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const act = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      socketRef.current?.emit(event, payload ?? {})
    },
    [],
  )

  /** Seconds left in the current phase (server-authoritative). */
  const remaining = useMemo(() => {
    if (!state?.phaseEndsAt) return null
    const left = state.phaseEndsAt - (now + offset)
    return Math.max(0, Math.ceil(left / 1000))
  }, [state?.phaseEndsAt, now, offset])

  return { state, connected, denied, remaining, act }
}
