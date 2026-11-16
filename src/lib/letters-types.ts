// ---------------------------------------------------------------------------
// Shared types for "حروف مع حسين" (Letters with Hussein) — a two-team
// hexagon-letters party game. These types are used by both the Next.js
// frontend and the letters mini-service (port 3004).
// ---------------------------------------------------------------------------

/** The two competing teams. */
export type LettersTeam = 'A' | 'B'

/** Connected screen roles; each role has its own dedicated QR code. */
export type LettersRole = 'host' | 'teamA' | 'teamB' | 'display'

/**
 * Round lifecycle:
 * - lobby       session not created yet (host sees setup)
 * - idle        session created, waiting for the host to open a turn
 * - choosing    the active team is picking a letter from the hex grid
 * - team_turn   question shown, the active team answers within its time
 * - open        both teams used their windows — buzzers open for everyone
 * - buzz_answer first team to buzz is now answering within its time
 * - round_end   round finished (claim or no claim), result is revealed
 * - game_over   a team connected its two edges and WON THE WHOLE GAME
 */
export type LettersPhase =
  | 'lobby'
  | 'idle'
  | 'choosing'
  | 'team_turn'
  | 'open'
  | 'buzz_answer'
  | 'round_end'
  | 'game_over'

/** Question as seen by clients; the answer is stripped unless allowed. */
export interface LettersQuestionView {
  id: string
  letter: string
  q: string
  /** Present for the host always, and for everyone once the round ends. */
  a?: string
}

export interface LettersRoundResult {
  outcome: 'correct' | 'failed'
  /** Team that answered (or buzzed); null when nobody answered. */
  team: LettersTeam | null
  letter: string | null
  question: string | null
  answer: string | null
}

/** Full public state broadcast to every screen (sanitized per role). */
export interface LettersState {
  phase: LettersPhase
  /** Answer window in seconds (60 / 30 / 15). */
  answerTime: number
  /** Letter-choice window in seconds (10 / 15 / 20 / 30). */
  chooseTime: number
  activeTeam: LettersTeam | null
  activeLetter: string | null
  question: LettersQuestionView | null
  /** Server-clock epoch ms deadline for the current phase (null = no timer). */
  phaseEndsAt: number | null
  /** Server clock at broadcast time; clients derive a clock offset. */
  serverNow: number
  scores: Record<LettersTeam, number>
  /** letter -> claiming team (colored hexagons). */
  claimed: Record<string, LettersTeam>
  /** Shuffled 28 letters — same arrangement on every screen. */
  layout: string[]
  roundNumber: number
  /** Teams that already used their answering window this round. */
  answeredTeams: LettersTeam[]
  /** Team that buzzed first during the open phase. */
  buzzWinner: LettersTeam | null
  /** Active team pressed "عرفنا الجواب" (waiting for the host to judge). */
  locked: boolean
  online: { host: boolean; A: boolean; B: boolean; display: boolean }
  result: LettersRoundResult | null
  /** Set in the game_over phase: the team that connected its two edges. */
  gameWinner: LettersTeam | null
  /** Letters of the winning chain, edge to edge (game_over only). */
  winPath: string[]
  /** Short human-readable status message (Arabic). */
  lastEvent: string | null
}

export const TEAM_LABELS: Record<LettersTeam, string> = {
  A: 'الفريق الأول',
  B: 'الفريق الثاني',
}

/** Colors per team (matches the hexagon design: yellow vs salmon). */
export const TEAM_COLORS: Record<
  LettersTeam,
  { fill: string; deep: string; text: string; chip: string }
> = {
  A: {
    fill: '#fbbf24',
    deep: '#b45309',
    text: 'text-amber-600',
    chip: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  B: {
    fill: '#f87171',
    deep: '#b91c1c',
    text: 'text-red-500',
    chip: 'bg-red-100 text-red-700 border-red-300',
  },
}

export const ROLE_LABELS: Record<LettersRole, string> = {
  host: 'شاشة المقدم',
  teamA: 'الفريق الأول',
  teamB: 'الفريق الثاني',
  display: 'شاشة العرض',
}

/** Options offered to the host for the answer window. */
export const ANSWER_TIME_OPTIONS = [60, 30, 15] as const
/** Options offered to the host for the letter-choice window. */
export const CHOOSE_TIME_OPTIONS = [30, 20, 15, 10] as const

/** Mission of each team on the 5x5 connection board. */
export const TEAM_MISSIONS: Record<LettersTeam, string> = {
  A: 'توصيل الشريطين الأصفرين — الأعلى بالأسفل',
  B: 'توصيل الشريطين الأحمرين — اليمين باليسار',
}
