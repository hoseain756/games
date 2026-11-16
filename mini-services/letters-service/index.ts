// ---------------------------------------------------------------------------
// Letters service — real-time engine for "حروف مع حسين" (Letters with
// Hussein): two teams, a shuffled hexagon board of Arabic letters, a host
// controlling the session, dedicated team screens with a huge buzzer, and a
// big display screen for the audience.
//
// Standalone Bun + socket.io mini-service, listening on port 3004.
// The Next.js frontend connects through the Caddy gateway with
// `io('/?XTransformPort=3004')`, therefore the socket.io path MUST stay '/'.
// ---------------------------------------------------------------------------

import { Server, type Socket } from 'socket.io'
import {
  ARABIC_LETTERS,
  QUESTION_BANK,
  type BankQuestion,
} from '../../src/lib/question-bank'
import { BOARD_CELLS, findWinningChain } from '../../src/lib/hex-board'
import type {
  LettersPhase,
  LettersQuestionView,
  LettersRole,
  LettersRoundResult,
  LettersState,
  LettersTeam,
} from '../../src/lib/letters-types'

const PORT = 3004

const ROLES: LettersRole[] = ['host', 'teamA', 'teamB', 'display']
const OTHER: Record<LettersTeam, LettersTeam> = { A: 'B', B: 'A' }

