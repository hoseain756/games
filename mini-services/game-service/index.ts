// ---------------------------------------------------------------------------
// Game service — real-time multiplayer room management for the Arabic party
// game ("لعبة الأسئلة" / Questions Game).
//
// Standalone Bun + socket.io mini-service, listening on port 3003.
// The Next.js frontend connects through the Caddy gateway with
// `io('/?XTransformPort=3003')`, therefore the socket.io path MUST stay '/'.
// ---------------------------------------------------------------------------

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface PublicPlayer {
  /** Persistent client-generated uuid (NOT the socket id). */
  id: string
  name: string
  /** Data URL string; may be '' if the player skipped the selfie. */
  selfie: string
  connected: boolean
  /** True once the player submitted his own questions. */
  ready: boolean
}

interface GameOptions {
  norepeat: boolean
  shuffle: boolean
}

interface Room {
  /** 4 chars, alphabet without 0/O/1/I/L. */
  code: string
  hostSocketId: string
  /** Empty until the game starts, then holds the POOL of all players' questions. */
  questions: string[]
  opts: GameOptions
  state: 'lobby' | 'playing'
  /** Ordered by join time. */
  players: PublicPlayer[]
  /** playerId -> the questions he wrote (lobby phase). */
  submissions: Map<string, string[]>
  /** Player ids in turn order (only meaningful while playing). */
  order: string[]
  /** Index into order. */
  idx: number
  /** Starts at 1. */
  round: number
  /** Question bag for no-repeat mode. */
  bag: string[]
  currentQuestion: string | null
  lastActivity: number
  // --- internal bookkeeping (never sent to clients) ---
  /** Host is currently peeking at the private question. */
  peeking: boolean
  /** playerId -> current socket id (updated on join/rejoin, cleared on disconnect). */
  playerSockets: Map<string, string>
  /** Pending host-absence deletion timer. */
  deleteTimer: ReturnType<typeof setTimeout> | null
}

/** socket.id -> membership info, used for clean disconnect handling. */
interface SocketInfo {
  code: string
  role: 'host' | 'player'
  playerId?: string
}

// ---------------------------------------------------------------------------
// Limits / constants
// ---------------------------------------------------------------------------

const PORT = 3003 // hardcoded on purpose (Caddy gateway forwards here)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
const CODE_LENGTH = 4
const MAX_PLAYERS = 20
const MAX_QUESTIONS = 500
const MAX_QUESTIONS_PER_PLAYER = 30
const QUESTION_MAX_LEN = 200
const NAME_MAX_LEN = 30
const SELFIE_MAX_LEN = 300000
const HOST_GRACE_MS = 90_000
const CLEANUP_INTERVAL_MS = 60_000
const ROOM_TTL_MS = 10 * 60 * 1000

const MSG = {
  ROOM_EXPIRED: 'انتهت صلاحية الغرفة',
  ROOM_NOT_FOUND: 'الغرفة غير موجودة، تأكد من الرمز',
  GAME_ALREADY_STARTED: 'اللعبة بدأت بالفعل',
  NAME_TAKEN: 'الاسم مستخدم، اختر اسماً آخر',
  ROOM_FULL: 'الغرفة ممتلئة',
  BAG_REFILLED: 'انتهت الأسئلة، نعيد خلطها',
  UNAUTHORIZED: 'غير مصرح',
  INVALID_NAME: 'الاسم غير صالح',
  INVALID_DATA: 'بيانات غير صالحة',
  SELFIE_TOO_LARGE: 'حجم الصورة كبير جداً',
  UNEXPECTED_ERROR: 'حدث خطأ غير متوقع',
} as const

// ---------------------------------------------------------------------------
// Server & in-memory state
// ---------------------------------------------------------------------------

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/', // DO NOT change, used by Caddy gateway
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const rooms = new Map<string, Room>()
const socketRooms = new Map<string, SocketInfo>() // socket.id -> { code, role, playerId? }

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function shuffle<T>(a: T[]): T[] {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeCode(v: unknown): string {
  return asString(v).trim().toUpperCase()
}

/** Clean + validate a raw questions array: 1..500 strings, each trimmed 1..200 chars. */
function cleanQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (trimmed.length >= 1 && trimmed.length <= QUESTION_MAX_LEN) out.push(trimmed)
    if (out.length >= MAX_QUESTIONS) break
  }
  return out
}

