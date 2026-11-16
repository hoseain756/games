// ---------------------------------------------------------------------------
// Letters engine — real-time game logic for "حروف مع حسين" (Letters with
// Hussein): two teams, a shuffled hexagon board of Arabic letters, a host
// controlling the session, dedicated team screens with a huge buzzer, and a
// big display screen for the audience.
//
// Questions come from the server-side bank (2800 questions — 100 per letter,
// loaded from src/data/arabic_letters_question_bank_2800.json). Selection
// honors the host's category/difficulty filters, never repeats a question
// within a session, and typed answers are verified on the server with Arabic
// normalization — the answer bank itself never leaves the server.
//
// This module is HOST-AGNOSTIC: it is started either by the standalone
// mini-service (mini-services/letters-service, port 3004) or inside the
// Next.js server process via src/instrumentation.ts — whoever binds the port
// first wins, the second one exits quietly (EADDRINUSE tolerated).
// The frontend connects through the Caddy gateway with
// `io('/?XTransformPort=3004')`, therefore the socket.io path MUST stay '/'.
// ---------------------------------------------------------------------------

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'
import {
  ARABIC_LETTERS,
  BANK_INFO,
  QUESTION_BANK,
  toBankLetter,
  toDisplayLetter,
  type BankQuestion,
} from './question-bank'
import { answersMatch } from './arabic-normalize'
import { BOARD_CELLS, findWinningChain } from './hex-board'
import type {
  LettersFilters,
  LettersPhase,
  LettersQuestionView,
  LettersRole,
  LettersRoundResult,
  LettersState,
  LettersTeam,
} from './letters-types'
import { FILTER_ALL } from './letters-types'

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
  filters: LettersFilters
  lastAnswerText: string | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function defaultFilters(): LettersFilters {
  return { category: FILTER_ALL, difficulty: FILTER_ALL }
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
    filters: defaultFilters(),
    lastAnswerText: null,
  }
}

// ---------------------------------------------------------------------------
// Engine factory — binds the socket server on the given port. All helpers are
// inner closures over the `state` binding so reassignment (new session/new
// game) is always visible.
// ---------------------------------------------------------------------------