interface ServerState {
  phase: LettersPhase
  answerTime: number
  chooseTime: number
  activeTeam: LettersTeam | null
  activeLetter: string | null
  question: BankQuestion | null
  phaseEndsAt: number | null
  scores: Record<LettersTeam, number>
  claimed: Record<string, LettersTeam>
  layout: string[]
  roundNumber: number
  answeredTeams: LettersTeam[]
  buzzWinner: LettersTeam | null
  locked: boolean
  result: LettersRoundResult | null
  gameWinner: LettersTeam | null
  winPath: string[]
  lastEvent: string | null
  usedQuestionIds: string[]
  chooseAttempts: number
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function lobbyState(): ServerState {
  return {
    phase: 'lobby',
    answerTime: 30,
    chooseTime: 15,
    activeTeam: null,
    activeLetter: null,
    question: null,
    phaseEndsAt: null,
    scores: { A: 0, B: 0 },
    claimed: {},
    // 25 random letters of the 28 fill the 5x5 board each session.
    layout: shuffled(ARABIC_LETTERS).slice(0, BOARD_CELLS),
    roundNumber: 0,
    answeredTeams: [],
    buzzWinner: null,
    locked: false,
    result: null,
    gameWinner: null,
    winPath: [],
    lastEvent: 'بانتظار المقدم لبدء الجلسة',
    usedQuestionIds: [],
    chooseAttempts: 0,
  }
}

let state: ServerState = lobbyState()

// ---------------------------------------------------------------------------
// Broadcast helpers — teams/display never receive the answer until the round
// ends; the host always receives it.
// ---------------------------------------------------------------------------

function sanitizeFor(includeAnswer: boolean): LettersState {
  const q = state.question
  const reveal = includeAnswer || state.phase === 'round_end' || state.phase === 'game_over'
  const questionView: LettersQuestionView | null = q
    ? {
        id: q.id,
        letter: q.letter,
        q: q.q,
        ...(reveal ? { a: q.a } : {}),
      }
    : null

  const rooms = io.of('/').adapter.rooms
  const size = (room: string) => rooms.get(room)?.size ?? 0

  return {
    phase: state.phase,
    answerTime: state.answerTime,
    chooseTime: state.chooseTime,
    activeTeam: state.activeTeam,
    activeLetter: state.activeLetter,
    question: questionView,
    phaseEndsAt: state.phaseEndsAt,
    serverNow: Date.now(),
    scores: { ...state.scores },
    claimed: { ...state.claimed },
    layout: [...state.layout],
    roundNumber: state.roundNumber,
    answeredTeams: [...state.answeredTeams],
    buzzWinner: state.buzzWinner,
    locked: state.locked,
    online: {
      host: size('host') > 0,
      A: size('teamA') > 0,
      B: size('teamB') > 0,
      display: size('display') > 0,
    },
    result: state.result,
    gameWinner: state.gameWinner,
    winPath: [...state.winPath],
    lastEvent: state.lastEvent,
  }
}

function broadcast() {
  io.to('host').emit('letters:state', sanitizeFor(true))
  io.except('host').emit('letters:state', sanitizeFor(false))
}

// ---------------------------------------------------------------------------
// Round flow helpers
// ---------------------------------------------------------------------------

function toIdle(message: string) {
  state.phase = 'idle'
  state.activeTeam = null
  state.activeLetter = null
  state.question = null
  state.phaseEndsAt = null
  state.answeredTeams = []
  state.buzzWinner = null
  state.locked = false
  state.chooseAttempts = 0
  state.lastEvent = message
}

/** Called when the active team's window expires or is judged wrong. */
function advanceAfterWindow(reason: 'timeout' | 'wrong') {
  const finished = state.activeTeam
  if (!finished) return

  state.answeredTeams = [...new Set([...state.answeredTeams, finished])]
  const next = OTHER[finished]
  const nextFresh = !state.answeredTeams.includes(next)

  if (nextFresh) {
    // The other team still has its own window on the same question.
    state.activeTeam = next
    state.locked = false
    state.buzzWinner = null
    state.phaseEndsAt = Date.now() + state.answerTime * 1000
    state.lastEvent =
      reason === 'timeout'
        ? `انتهى وقت ${finished === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} — بدأ وقت الفريق الآخر`
        : 'إجابة خاطئة — الدور الآن للفريق الآخر'
  } else {
    // Both teams used their windows: buzzers open for everyone.
    state.phase = 'open'
    state.activeTeam = null
    state.phaseEndsAt = null
    state.locked = false
    state.lastEvent = 'انفتحت الأزرار للجميع — أسرع فريق يضغط يجاوب!'
  }
}

function finishRound(outcome: 'correct' | 'failed', team: LettersTeam | null) {
  state.phaseEndsAt = null
  state.result = {
    outcome,
    team,
    letter: state.activeLetter,
    question: state.question?.q ?? null,
    answer: state.question?.a ?? null,
  }
  state.locked = false

  if (outcome === 'correct') {
    // The claim may have connected the team's two edges -> whole-game win.
    const win = findWinningChain(state.claimed, state.layout)
    if (win) {
      state.phase = 'game_over'
      state.gameWinner = win.team
      state.winPath = win.path.map(i => state.layout[i])
      state.lastEvent = `${win.team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} وصّل شريطيه وفاز باللعبة!`
      return
    }
    state.phase = 'round_end'
    state.lastEvent = `إجابة صحيحة! ${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} يفوز بالخلية`
    return
  }

  state.phase = 'round_end'
  state.lastEvent = 'انتهت الجولة دون إجابة صحيحة'
}

function pickQuestion(letter: string): BankQuestion | null {
  const pool = QUESTION_BANK[letter] ?? []
  if (pool.length === 0) return null

  let available = pool.filter(q => !state.usedQuestionIds.includes(q.id))
  if (available.length === 0) {
    // Every question for this letter was used — recycle them.
    state.usedQuestionIds = state.usedQuestionIds.filter(
      id => !pool.some(q => q.id === id),
    )
    available = pool
  }

  const chosen = available[Math.floor(Math.random() * available.length)]
  state.usedQuestionIds.push(chosen.id)
  return chosen
}

// ---------------------------------------------------------------------------
// Socket server
// ---------------------------------------------------------------------------

const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

function roleOf(socket: Socket): LettersRole {
  const raw = socket.handshake.query.role
  const value = Array.isArray(raw) ? raw[0] : raw
  return ROLES.includes(value as LettersRole) ? (value as LettersRole) : 'display'
}

function teamOf(socket: Socket): LettersTeam | null {
  const role = roleOf(socket)
  if (role === 'teamA') return 'A'
  if (role === 'teamB') return 'B'
  return null
}

io.on('connection', socket => {
  const role = roleOf(socket)
  socket.join(role)

  // Fresh state for the newcomer (and refreshed presence for everyone).
  broadcast()

  // ---- Host actions -------------------------------------------------------

  socket.on('letters:config', payload => {
    if (role !== 'host') return
    if (state.phase !== 'lobby' && state.phase !== 'idle') return
    const rec = (payload ?? {}) as Record<string, unknown>
    // Partial update: only the provided field changes.
    if (rec.answerTime !== undefined && [60, 30, 15].includes(Number(rec.answerTime))) {
      state.answerTime = Number(rec.answerTime)
    }
    if (rec.chooseTime !== undefined && [30, 20, 15, 10].includes(Number(rec.chooseTime))) {
      state.chooseTime = Number(rec.chooseTime)
    }
    broadcast()
  })

  socket.on('letters:start', () => {
    if (role !== 'host') return
    if (state.phase !== 'lobby' && state.phase !== 'idle') return
    state = lobbyState()
    state.phase = 'idle'
    state.layout = shuffled(ARABIC_LETTERS).slice(0, BOARD_CELLS)
    state.roundNumber = 1
    state.lastEvent = 'بدأت الجلسة! افتح الدور لأحد الفريقين'
    broadcast()
  })

  // Fresh game after a win: reset scores + claims and reshuffle the board.
  socket.on('letters:new_game', () => {
    if (role !== 'host') return
    if (state.phase === 'lobby') return
    state = lobbyState()
    state.phase = 'idle'
    state.layout = shuffled(ARABIC_LETTERS).slice(0, BOARD_CELLS)
    state.roundNumber = 1
    state.lastEvent = 'لعبة جديدة! افتح الدور لأحد الفريقين'
    broadcast()
  })

  socket.on('letters:open_turn', payload => {
    if (role !== 'host') return
    const rec = (payload ?? {}) as Record<string, unknown>
    const team = rec.team === 'A' || rec.team === 'B' ? rec.team : null
    if (!team) return
    if (state.phase !== 'idle' && state.phase !== 'choosing' && state.phase !== 'round_end') return
    if (state.phase === 'round_end') {
      // Opening a turn after a finished round starts the next round.
      state.question = null
      state.activeLetter = null
      state.result = null
      state.answeredTeams = []
      state.buzzWinner = null
      state.locked = false
      state.roundNumber += 1
    }
    state.phase = 'choosing'
    state.activeTeam = team
    state.activeLetter = null
    state.question = null
    state.answeredTeams = []
    state.buzzWinner = null
    state.locked = false
    state.chooseAttempts = 0
    state.phaseEndsAt = Date.now() + state.chooseTime * 1000
    state.lastEvent = `${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} يختار حرفاً من الخلايا`
    broadcast()
  })

  // ---- Team actions -------------------------------------------------------

  socket.on('letters:pick', payload => {
    const team = teamOf(socket)
    if (!team || team !== state.activeTeam) return
    if (state.phase !== 'choosing') return
    const rec = (payload ?? {}) as Record<string, unknown>
    const letter = typeof rec.letter === 'string' ? rec.letter : ''
    if (!state.layout.includes(letter)) return
    if (state.claimed[letter]) return

    const question = pickQuestion(letter)
    if (!question) return

    state.activeLetter = letter
    state.question = question
    state.phase = 'team_turn'
    state.locked = false
    state.buzzWinner = null
    state.phaseEndsAt = Date.now() + state.answerTime * 1000
    state.lastEvent = `اختار ${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} حرف ${letter}`
    broadcast()
  })

  socket.on('letters:ready', () => {
    const team = teamOf(socket)
    if (!team || team !== state.activeTeam) return
    if (state.phase !== 'team_turn') return
    state.locked = true
    state.lastEvent = `${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} جاهز بالجواب — يا مقدم احكم!`
    broadcast()
  })

  socket.on('letters:buzz', () => {
    const team = teamOf(socket)
    if (!team) return
    if (state.phase !== 'open') return
    // First press wins — guard synchronously.
    state.buzzWinner = team
    state.activeTeam = team
    state.phase = 'buzz_answer'
    state.locked = false
    state.phaseEndsAt = Date.now() + state.answerTime * 1000
    state.lastEvent = `${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} ضغط أولاً — جاوبوا الآن!`
    broadcast()
  })

  // ---- Host judging -------------------------------------------------------

  socket.on('letters:judge', payload => {
    if (role !== 'host') return
    if (state.phase !== 'team_turn' && state.phase !== 'buzz_answer') return
    if (!state.activeTeam || !state.activeLetter || !state.question) return

    const rec = (payload ?? {}) as Record<string, unknown>
    const correct = rec.correct === true
    const team = state.activeTeam

    if (correct) {
      state.claimed[state.activeLetter] = team
      state.scores[team] += 1
      finishRound('correct', team)
    } else if (state.phase === 'team_turn') {
      advanceAfterWindow('wrong')
    } else {
      // Wrong buzz answer: both teams already had their windows this round.
      finishRound('failed', team)
    }
    broadcast()
  })

  socket.on('letters:cancel_round', () => {
    if (role !== 'host') return
    if (state.phase === 'lobby' || state.phase === 'idle' || state.phase === 'round_end') return
    finishRound('failed', state.activeTeam)
    broadcast()
  })

  socket.on('letters:next', () => {
    if (role !== 'host') return
    if (state.phase !== 'round_end') return
    toIdle('الجولة التالية — افتح الدور لأحد الفريقين')
    state.roundNumber += 1
    broadcast()
  })

  socket.on('letters:end_session', () => {
    if (role !== 'host') return
    state = lobbyState()
    broadcast()
  })

  socket.on('disconnect', () => {
    broadcast()
  })
})

// ---------------------------------------------------------------------------
// Server-authoritative timer: checks deadlines 4x per second and advances the
// phase when a window expires, so every screen stays in sync.
// ---------------------------------------------------------------------------

setInterval(() => {
  if (!state.phaseEndsAt) return
  if (Date.now() < state.phaseEndsAt) return

  switch (state.phase) {
    case 'choosing': {
      state.chooseAttempts += 1
      if (state.chooseAttempts >= 2 || !state.activeTeam) {
        toIdle('انتهى وقت اختيار الحرف — افتح الدور من جديد')
      } else {
        const next = OTHER[state.activeTeam]
        state.activeTeam = next
        state.chooseAttempts = 1
        state.phaseEndsAt = Date.now() + state.chooseTime * 1000
        state.lastEvent = 'ما اختاروا حرف — الدور الآن للفريق الآخر'
      }
      break
    }
    case 'team_turn':
    case 'buzz_answer':
      advanceAfterWindow('timeout')
      break
    default:
      state.phaseEndsAt = null
  }
  broadcast()
}, 250)

console.log(`[letters-service] listening on http://localhost:${PORT}`)