/** Clean + validate ONE player's question list: 1..30 unique questions. */
function cleanPlayerQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (trimmed.length >= 1 && trimmed.length <= QUESTION_MAX_LEN && !out.includes(trimmed)) {
      out.push(trimmed)
    }
    if (out.length >= MAX_QUESTIONS_PER_PLAYER) break
  }
  return out
}

/** Random unique 4-char room code among active rooms. */
function generateRoomCode(): string {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
  } while (rooms.has(code))
  return code
}

// ---------------------------------------------------------------------------
// Room helpers
// ---------------------------------------------------------------------------

function publicPlayerById(room: Room, playerId: string | null | undefined): PublicPlayer | null {
  if (!playerId) return null
  return room.players.find(p => p.id === playerId) ?? null
}

function turnPayload(room: Room) {
  return {
    round: room.round,
    turnNo: room.idx + 1,
    total: room.order.length,
    currentPlayer: publicPlayerById(room, room.order[room.idx]),
  }
}

function emitLobbyUpdate(room: Room) {
  io.to(room.code).emit('lobby:update', { players: room.players, state: room.state })
}

/** Private question delivery: always to the CURRENT socket id of the turn player. */
function sendQuestionToCurrentPlayer(room: Room) {
  const playerId = room.order[room.idx]
  if (!playerId || room.currentQuestion === null) return
  const socketId = room.playerSockets.get(playerId)
  if (!socketId) return // player currently disconnected; they receive it on rejoin
  io.to(socketId).emit('player:question', { text: room.currentQuestion })
}

/** Delete a room and clean every map / socket.io membership related to it. */
function deleteRoom(code: string) {
  const room = rooms.get(code)
  if (!room) return
  if (room.deleteTimer) {
    clearTimeout(room.deleteTimer)
    room.deleteTimer = null
  }
  rooms.delete(code)
  for (const [socketId, info] of Array.from(socketRooms.entries())) {
    if (info.code === code) socketRooms.delete(socketId)
  }
  io.in(code).socketsLeave(code)
  console.log(`[game-service] room ${code} deleted`)
}

/** Remove a player from players/order/socket maps (explicit leaves). */
function removePlayerFromRoom(room: Room, playerId: string) {
  const playerIdx = room.players.findIndex(p => p.id === playerId)
  if (playerIdx !== -1) room.players.splice(playerIdx, 1)
  const orderIdx = room.order.indexOf(playerId)
  if (orderIdx !== -1) {
    room.order.splice(orderIdx, 1)
    if (orderIdx < room.idx) room.idx--
    if (room.idx >= room.order.length) room.idx = 0
  }
  room.playerSockets.delete(playerId)
  room.submissions.delete(playerId)
}

/** If this socket is mapped as a player in some other room, detach it cleanly. */
function detachFromPreviousRoom(socket: Socket, exceptCode?: string) {
  const info = socketRooms.get(socket.id)
  if (!info || info.role !== 'player' || !info.playerId) return
  if (exceptCode && info.code === exceptCode) return
  const previous = rooms.get(info.code)
  socketRooms.delete(socket.id)
  if (!previous) return
  removePlayerFromRoom(previous, info.playerId)
  socket.leave(previous.code)
  emitLobbyUpdate(previous)
}

/** Guard for host-only events: resolves the room or emits an error. */
function requireHost(socket: Socket): Room | null {
  const info = socketRooms.get(socket.id)
  const room = info ? rooms.get(info.code) : undefined
  if (!room) {
    socket.emit('room:error', { message: MSG.ROOM_EXPIRED })
    return null
  }
  if (room.hostSocketId !== socket.id) {
    socket.emit('room:error', { message: MSG.UNAUTHORIZED })
    return null
  }
  return room
}

// ---------------------------------------------------------------------------
// Question selection
// ---------------------------------------------------------------------------

function pickQuestion(room: Room) {
  const qs = room.questions
  if (!qs.length) return // defensive: pool is guaranteed non-empty at start
  if (room.opts.norepeat) {
    if (!room.bag.length) {
      room.bag = shuffle(qs)
      if (room.bag.length > 1 && room.bag[room.bag.length - 1] === room.currentQuestion) {
        room.bag.unshift(room.bag.pop() as string)
      }
      if (room.round > 1 || room.idx > 0) {
        io.to(room.code).emit('toast', { message: MSG.BAG_REFILLED })
      }
    }
    room.currentQuestion = room.bag.pop() as string
  } else {
    let q = qs[Math.floor(Math.random() * qs.length)]
    let guard = 0
    while (qs.length > 1 && q === room.currentQuestion && guard++ < 25) {
      q = qs[Math.floor(Math.random() * qs.length)]
    }
    room.currentQuestion = q
  }
}

