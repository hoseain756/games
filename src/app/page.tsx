'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/game/app-header'
import { AppFooter } from '@/components/game/app-footer'
import { HostSetup } from '@/components/game/host-setup'
import { HostLobby } from '@/components/game/host-lobby'
import { HostGame } from '@/components/game/host-game'
import { PlayerJoin } from '@/components/game/player-join'
import { PlayerEnd, PlayerPlay, PlayerWait } from '@/components/game/player-screens'
import { ErrorState } from '@/components/game/error-state'
import { useGameSocket } from '@/hooks/use-game-socket'
import { useToast } from '@/hooks/use-toast'
import type {
  GameOptions,
  HostView,
  PlayerView,
  PublicPlayer,
  TurnState,
} from '@/lib/game-types'
import {
  clearHostRoom,
  clearIdentity,
  getPlayerId,
  loadHostRoom,
  loadIdentity,
  loadSetup,
  saveHostRoom,
  saveIdentity,
  saveSetup,
  type StoredIdentity,
} from '@/lib/game-storage'

type Mode = 'host' | 'player'

function LoaderCard({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="font-bold text-muted-foreground">{title}</p>
    </div>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function parsePlayers(value: unknown): PublicPlayer[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asRecord(item))
    .filter(item => typeof item.id === 'string' && typeof item.name === 'string')
    .map(item => ({
      id: item.id as string,
      name: item.name as string,
      selfie: typeof item.selfie === 'string' ? item.selfie : '',
      connected: item.connected !== false,
    }))
}

function parseTurn(value: unknown): TurnState | null {
  const rec = asRecord(value)
  const currentPlayerRec = asRecord(rec.currentPlayer)
  if (typeof rec.round !== 'number' || typeof rec.turnNo !== 'number') return null
  const hasPlayer = typeof currentPlayerRec.id === 'string' && typeof currentPlayerRec.name === 'string'
  return {
    round: rec.round,
    turnNo: rec.turnNo,
    total: typeof rec.total === 'number' ? rec.total : 0,
    currentPlayer: hasPlayer
      ? {
          id: currentPlayerRec.id as string,
          name: currentPlayerRec.name as string,
          selfie: typeof currentPlayerRec.selfie === 'string' ? currentPlayerRec.selfie : '',
          connected: currentPlayerRec.connected !== false,
        }
      : null,
  }
}

export default function Home() {
  const { socket, connected } = useGameSocket()
  const { toast } = useToast()

  const [booted, setBooted] = useState(false)
  const [mode, setMode] = useState<Mode>('host')
  const [hostView, setHostView] = useState<HostView>('setup')
  const [playerView, setPlayerView] = useState<PlayerView>('join')

  // Host state
  const [questions, setQuestions] = useState<string[]>([])
  const [opts, setOpts] = useState<GameOptions>({ norepeat: true, shuffle: false })
  const [players, setPlayers] = useState<PublicPlayer[]>([])
  const [turn, setTurn] = useState<TurnState | null>(null)
  const [hostQuestion, setHostQuestion] = useState<string | null>(null)
  const [peeking, setPeeking] = useState(false)

  // Shared / player state
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joinSelfie, setJoinSelfie] = useState<string | null>(null)
  const [joinCameraFailed, setJoinCameraFailed] = useState(false)
  const [myId, setMyId] = useState('')
  const [myName, setMyName] = useState('')
  const [mySelfie, setMySelfie] = useState('')
  const [myQuestion, setMyQuestion] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  // Mutable values read from event handlers and effects only (never during render).
  const modeRef = useRef<Mode>('host')
  const hostViewRef = useRef<HostView>('setup')
  const playerViewRef = useRef<PlayerView>('join')
  const roomCodeRef = useRef<string | null>(null)
  const toastRef = useRef(toast)
  const identityRef = useRef<StoredIdentity | null>(null)
  const bootedRef = useRef(false)

  // Keep the refs in sync with the latest render values (allowed inside effects).
  useEffect(() => {
    toastRef.current = toast
    modeRef.current = mode
    hostViewRef.current = hostView
    playerViewRef.current = playerView
    roomCodeRef.current = roomCode
  })

  // Restore host draft (questions/options) after mount to avoid SSR mismatch.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = loadSetup()
      if (saved) {
        setQuestions(saved.questions)
        setOpts(saved.opts)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  // Persist host setup locally.
  useEffect(() => {
    if (questions.length || opts.norepeat || opts.shuffle) {
      saveSetup({ questions, opts })
    }
  }, [questions, opts])

  const handleSelfieChange = useCallback((value: string | null) => {
    setJoinSelfie(value)
  }, [])

  const handleJoin = useCallback(
    (name: string, selfie: string) => {
      if (!socket || !roomCode) return
      const playerId = getPlayerId()
      setMyId(playerId)
      setMySelfie(selfie)
      identityRef.current = { playerId, name, selfie, code: roomCode }
      setJoining(true)
      socket.emit('player:join', { code: roomCode, playerId, name, selfie })
    },
    [socket, roomCode],
  )

  // ---- Socket event wiring -------------------------------------------------
  useEffect(() => {
    if (!socket) return

    const onRoomCreated = (payload: unknown) => {
      const rec = asRecord(payload)
      if (typeof rec.code !== 'string') return
      const code = rec.code
      const state = rec.state === 'playing' ? 'playing' : 'lobby'
      if (modeRef.current === 'host') {
        setRoomCode(code)
        roomCodeRef.current = code
        saveHostRoom(code)
        if (Array.isArray(rec.questions)) {
          const qs = rec.questions.filter((q): q is string => typeof q === 'string')
          setQuestions(qs)
        }
        if (typeof rec.opts === 'object' && rec.opts !== null) {
          const o = rec.opts as GameOptions
          setOpts({ norepeat: o.norepeat === true, shuffle: o.shuffle === true })
        }
        setPlayers([])
        setTurn(null)
        setHostQuestion(null)
        setPeeking(false)
        setHostView(state === 'playing' ? 'game' : 'lobby')
      }
    }

    const onLobbyUpdate = (payload: unknown) => {
      const rec = asRecord(payload)
      setPlayers(parsePlayers(rec.players))
    }

    const onJoinedOk = (payload: unknown) => {
      const rec = asRecord(payload)
      const name = typeof rec.name === 'string' ? rec.name : ''
      const state = rec.state === 'playing' ? 'playing' : 'lobby'
      setJoining(false)
      setMyName(name)
      if (state === 'playing') {
        setPlayerView('play')
      } else {
        setPlayerView('wait')
      }
      if (identityRef.current) {
        const identity: StoredIdentity = {
          ...identityRef.current,
          name,
          code: roomCodeRef.current ?? identityRef.current.code,
        }
        identityRef.current = identity
        saveIdentity(identity)
      }
    }

    const onGameTurn = (payload: unknown) => {
      const parsed = parseTurn(payload)
      if (!parsed) return
      setTurn(parsed)
      setMyQuestion(null)
      setHostQuestion(null)
      setPeeking(false)
      if (modeRef.current === 'player') {
        setPlayerView('play')
      } else {
        // Move the host from the lobby (or a reconnecting state) into the game.
        setHostView('game')
      }
    }

    const onPlayerQuestion = (payload: unknown) => {
      const text = asRecord(payload).text
      if (typeof text === 'string') setMyQuestion(text)
    }

    const onHostQuestion = (payload: unknown) => {
      const text = asRecord(payload).text
      setHostQuestion(typeof text === 'string' ? text : null)
    }

    const onGameEnded = () => {
      if (modeRef.current === 'host') {
        setHostView('lobby')
        setTurn(null)
        setHostQuestion(null)
        setPeeking(false)
      } else {
        setPlayerView('end')
      }
    }

    const onRoomError = (payload: unknown) => {
      const rec = asRecord(payload)
      const message = typeof rec.message === 'string' ? rec.message : 'حدث خطأ غير متوقع'
      setJoining(false)
      toastRef.current({ description: message })
      if (modeRef.current === 'host' && hostViewRef.current === 'reconnecting') {
        clearHostRoom()
        setHostView('setup')
      }
      if (modeRef.current === 'player' && playerViewRef.current === 'reconnecting') {
        clearIdentity()
        identityRef.current = null
        setPlayerView('join')
      }
    }

    const onRoomClosed = () => {
      if (modeRef.current === 'host') {
        clearHostRoom()
        setHostView('setup')
        toastRef.current({ description: 'أغلقت الغرفة' })
      } else {
        clearIdentity()
        identityRef.current = null
        setPlayerView('join')
        toastRef.current({ description: 'أُغلقت الغرفة، يمكنك الانضمام لغرفة جديدة' })
      }
    }

    const onHostOffline = () => {
      if (modeRef.current === 'player') {
        toastRef.current({ description: 'انقطع اتصال المضيف، انتظر قليلاً حتى يرجع' })
      }
    }

    const onServiceToast = (payload: unknown) => {
      const message = asRecord(payload).message
      if (typeof message === 'string') toastRef.current({ description: message })
    }

    socket.on('room:created', onRoomCreated)
    socket.on('lobby:update', onLobbyUpdate)
    socket.on('player:joined-ok', onJoinedOk)
    socket.on('game:turn', onGameTurn)
    socket.on('player:question', onPlayerQuestion)
    socket.on('host:question', onHostQuestion)
    socket.on('game:ended', onGameEnded)
    socket.on('room:error', onRoomError)
    socket.on('room:closed', onRoomClosed)
    socket.on('host:offline', onHostOffline)
    socket.on('toast', onServiceToast)

    return () => {
      socket.off('room:created', onRoomCreated)
      socket.off('lobby:update', onLobbyUpdate)
      socket.off('player:joined-ok', onJoinedOk)
      socket.off('game:turn', onGameTurn)
      socket.off('player:question', onPlayerQuestion)
      socket.off('host:question', onHostQuestion)
      socket.off('game:ended', onGameEnded)
      socket.off('room:error', onRoomError)
      socket.off('room:closed', onRoomClosed)
      socket.off('host:offline', onHostOffline)
      socket.off('toast', onServiceToast)
    }
  }, [socket])

  // ---- Boot: decide host vs player from the URL ----------------------------
  useEffect(() => {
    if (!socket || !connected || bootedRef.current) return
    const id = window.setTimeout(() => {
      if (bootedRef.current) return
      bootedRef.current = true
      setBooted(true)

      const params = new URLSearchParams(window.location.search)
      const room = params.get('room')?.trim().toUpperCase()

      if (room) {
        setMode('player')
        modeRef.current = 'player'
        setRoomCode(room)
        roomCodeRef.current = room
        const saved = loadIdentity(room)
        if (saved) {
          setMyId(saved.playerId)
          identityRef.current = saved
          setJoinName(saved.name)
          setJoinSelfie(saved.selfie)
          setMyName(saved.name)
          setMySelfie(saved.selfie)
          setPlayerView('reconnecting')
          socket.emit('player:join', {
            code: room,
            playerId: saved.playerId,
            name: saved.name,
            selfie: saved.selfie,
          })
        } else {
          setPlayerView('join')
        }
      } else {
        setMode('host')
        modeRef.current = 'host'
        const savedRoom = loadHostRoom()
        if (savedRoom?.code) {
          setRoomCode(savedRoom.code)
          roomCodeRef.current = savedRoom.code
          setHostView('reconnecting')
          socket.emit('host:reconnect', { code: savedRoom.code })
        } else {
          setHostView('setup')
        }
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [socket, connected])

  // ---- Re-attach after a temporary socket reconnection ---------------------
  useEffect(() => {
    if (!socket) return
    let firstConnect = true
    const onConnect = () => {
      if (firstConnect) {
        firstConnect = false
        return
      }
      // The socket id changes across reconnects; restore membership server-side.
      if (!bootedRef.current) return
      if (modeRef.current === 'host' && roomCodeRef.current) {
        socket.emit('host:reconnect', { code: roomCodeRef.current })
      } else if (modeRef.current === 'player' && roomCodeRef.current && identityRef.current) {
        socket.emit('player:join', {
          code: roomCodeRef.current,
          playerId: identityRef.current.playerId,
          name: identityRef.current.name,
          selfie: identityRef.current.selfie,
        })
      }
    }
    socket.on('connect', onConnect)
    return () => {
      socket.off('connect', onConnect)
    }
  }, [socket])

  // ---- Safety net: never hang forever waiting for a room that may be gone --
  // If the service is unreachable or the room expired without a reply, bail
  // out of the "reconnecting" spinner after a short grace period.
  useEffect(() => {
    if (hostView !== 'reconnecting' && playerView !== 'reconnecting') return
    const timer = window.setTimeout(() => {
      if (hostViewRef.current === 'reconnecting') {
        clearHostRoom()
        setHostView('setup')
        toastRef.current({ description: 'ما قدرنا نستعيد الغرفة، أنشئ غرفة جديدة' })
      } else if (playerViewRef.current === 'reconnecting') {
        clearIdentity()
        identityRef.current = null
        setPlayerView('join')
        toastRef.current({ description: 'ما قدرنا نوصل للغرفة، حاول مرة ثانية' })
      }
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [hostView, playerView])

  // ---- Host actions ---------------------------------------------------------
  const createRoom = useCallback(() => {
    if (!socket) return
    setHostView('reconnecting')
    socket.emit('host:create', { questions, opts })
  }, [socket, questions, opts])

  const startGame = useCallback(() => {
    socket?.emit('host:start')
  }, [socket])

  const nextTurn = useCallback(() => {
    if (!socket) return
    if (peeking) socket.emit('host:hide')
    socket.emit('host:next')
  }, [socket, peeking])

  const rerollQuestion = useCallback(() => {
    socket?.emit('host:reroll')
  }, [socket])

  const peekQuestion = useCallback(() => {
    setPeeking(true)
    socket?.emit('host:peek')
  }, [socket])

  const hideQuestion = useCallback(() => {
    setPeeking(false)
    socket?.emit('host:hide')
  }, [socket])

  const endGame = useCallback(() => {
    socket?.emit('host:end')
  }, [socket])

  /** Player taps "التالي" on his own phone: pass the turn to the next player. */
  const playerNextTurn = useCallback(() => {
    socket?.emit('player:next')
  }, [socket])

  const closeRoom = useCallback(() => {
    clearHostRoom()
    socket?.emit('host:close')
    setHostView('setup')
    setPlayers([])
  }, [socket])

  // ---- Render ----------------------------------------------------------------
  const renderHost = () => {
    switch (hostView) {
      case 'setup':
        return (
          <HostSetup
            questions={questions}
            opts={opts}
            onQuestionsChange={setQuestions}
            onOptsChange={setOpts}
            onCreate={createRoom}
            busy={false}
          />
        )
      case 'reconnecting':
        return <LoaderCard title={roomCode ? `جاري استعادة الغرفة ${roomCode}...` : 'جاري إنشاء الغرفة...'} />
      case 'lobby':
        return roomCode ? (
          <HostLobby
            code={roomCode}
            players={players}
            questionsCount={questions.length}
            onStart={startGame}
            onClose={closeRoom}
          />
        ) : (
          <LoaderCard title="جاري تحميل الغرفة..." />
        )
      case 'game':
        return turn ? (
          <HostGame
            turn={turn}
            players={players}
            hostQuestion={hostQuestion}
            peeking={peeking}
            onPeek={peekQuestion}
            onHide={hideQuestion}
            onNext={nextTurn}
            onReroll={rerollQuestion}
            onEnd={endGame}
          />
        ) : (
          <LoaderCard title="جاري تجهيز الدور..." />
        )
    }
  }

  const renderPlayer = () => {
    switch (playerView) {
      case 'join':
        return roomCode ? (
          <PlayerJoin
            code={roomCode}
            name={joinName}
            selfie={joinSelfie}
            cameraFailed={joinCameraFailed}
            joining={joining}
            onNameChange={setJoinName}
            onSelfieChange={handleSelfieChange}
            onCameraFailed={() => setJoinCameraFailed(true)}
            onJoin={handleJoin}
          />
        ) : (
          <ErrorState
            message="ما قدرنا نحدد رمز الغرفة"
            retryLabel="حاول مرة أخرى"
            onRetry={() => window.location.reload()}
          />
        )
      case 'reconnecting':
        return <LoaderCard title={`جاري الانضمام للغرفة ${roomCode ?? ''}...`} />
      case 'wait':
        return <PlayerWait name={myName} selfie={mySelfie} players={players} />
      case 'play':
        return turn ? (
          <PlayerPlay
            key={`${turn.round}-${turn.turnNo}`}
            turn={turn}
            isMyTurn={turn.currentPlayer?.id === myId}
            myName={myName}
            mySelfie={mySelfie}
            myQuestion={myQuestion}
            onNext={playerNextTurn}
          />
        ) : (
          <LoaderCard title="جاري تجهيز الدور..." />
        )
      case 'end':
        return <PlayerEnd players={players} />
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader connected={connected} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6">
        {!booted ? (
          <LoaderCard title="جاري الاتصال بالخادم..." />
        ) : mode === 'host' ? (
          renderHost()
        ) : (
          renderPlayer()
        )}
      </main>
      <AppFooter />
    </div>
  )
}
