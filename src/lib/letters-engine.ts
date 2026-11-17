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
  LettersFastestAnswer,
  LettersFilters,
  LettersHistoryEntry,
  LettersPhase,
  LettersQuestionView,
  LettersRole,
  LettersRoundResult,
  LettersState,
  LettersTeam,
} from './letters-types'
import { defaultTeamInfo, FILTER_ALL, TEAM_ICON_KEYS, TEAM_LABELS } from './letters-types'

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
  teams: Record<LettersTeam, { name: string; icon: string }>
  sessionLocked: boolean
  joinCode: string
  history: LettersHistoryEntry[]
  fastest: LettersFastestAnswer | null
  streaks: Record<LettersTeam, number>
  /** Epoch ms of the moment buzzers opened (for speed stats). */
  turnOpenedAt: number | null
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

function randomJoinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

/**
 * Appends a finished round to the host's round log (newest first, capped).
 */
function recordRound(
  state: ServerState,
  entry: Omit<LettersHistoryEntry, 'at'>,
) {
  state.history = [{ ...entry, at: Date.now() }, ...state.history].slice(0, 50)
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
    teams: defaultTeamInfo(),
    sessionLocked: false,
    joinCode: randomJoinCode(),
    history: [],
    fastest: null,
    streaks: { A: 0, B: 0 },
    turnOpenedAt: null,
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
  /** Snapshot taken right before a host judgment — one undo level. */
  let undoSnapshot: ServerState | null = null

  /** Custom team name (when set) or the default label. */
  function teamName(team: LettersTeam): string {
    const custom = state.teams[team]?.name?.trim()
    return custom && custom.length > 0 ? custom : TEAM_LABELS[team]
  }

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
      teams: { A: { ...state.teams.A }, B: { ...state.teams.B } },
      sessionLocked: state.sessionLocked,
      joinCode: state.joinCode,
      history: state.history.slice(0, 30),
      canUndo: undoSnapshot !== null,
      fastest: state.fastest ? { ...state.fastest } : null,
      streaks: { ...state.streaks },
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
      state.turnOpenedAt = Date.now()
      state.lastEvent =
        reason === 'timeout'
          ? `انتهى وقت ${teamName(finished)} — بدأ وقت الفريق الآخر`
          : 'إجابة خاطئة — الدور الآن للفريق الآخر'
    } else {
      // Both teams used their windows: buzzers open for everyone.
      state.phase = 'open'
      state.activeTeam = null
      state.phaseEndsAt = null
      state.locked = false
      state.turnOpenedAt = Date.now()
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

    // Round log + streak bookkeeping (the undo snapshot covers both).
    if (outcome === 'correct' && team) {
      state.streaks[team] += 1
      recordRound(state, { round: state.roundNumber, letter: state.activeLetter, outcome, team, points: 1 })
    } else if (outcome === 'failed') {
      if (team) state.streaks[team] = 0
      recordRound(state, { round: state.roundNumber, letter: state.activeLetter, outcome, team, points: 0 })
    }

    if (outcome === 'correct') {
      // The claim may have connected the team's two edges -> whole-game win.
      // (Off-board bonus letters score +1 but claim no cell.)
      const win = findWinningChain(state.claimed, state.layout)
      if (win) {
        state.phase = 'game_over'
        state.gameWinner = win.team
        state.winPath = win.path.map(i => state.layout[i])
        state.lastEvent = `${teamName(win.team)} وصّل شريطيه وفاز باللعبة!`
        return
      }
      state.phase = 'round_end'
      const onBoard = state.activeLetter ? state.layout.includes(state.activeLetter) : false
      state.lastEvent = onBoard
        ? `إجابة صحيحة! ${teamName(team ?? 'A')} يفوز بالخلية`
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

    // Session lock: team screens must present the join code (embedded in the
    // QR/link, or typed by hand). Anyone else is told why and kept in limbo.
    const team = teamOf(socket)
    if (team && state.sessionLocked) {
      const raw = socket.handshake.query.code
      const code = Array.isArray(raw) ? raw[0] : raw
      if (code !== state.joinCode) {
        console.log(`[letters-engine] join denied (locked session): ${socket.id} (${role})`)
        socket.emit('letters:join_denied', { reason: 'locked' })
        return
      }
    }

    console.log(`[letters-engine] socket connected: ${socket.id} (${role})`)
    socket.join(role)

    socket.on('disconnect', reason => {
      console.log(`[letters-engine] socket disconnected: ${socket.id} (${role}, ${reason})`)
    })

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
      const { filters, teams, sessionLocked } = state
      state = lobbyState()
      state.filters = filters
      state.teams = teams
      state.sessionLocked = sessionLocked
      state.phase = 'idle'
      state.layout = shuffled(ARABIC_LETTERS).slice(0, BOARD_CELLS)
      state.roundNumber = 1
      undoSnapshot = null
      state.lastEvent = 'بدأت الجلسة! افتح الدور لأحد الفريقين'
      broadcast()
    })

    // Fresh game after a win: reset scores + claims and reshuffle the board.
    socket.on('letters:new_game', () => {
      if (role !== 'host') return
      if (state.phase === 'lobby') return
      const { filters, teams, sessionLocked } = state
      state = lobbyState()
      state.filters = filters
      state.teams = teams
      state.sessionLocked = sessionLocked
      state.phase = 'idle'
      state.layout = shuffled(ARABIC_LETTERS).slice(0, BOARD_CELLS)
      state.roundNumber = 1
      undoSnapshot = null
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
      undoSnapshot = null
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
      state.lastEvent = `${teamName(team)} يختار حرفاً من الخلايا`
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
      state.lastEvent = `اختار ${teamName(team)} حرف ${letter}`
      broadcast()
    })

    socket.on('letters:ready', () => {
      const team = teamOf(socket)
      if (!team || team !== state.activeTeam) return
      if (state.phase !== 'team_turn') return
      state.locked = true
      state.lastEvent = `${teamName(team)} جاهز بالجواب — يا مقدم احكم!`
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
      // Live stat: reaction speed from "buttons open" to this buzz.
      if (state.turnOpenedAt) {
        const seconds = Math.round(((Date.now() - state.turnOpenedAt) / 1000) * 10) / 10
        if (!state.fastest || seconds < state.fastest.seconds) {
          state.fastest = { team, seconds, round: state.roundNumber }
        }
      }
      state.lastEvent = `${teamName(team)} ضغط أولاً — جاوبوا الآن!`
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
        state.lastEvent = `أجاب ${teamName(team)} «${text}» — غير صحيحة، حاولوا من جديد أو قيّم يا مقدم`
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

      // Safety net for misclicks: one undo level restoring the exact
      // pre-judgment state (scores, claims, streaks, round log...).
      undoSnapshot = structuredClone(state)

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
      undoSnapshot = structuredClone(state)
      finishRound('failed', state.activeTeam)
      broadcast()
    })

    /** Restores the pre-judgment snapshot (one level). */
    socket.on('letters:undo', () => {
      if (role !== 'host') return
      if (!undoSnapshot) return
      state = undoSnapshot
      undoSnapshot = null
      // If the restored window already elapsed, grant a fresh one so the
      // timer doesn't instantly re-advance after the undo.
      if (state.phaseEndsAt && state.phaseEndsAt <= Date.now()) {
        const seconds = state.phase === 'choosing' ? state.chooseTime : state.answerTime
        state.phaseEndsAt = Date.now() + seconds * 1000
      }
      state.lastEvent = 'تم التراجع عن آخر تحكيم — الجولة عادت كما كانت'
      broadcast()
    })

    /** Manual score correction from the host console. */
    socket.on('letters:score_edit', payload => {
      if (role !== 'host') return
      const rec = (payload ?? {}) as Record<string, unknown>
      const team = rec.team === 'A' ? 'A' : rec.team === 'B' ? 'B' : null
      const delta = Number(rec.delta)
      if (!team || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 99) return
      state.scores[team] = Math.max(0, state.scores[team] + delta)
      state.lastEvent = `تعديل يدوي للنقاط: ${teamName(team)} ${delta > 0 ? '+' : ''}${delta}`
      broadcast()
    })

    /** Team customization: display name + icon. */
    socket.on('letters:team_info', payload => {
      if (role !== 'host') return
      const rec = (payload ?? {}) as Record<string, unknown>
      const team = rec.team === 'A' ? 'A' : rec.team === 'B' ? 'B' : null
      if (!team) return
      if (typeof rec.name === 'string') {
        state.teams[team].name = rec.name.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 24)
      }
      if (typeof rec.icon === 'string' && (TEAM_ICON_KEYS as readonly string[]).includes(rec.icon)) {
        state.teams[team].icon = rec.icon
      }
      broadcast()
    })

    /** Session lock: when on, team screens need the join code to connect. */
    socket.on('letters:toggle_lock', payload => {
      if (role !== 'host') return
      const rec = (payload ?? {}) as Record<string, unknown>
      state.sessionLocked = rec.locked === true
      state.lastEvent = state.sessionLocked
        ? 'الجلسة مقفلة — الدخول للفرق برمز الجلسة فقط'
        : 'الجلسة مفتوحة — أي فريق يمكنه الانضمام'
      broadcast()
    })

    socket.on('letters:next', () => {
      if (role !== 'host') return
      if (state.phase !== 'round_end') return
      undoSnapshot = null
      toIdle('الجولة التالية — افتح الدور لأحد الفريقين')
      state.roundNumber += 1
      broadcast()
    })

    socket.on('letters:end_session', () => {
      if (role !== 'host') return
      const { teams, sessionLocked } = state
      state = lobbyState()
      state.teams = teams
      state.sessionLocked = sessionLocked
      undoSnapshot = null
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