/** pickQuestion, but guarantees the new question differs from the current one. */
function rerollQuestion(room: Room) {
  if (room.questions.length <= 1) {
    pickQuestion(room) // nothing else to show with a single question
    return
  }
  const previous = room.currentQuestion
  for (let attempt = 0; attempt < 20; attempt++) {
    pickQuestion(room)
    if (room.currentQuestion !== previous) return
  }
  // Still identical after 20 tries — force a different one / reshuffle the bag.
  if (room.opts.norepeat) {
    const rest = shuffle(room.questions.filter(q => q !== previous))
    room.bag = rest.length > 0 ? rest : shuffle(room.questions)
    room.currentQuestion = room.bag.pop() as string
  } else {
    const others = room.questions.filter(q => q !== previous)
    const pool = others.length > 0 ? others : room.questions
    room.currentQuestion = pool[Math.floor(Math.random() * pool.length)]
  }
}

// ---------------------------------------------------------------------------
// Event handlers (client -> server)
// ---------------------------------------------------------------------------

function onHostCreate(socket: Socket, payload: unknown) {
  const body = asRecord(payload)
  // Questions are no longer required from the host — every player writes his
  // own list from his phone; the pool is built when everyone is done.
  const questions = cleanQuestions(body.questions)
  const optsRecord = asRecord(body.opts)
  const opts: GameOptions = {
    norepeat: optsRecord.norepeat === true,
    shuffle: optsRecord.shuffle === true,
  }
  const code = generateRoomCode()
  const room: Room = {
    code,
    hostSocketId: socket.id,
    questions,
    opts,
    state: 'lobby',
    players: [],
    submissions: new Map(),
    order: [],
    idx: 0,
    round: 1,
    bag: [],
    currentQuestion: null,
    lastActivity: Date.now(),
    peeking: false,
    playerSockets: new Map(),
    deleteTimer: null,
  }
  rooms.set(code, room)
  socket.join(code)
  socketRooms.set(socket.id, { code, role: 'host' })
  console.log(`[game-service] room ${code} created by host ${socket.id} (shuffle=${opts.shuffle}, norepeat=${opts.norepeat})`)
  socket.emit('room:created', { code, state: 'lobby', questions, opts })
}

function onHostReconnect(socket: Socket, payload: unknown) {
  const code = normalizeCode(asRecord(payload).code)
  const room = code ? rooms.get(code) : undefined
  if (!room) {
    socket.emit('room:error', { message: MSG.ROOM_EXPIRED })
    return
  }
  room.hostSocketId = socket.id
  if (room.deleteTimer) {
    clearTimeout(room.deleteTimer)
    room.deleteTimer = null
  }
  socket.join(code)
  socketRooms.set(socket.id, { code, role: 'host' })
  room.lastActivity = Date.now()
  console.log(`[game-service] host reconnected to room ${code} (${socket.id}, state=${room.state})`)
  socket.emit('room:created', { code: room.code, state: room.state, questions: room.questions, opts: room.opts })
  socket.emit('lobby:update', { players: room.players, state: room.state })
  if (room.state === 'playing') {
    socket.emit('game:turn', turnPayload(room))
  }
}

