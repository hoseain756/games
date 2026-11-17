'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { ENGINE_BASE } from '@/lib/realtime'

/**
 * Single shared connection to the questions realtime engine. Same-origin by
 * default (Caddy gateway / prod front server / single-container deploys), or
 * an absolute ENGINE_BASE for split deploys (Vercel frontend + external
 * engines). Never use a port in the URL — always XTransformPort.
 */
export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const instance = io(`${ENGINE_BASE}/?XTransformPort=3003`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    })

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    instance.on('connect', onConnect)
    instance.on('disconnect', onDisconnect)
    // Defer so we do not call setState synchronously inside the effect body.
    const timer = window.setTimeout(() => setSocket(instance), 0)

    return () => {
      window.clearTimeout(timer)
      instance.off('connect', onConnect)
      instance.off('disconnect', onDisconnect)
      instance.removeAllListeners()
      instance.disconnect()
    }
  }, [])

  return { socket, connected }
}
