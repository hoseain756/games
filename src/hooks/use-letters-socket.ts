'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { LettersRole, LettersState } from '@/lib/letters-types'

/**
 * Connection to the letters mini-service through the Caddy gateway.
 * Never use a port in the URL — always XTransformPort.
 */
export function useLettersSocket(role: LettersRole) {
  const [state, setState] = useState<LettersState | null>(null)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  /** serverNow - clientNow, updated inside the state event callback. */
  const [offset, setOffset] = useState(0)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // The role MUST travel inside the URL query (not the `query` option):
    // when the URI already carries `XTransformPort`, socket.io ignores the
    // option query, and Caddy forwards URL params reliably.
    const instance = io(`/?XTransformPort=3004&role=${role}`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    })

    socketRef.current = instance

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onState = (next: LettersState) => {
      setOffset(next.serverNow - Date.now())
      setState(next)
    }

    instance.on('connect', onConnect)
    instance.on('disconnect', onDisconnect)
    instance.on('letters:state', onState)

    return () => {
      instance.off('connect', onConnect)
      instance.off('disconnect', onDisconnect)
      instance.off('letters:state', onState)
      instance.removeAllListeners()
      instance.disconnect()
      socketRef.current = null
    }
  }, [role])

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

  return { state, connected, remaining, act }
}