export function startLettersEngine(port: number) {
  // Explicit http server so EADDRINUSE (mini-service already owning the port
  // in supervised environments) is caught quietly instead of crashing.
  const httpServer = createServer()
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[letters-engine] port ${port} already in use — mini-service owns it, standing by`)
    } else {
      console.error(`[letters-engine] http server error:`, err)
    }
  })
  httpServer.listen(port)

  let state: ServerState = lobbyState()

  // Teams/display never receive the answer until the round ends; the host
  // always receives it.
  function sanitizeFor(includeAnswer: boolean): LettersState {
    const q = state.question
    const reveal = includeAnswer || state.phase === 'round_end' || state.phase === 'game_over'
    const questionView: LettersQuestionView | null = q
      ? {
          id: q.id,
          // Show the BOARD letter (display space) so every screen matches the
          // hexagon the team picked, not the bank's plain-alef key.
          letter: state.activeLetter ?? toDisplayLetter(q.letter),
          q: q.q,
          ...(reveal ? { a: q.a } : {}),
          category: q.category,
          subcategory: q.subcategory,
          difficulty: q.difficulty,
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
      filters: { ...state.filters },
      bankInfo: BANK_INFO,
      lastAnswerText: state.lastAnswerText,
    }
  }

  function broadcast() {
    io.to('host').emit('letters:state', sanitizeFor(true))
    io.except('host').emit('letters:state', sanitizeFor(false))
  }

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
    state.lastAnswerText = null
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
      state.lastAnswerText = null
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
      // (Off-board bonus letters score +1 but claim no cell.)
      const win = findWinningChain(state.claimed, state.layout)
      if (win) {
        state.phase = 'game_over'
        state.gameWinner = win.team
        state.winPath = win.path.map(i => state.layout[i])
        state.lastEvent = `${win.team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} وصّل شريطيه وفاز باللعبة!`
        return
      }
      state.phase = 'round_end'
      const onBoard = state.activeLetter ? state.layout.includes(state.activeLetter) : false
      state.lastEvent = onBoard
        ? `إجابة صحيحة! ${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} يفوز بالخلية`
        : `إجابة صحيحة بونص! +1 (الحرف ليس على اللوحة)`
      return
    }

    state.phase = 'round_end'
    state.lastEvent = 'انتهت الجولة دون إجابة صحيحة'
  }

  /** Records a correct answer for the active team (manual judge or auto-verify). */
  function applyCorrectAnswer(team: LettersTeam) {
    if (state.activeLetter && state.layout.includes(state.activeLetter)) {
      state.claimed[state.activeLetter] = team
    }
    state.scores[team] += 1
    finishRound('correct', team)
  }

  /**
   * Picks a random question for the letter honoring the host filters and the
   * no-repeat guarantee within the session (recycles only when the filtered
   * pool is fully exhausted).
   */
  function pickQuestion(displayLetter: string): BankQuestion | null {
    const pool = QUESTION_BANK[toBankLetter(displayLetter)] ?? []
    if (pool.length === 0) return null

    const inScope = pool.filter(
      q =>
        (state.filters.category === FILTER_ALL || q.category === state.filters.category) &&
        (state.filters.difficulty === FILTER_ALL || q.difficulty === state.filters.difficulty),
    )
    const base = inScope.length > 0 ? inScope : pool
    const baseIds = new Set(base.map(q => q.id))

    let available = base.filter(q => !state.usedQuestionIds.includes(q.id))
    if (available.length === 0) {
      // Every in-scope question was used — recycle only this pool's ids.
      state.usedQuestionIds = state.usedQuestionIds.filter(id => !baseIds.has(id))
      available = base
    }

    const chosen = available[Math.floor(Math.random() * available.length)]
    state.usedQuestionIds.push(chosen.id)
    return chosen
  }

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

    // ---- Host actions -----------------------------------------------------

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
      // Question-bank filters, validated against the bank metadata.
      if (typeof rec.category === 'string') {
        const value = rec.category
        if (value === FILTER_ALL || BANK_INFO.categories.includes(value)) {
          state.filters = { ...state.filters, category: value }
        }
      }
      if (typeof rec.difficulty === 'string') {
        const value = rec.difficulty
        if (value === FILTER_ALL || BANK_INFO.difficulties.includes(value)) {
          state.filters = { ...state.filters, difficulty: value }
        }
      }
      broadcast()
    })

    socket.on('letters:start', () => {
      if (role !== 'host') return
      if (state.phase !== 'lobby' && state.phase !== 'idle') return
      const filters = state.filters
      state = lobbyState()
      state.filters = filters
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
      const filters = state.filters
      state = lobbyState()
      state.filters = filters
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
      state.lastAnswerText = null
      state.phaseEndsAt = Date.now() + state.chooseTime * 1000
      state.lastEvent = `${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} يختار حرفاً من الخلايا`
      broadcast()
    })

    // ---- Team actions -----------------------------------------------------

    socket.on('letters:pick', payload => {
      const team = teamOf(socket)
      if (!team || team !== state.activeTeam) return
      if (state.phase !== 'choosing') return
      const rec = (payload ?? {}) as Record<string, unknown>
      const letter = typeof rec.letter === 'string' ? rec.letter : ''
      // Any of the 28 letters can be picked — the 25 on the board claim cells,
      // the remaining 3 are bonus questions (+1 without a cell).
      if (!ARABIC_LETTERS.includes(letter)) return
      if (state.claimed[letter]) return

      const question = pickQuestion(letter)
      if (!question) return

      state.activeLetter = letter
      state.question = question
      state.phase = 'team_turn'
      state.locked = false
      state.buzzWinner = null
      state.lastAnswerText = null
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
      state.lastAnswerText = null
      state.phaseEndsAt = Date.now() + state.answerTime * 1000
      state.lastEvent = `${team === 'A' ? 'الفريق الأول' : 'الفريق الثاني'} ضغط أولاً — جاوبوا الآن!`
      broadcast()
    })

    // ---- Typed answer with server-side Arabic verification ----------------

    socket.on('letters:answer', payload => {
      const team = teamOf(socket)
      if (!team || team !== state.activeTeam) return
      if (state.phase !== 'team_turn' && state.phase !== 'buzz_answer') return
      if (!state.question) return

      const rec = (payload ?? {}) as Record<string, unknown>
      const text = typeof rec.text === 'string' ? rec.text.trim().slice(0, 80) : ''
      if (!text) return
      // Ignore exact resubmissions (anti-spam) — a different spelling retries.
      if (text === state.lastAnswerText) return

      state.lastAnswerText = text

      if (answersMatch(text, { answer: state.question.a, normalizedAnswer: state.question.na })) {
        // Verified correct on the server: claim + score immediately.
        applyCorrectAnswer(team)
        state.lastEvent = `إجابة مُتحقَّق منها: «${text}» — صحيحة!`
      } else {
        // Wrong: the round keeps running; the host can still judge manually.
        state.lastEvent = `أجاب الفريق «${text}» — غير صحيحة، حاولوا من جديد أو قيّم يا مقدم`
        socket.emit('letters:answer_result', { correct: false, text })
      }
      broadcast()
    })

    // ---- Host judging -----------------------------------------------------

    socket.on('letters:judge', payload => {
      if (role !== 'host') return
      if (state.phase !== 'team_turn' && state.phase !== 'buzz_answer') return
      if (!state.activeTeam || !state.activeLetter || !state.question) return

      const rec = (payload ?? {}) as Record<string, unknown>
      const correct = rec.correct === true
      const team = state.activeTeam

      if (correct) {
        applyCorrectAnswer(team)
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
  // Server-authoritative timer: checks deadlines 4x per second and advances
  // the phase when a window expires, so every screen stays in sync.
  // ---------------------------------------------------------------------------

  const timer = setInterval(() => {
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
  timer.unref?.()

  console.log(
    `[letters-engine] starting on http://localhost:${port} — bank: ${BANK_INFO.totalQuestions} questions / ${BANK_INFO.letters} letters`,
  )
  return io
}