function onPlayerJoin(socket: Socket, payload: unknown) {
  const body = asRecord(payload)
  const code = normalizeCode(body.code)
  const playerId = asString(body.playerId).trim()
  const name = asString(body.name).trim()
  const selfie = asString(body.selfie)

  const room = code ? rooms.get(code) : undefined
  if (!room) {
    socket.emit('room:error', { message: MSG.ROOM_NOT_FOUND })
    return
  }
  room.lastActivity = Date.now()
  if (!playerId || playerId.length > 128) {
    socket.emit('room:error', { message: MSG.INVALID_DATA })
    return
  }
  if (!name || name.length > NAME_MAX_LEN) {
    socket.emit('room:error', { message: MSG.INVALID_NAME })
    return
  }
  if (selfie.length > SELFIE_MAX_LEN) {
    socket.emit('room:error', { message: MSG.SELFIE_TOO_LARGE })
    return
  }

  // Defensive: if this socket is still mapped as a player in another room, detach first.
  detachFromPreviousRoom(socket, code)

  const existing = room.players.find(p => p.id === playerId)

  if (room.state === 'playing') {
    // During a game only a known player may rejoin.
    if (!existing) {
      socket.emit('room:error', { message: MSG.GAME_ALREADY_STARTED })
      return
    }
    existing.connected = true
    room.playerSockets.set(playerId, socket.id)
    socketRooms.set(socket.id, { code, role: 'player', playerId })
    socket.join(code)
    socket.emit('player:joined-ok', { name: existing.name, state: 'playing', ready: existing.ready })
    // Give the rejoining player the full turn context so the UI can render.
    socket.emit('game:turn', turnPayload(room))
    if (room.order[room.idx] === playerId && room.currentQuestion !== null) {
      socket.emit('player:question', { text: room.currentQuestion })
    }
    emitLobbyUpdate(room)
    console.log(`[game-service] player "${existing.name}" rejoined playing room ${code}`)
    return
  }

  // state === 'lobby'
  if (existing) {
    // Same player refreshing / rejoining: update details and remap the socket.
    existing.name = name
    existing.selfie = selfie
    existing.connected = true
    room.playerSockets.set(playerId, socket.id)
    socketRooms.set(socket.id, { code, role: 'player', playerId })
    socket.join(code)
    socket.emit('player:joined-ok', { name, state: 'lobby', ready: existing.ready })
    emitLobbyUpdate(room)
    console.log(`[game-service] player "${name}" re-joined lobby ${code}`)
    return
  }

  const nameTaken = room.players.some(p => p.connected && p.name === name)
  if (nameTaken) {
    socket.emit('room:error', { message: MSG.NAME_TAKEN })
    return
  }
  if (room.players.length >= MAX_PLAYERS) {
    socket.emit('room:error', { message: MSG.ROOM_FULL })
    return
  }
  const player: PublicPlayer = { id: playerId, name, selfie, connected: true, ready: false }
  room.players.push(player)
  room.playerSockets.set(playerId, socket.id)
  socketRooms.set(socket.id, { code, role: 'player', playerId })
  socket.join(code)
  socket.emit('player:joined-ok', { name, state: 'lobby', ready: false })
  emitLobbyUpdate(room)
  console.log(`[game-service] player "${name}" joined room ${code} (${room.players.length}/${MAX_PLAYERS})`)
}

function onPlayerLeave(socket: Socket) {
  const info = socketRooms.get(socket.id)
  if (!info || info.role !== 'player' || !info.playerId) return
  const room = rooms.get(info.code)
  socketRooms.delete(socket.id)
  if (!room) return
  removePlayerFromRoom(room, info.playerId)
  socket.leave(room.code)
  room.lastActivity = Date.now()
  console.log(`[game-service] player "${info.playerId}" left room ${room.code}`)
  emitLobbyUpdate(room)
  tryAutoStart(room)
}

/**
 * Build the question pool from every player's submission and start the game.
 * Only called when ALL connected players are ready.
 */
function startGame(room: Room) {
  const pool: string[] = []
  for (const player of room.players) {
    const list = room.submissions.get(player.id)
    if (list) pool.push(...list)
  }
  room.questions = pool
  room.state = 'playing'
  const ids = room.players.map(p => p.id) // join order
  room.order = room.opts.shuffle ? shuffle(ids) : ids
  room.idx = 0
  room.round = 1
  room.bag = []
  pickQuestion(room)
  io.to(room.code).emit('game:turn', turnPayload(room))
  sendQuestionToCurrentPlayer(room)
  console.log(`[game-service] room ${room.code} auto-started (${room.order.length} players, pool of ${pool.length} questions)`)
}

/** Auto-start once at least two players are connected and ALL of them are ready. */
function tryAutoStart(room: Room) {
  if (room.state !== 'lobby') return
  const connected = room.players.filter(p => p.connected)
  if (connected.length < 2) return
  if (!connected.every(p => p.ready)) return
  startGame(room)
}

