// ---------------------------------------------------------------------------
// Shared types for "حروف مع حسين" (Letters with Hussein) — a two-team
// hexagon-letters party game. These types are used by both the Next.js
// frontend and the letters mini-service (port 3004).
// ---------------------------------------------------------------------------

/** The two competing teams. */
export type LettersTeam = 'A' | 'B'

/**
 * The 28 Arabic letters as shown on the board (hamza-alef display form).
 * Question-bank keys use plain "ا" — question-bank.ts maps between the two.
 */
export const ARABIC_LETTERS: string[] = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر',
  'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف',
  'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
]

/** Filters for the question bank (values come from the JSON metadata). */
export interface LettersFilters {
  /** "الكل" or one of the bank categories. */
  category: string
  /** "الكل" or one of سهل / متوسط / صعب. */
  difficulty: string
}

/**
 * Customizable team identity (host sets name + icon from the console).
 * `name` may be empty -> fall back to TEAM_LABELS.
 * `icon` is one of TEAM_ICON_KEYS (mapped to a Lucide icon on the client).
 */
export interface LettersTeamInfo {
  name: string
  icon: string
}

/** One finished round as shown in the host's round log. */
export interface LettersHistoryEntry {
  round: number
  letter: string | null
  outcome: 'correct' | 'failed'
  team: LettersTeam | null
  points: number
  /** Epoch ms when the round was recorded. */
  at: number
}

/** Fastest buzz-in of the whole match (display-screen live stat). */
export interface LettersFastestAnswer {
  team: LettersTeam
  /** Seconds from "buttons open" to the buzz, rounded to 0.1s. */
  seconds: number
  round: number
}

/** Icon keys offered in the host's team customization picker. */
export const TEAM_ICON_KEYS = [
  'flag', 'crown', 'star', 'zap', 'rocket',
  'shield', 'flame', 'target', 'trophy', 'heart',
] as const
export type TeamIconKey = (typeof TEAM_ICON_KEYS)[number]

/** Bank metadata broadcast to every screen (no questions/answers included). */
export interface LettersBankInfo {
  totalQuestions: number
  questionsPerLetter: number
  letters: number
  categories: string[]
  difficulties: string[]
}

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
  /** Bank metadata shown as chips on the screens. */
  category?: string
  subcategory?: string
  difficulty?: string
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
  /** Active question-bank filters (host-controlled). */
  filters: LettersFilters
  /** Static bank metadata (categories/difficulties come from the JSON). */
  bankInfo: LettersBankInfo
  /** Last text answer a team submitted for verification (host visibility). */
  lastAnswerText: string | null
  /** Custom team identities (name may be empty -> TEAM_LABELS fallback). */
  teams: Record<LettersTeam, LettersTeamInfo>
  /** When true, team screens can only join with the session join code. */
  sessionLocked: boolean
  /** 4-digit code; always embedded in QR/team links, required when locked. */
  joinCode: string
  /** Finished rounds, newest first (host round log). */
  history: LettersHistoryEntry[]
  /** True when the host can undo the last judgment/cancel. */
  canUndo: boolean
  /** Fastest buzz-in of the match so far (null before the first buzz). */
  fastest: LettersFastestAnswer | null
  /** Current consecutive-correct streak per team. */
  streaks: Record<LettersTeam, number>
}

/** "الكل" sentinel used by the filter selectors. */
export const FILTER_ALL = 'الكل'

export const TEAM_LABELS: Record<LettersTeam, string> = {
  A: 'الفريق الأول',
  B: 'الفريق الثاني',
}

/** Custom team name (when set) or the default label. */
export function teamLabel(
  teams: Record<LettersTeam, LettersTeamInfo> | null | undefined,
  team: LettersTeam,
): string {
  const custom = teams?.[team]?.name?.trim()
  return custom && custom.length > 0 ? custom : TEAM_LABELS[team]
}

/** Custom team icon key (with a safe fallback). */
export function teamIcon(
  teams: Record<LettersTeam, LettersTeamInfo> | null | undefined,
  team: LettersTeam,
): string {
  const icon = teams?.[team]?.icon
  return icon && (TEAM_ICON_KEYS as readonly string[]).includes(icon) ? icon : 'flag'
}

/** Default identities for a fresh session. */
export function defaultTeamInfo(): Record<LettersTeam, LettersTeamInfo> {
  return { A: { name: '', icon: 'flag' }, B: { name: '', icon: 'zap' } }
}

/** Colors per team (matches the reference board: green vs orange). */
export const TEAM_COLORS: Record<
  LettersTeam,
  { fill: string; deep: string; text: string; chip: string }
> = {
  A: {
    fill: '#3bb316',
    deep: '#276b12',
    text: 'text-green-600',
    chip: 'bg-green-100 text-green-800 border-green-300',
  },
  B: {
    fill: '#ff7836',
    deep: '#c2410c',
    text: 'text-orange-600',
    chip: 'bg-orange-100 text-orange-800 border-orange-300',
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
  A: 'توصيل الشريطين الأخضرين — الأعلى بالأسفل',
  B: 'توصيل الشريطين البرتقاليين — اليمين باليسار',
}

/** Difficulty labels -> colors used for chips on the screens. */
export const DIFFICULTY_STYLES: Record<string, string> = {
  'سهل': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'متوسط': 'bg-amber-100 text-amber-700 border-amber-300',
  'صعب': 'bg-red-100 text-red-700 border-red-300',
}