/** A player finished writing his questions on his phone. */
function onPlayerSubmitQuestions(socket: Socket, payload: unknown) {
  const info = socketRooms.get(socket.id)
  if (!info || info.role !== 'player' || !info.playerId) return
  const room = rooms.get(info.code)
  if (!room) {
    socket.emit('room:error', { message: MSG.ROOM_EXPIRED })
    return
  }
  if (room.state !== 'lobby') {
    socket.emit('room:error', { message: MSG.GAME_ALREADY_STARTED })
    return
  }
  const player = room.players.find(p => p.id === info.playerId)
  if (!player) {
    socket.emit('room:error', { message: MSG.ROOM_EXPIRED })
    return
  }
  if (player.ready) return // already submitted, ignore duplicates
  const list = cleanPlayerQuestions(asRecord(payload).questions)
  if (!list.length) {
    socket.emit('room:error', { message: MSG.INVALID_DATA })
    return
  }
  room.submissions.set(player.id, list)
  player.ready = true
  socket.emit('player:submitted', { count: list.length })
  emitLobbyUpdate(room)
  console.log(`[game-service] player "${player.name}" submitted ${list.length} question(s) in room ${room.code}`)
  tryAutoStart(room)
}

/** Advance to the next player (wraps around and starts a new round). */
function advanceTurn(room: Room) {
  room.idx++
  if (room.idx >= room.order.length) {
    room.idx = 0
    room.round++
    if (room.opts.shuffle) room.order = shuffle(room.order)
  }
  pickQuestion(room)
  io.to(room.code).emit('game:turn', turnPayload(room))
  sendQuestionToCurrentPlayer(room)
}

function onHostNext(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  if (room.state !== 'playing') return
  advanceTurn(room)
}

/** The CURRENT player taps "next" on his own phone to pass the turn. */
function onPlayerNext(socket: Socket) {
  const info = socketRooms.get(socket.id)
  if (!info || info.role !== 'player' || !info.playerId) return
  const room = rooms.get(info.code)
  if (!room) {
    socket.emit('room:error', { message: MSG.ROOM_EXPIRED })
    return
  }
  if (room.state !== 'playing') return
  // Only the player whose turn it is may advance the game.
  if (room.order[room.idx] !== info.playerId) {
    socket.emit('room:error', { message: MSG.UNAUTHORIZED })
    return
  }
  const name = publicPlayerById(room, info.playerId)?.name ?? info.playerId
  console.log(`[game-service] player "${name}" advanced the turn in room ${room.code}`)
  advanceTurn(room)
}

function onHostReroll(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  if (room.state !== 'playing') return
  rerollQuestion(room)
  sendQuestionToCurrentPlayer(room)
  // If the host is currently peeking, keep his view in sync.
  if (room.peeking && room.currentQuestion !== null) {
    io.to(room.hostSocketId).emit('host:question', { text: room.currentQuestion })
  }
}

function onHostPeek(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  room.peeking = true
  io.to(room.hostSocketId).emit('host:question', { text: room.currentQuestion })
}

function onHostHide(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  room.peeking = false
  io.to(room.hostSocketId).emit('host:question', { text: null })
}

function onHostEnd(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  room.state = 'lobby'
  room.round = 1
  room.idx = 0
  room.bag = []
  room.currentQuestion = null
  room.peeking = false
  // New round: everyone writes fresh questions again.
  room.questions = []
  room.submissions.clear()
  for (const player of room.players) player.ready = false
  console.log(`[game-service] room ${room.code} ended by host, back to lobby (ready flags reset)`)
  io.to(room.code).emit('game:ended', {})
  emitLobbyUpdate(room)
}

function onHostClose(socket: Socket) {
  const room = requireHost(socket)
  if (!room) return
  console.log(`[game-service] room ${room.code} closed by host`)
  io.to(room.code).emit('room:closed', {})
  deleteRoom(room.code)
}

// ---------------------------------------------------------------------------
// Disconnect handling
// ---------------------------------------------------------------------------

function handleDisconnect(socket: Socket) {
  const info = socketRooms.get(socket.id)
  socketRooms.delete(socket.id)
  if (!info) return
  const room = rooms.get(info.code)
  if (!room) return
  room.lastActivity = Date.now()

  if (info.role === 'host') {
    // Ignore stale host sockets (host already reconnected with a new socket).
    if (room.hostSocketId !== socket.id) return
    const anyConnectedPlayer = room.players.some(p => p.connected)
    if (!anyConnectedPlayer) {
      console.log(`[game-service] host disconnected with no connected players, deleting room ${room.code}`)
      deleteRoom(room.code)
      return
    }
    io.to(room.code).emit('host:offline', {})
    if (room.deleteTimer) clearTimeout(room.deleteTimer)
    room.deleteTimer = setTimeout(() => {
      room.deleteTimer = null
      if (rooms.get(room.code) === room) {
        console.log(`[game-service] host absent for ${HOST_GRACE_MS / 1000}s, deleting room ${room.code}`)
        deleteRoom(room.code)
      }
    }, HOST_GRACE_MS)
    console.log(`[game-service] host of room ${room.code} disconnected, ${HOST_GRACE_MS / 1000}s grace started`)
    return
  }

  if (info.role === 'player' && info.playerId) {
    const playerId = info.playerId
    // Only mark disconnected if this socket is still the player's current socket
    // (a newer socket may have already reconnected).
    if (room.playerSockets.get(playerId) !== socket.id) return
    room.playerSockets.delete(playerId)
    const player = room.players.find(p => p.id === playerId)
    if (player) {
      player.connected = false
      emitLobbyUpdate(room)
      console.log(`[game-service] player "${player.name}" disconnected from room ${room.code}`)
      // The leaver might have been the only one blocking the auto-start.
      tryAutoStart(room)
    }
  }
}

// ---------------------------------------------------------------------------
// Wiring (every handler wrapped so a throw never crashes the process)
// ---------------------------------------------------------------------------

type GameEventHandler = (socket: Socket, payload: unknown) => void

function listen(socket: Socket, event: string, handler: GameEventHandler) {
  socket.on(event, (payload: unknown) => {
    let roomCodeBefore: string | null = null
    try {
      roomCodeBefore = socketRooms.get(socket.id)?.code ?? null
      handler(socket, payload)
      const code = socketRooms.get(socket.id)?.code ?? roomCodeBefore
      if (code) {
        const room = rooms.get(code)
        if (room) room.lastActivity = Date.now()
      }
    } catch (err) {
      console.error(`[game-service] unexpected error in "${event}" from ${socket.id}:`, err)
      try {
        socket.emit('room:error', { message: MSG.UNEXPECTED_ERROR })
      } catch {
        // socket already gone; nothing else to do
      }
    }
  })
}

io.on('connection', (socket: Socket) => {
  console.log(`[game-service] socket connected: ${socket.id}`)

  listen(socket, 'host:create', onHostCreate)
  listen(socket, 'host:reconnect', onHostReconnect)
  listen(socket, 'player:join', onPlayerJoin)
  listen(socket, 'player:leave', onPlayerLeave)
  listen(socket, 'player:submit-questions', onPlayerSubmitQuestions)
  listen(socket, 'host:next', onHostNext)
  listen(socket, 'player:next', onPlayerNext)
  listen(socket, 'host:reroll', onHostReroll)
  listen(socket, 'host:peek', onHostPeek)
  listen(socket, 'host:hide', onHostHide)
  listen(socket, 'host:end', onHostEnd)
  listen(socket, 'host:close', onHostClose)

  socket.on('disconnect', reason => {
    try {
      console.log(`[game-service] socket disconnected: ${socket.id} (${reason})`)
      handleDisconnect(socket)
    } catch (err) {
      console.error('[game-service] error in disconnect handling:', err)
    }
  })
})

// ---------------------------------------------------------------------------
// Periodic cleanup: remove inactive rooms whose host socket is gone
// ---------------------------------------------------------------------------

const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const room of Array.from(rooms.values())) {
    const hostGone = !io.sockets.sockets.has(room.hostSocketId)
    if (now - room.lastActivity > ROOM_TTL_MS && hostGone) {
      console.log(`[game-service] cleaning up inactive room ${room.code}`)
      deleteRoom(room.code)
    }
  }
}, CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()

// ---------------------------------------------------------------------------
// Graceful shutdown + global error safety nets
// ---------------------------------------------------------------------------

let shuttingDown = false
function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[game-service] ${signal} received, shutting down`)
  clearInterval(cleanupTimer)
  for (const room of rooms.values()) {
    if (room.deleteTimer) {
      clearTimeout(room.deleteTimer)
      room.deleteTimer = null
    }
  }
  io.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('uncaughtException', err => {
  console.error('[game-service] uncaught exception:', err)
})
process.on('unhandledRejection', reason => {
  console.error('[game-service] unhandled rejection:', reason)
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log('Game service listening on port 3003')
})
