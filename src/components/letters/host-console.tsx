'use client'

import {
  BookOpen,
  Check,
  Copy,
  Dices,
  History,
  Hourglass,
  Keyboard,
  Link2,
  Lock,
  LogOut,
  Minus,
  MonitorPlay,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Undo2,
  Unlock,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { CandyButton } from '@/components/letters/candy-button'
import { TeamIcon } from '@/components/letters/team-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { HexBadge, HexGrid } from '@/components/letters/hex-grid'
import { HurufLogo } from '@/components/letters/huruf-logo'
import {
  areSoundsMuted,
  playSound,
  setSoundsMuted,
  unlockAudio,
} from '@/lib/letters-sounds'
import {
  ANSWER_TIME_OPTIONS,
  CHOOSE_TIME_OPTIONS,
  FILTER_ALL,
  TEAM_COLORS,
  TEAM_ICON_KEYS,
  TEAM_LABELS,
  TEAM_MISSIONS,
  teamIcon,
  teamLabel,
  type LettersState,
  type LettersTeam,
} from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Host console: session setup, team customization, session lock + join code,
// QR codes, keyboard shortcuts, judging with undo, manual score correction
// and the round log. The host is the only one who sees the answer.
// ---------------------------------------------------------------------------

interface HostConsoleProps {
  state: LettersState
  connected: boolean
  remaining: number | null
  act: (event: string, payload?: Record<string, unknown>) => void
}

const OTHER_TEAM: Record<LettersTeam, LettersTeam> = { A: 'B', B: 'A' }

const QR_ROLES: {
  role: string
  team?: LettersTeam
  label: string
  icon: typeof Trophy
  chip: string
  tile: string
}[] = [
  {
    role: 'teamA',
    team: 'A',
    label: TEAM_LABELS.A,
    icon: Trophy,
    chip: 'bg-green-100 text-green-800 border-green-300',
    tile: 'ring-green-300/70',
  },
  {
    role: 'teamB',
    team: 'B',
    label: TEAM_LABELS.B,
    icon: Trophy,
    chip: 'bg-orange-100 text-orange-800 border-orange-300',
    tile: 'ring-orange-300/70',
  },
  {
    role: 'host',
    label: 'المقدم',
    icon: Sparkles,
    chip: 'bg-purple-100 text-purple-800 border-purple-300',
    tile: 'ring-purple-300/70',
  },
  {
    role: 'display',
    label: 'شاشة العرض',
    icon: MonitorPlay,
    chip: 'bg-amber-100 text-amber-800 border-amber-300',
    tile: 'ring-amber-300/70',
  },
]

// Filter selectors for the question bank — options come straight from the
// bank metadata broadcast by the service (categories + difficulties).
function QuestionFilterControls({
  state,
  act,
}: Pick<HostConsoleProps, 'state' | 'act'>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="min-w-0 flex-1">
        <label className="mb-1.5 block text-xs font-extrabold text-muted-foreground">
          فئة الأسئلة
        </label>
        <Select
          value={state.filters.category}
          onValueChange={value => act('letters:config', { category: value })}
        >
          <SelectTrigger className="h-12 rounded-2xl text-sm font-extrabold" aria-label="فئة الأسئلة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>كل الفئات</SelectItem>
            {state.bankInfo.categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 flex-1">
        <label className="mb-1.5 block text-xs font-extrabold text-muted-foreground">
          مستوى الصعوبة
        </label>
        <Select
          value={state.filters.difficulty}
          onValueChange={value => act('letters:config', { difficulty: value })}
        >
          <SelectTrigger className="h-12 rounded-2xl text-sm font-extrabold" aria-label="مستوى الصعوبة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>كل المستويات</SelectItem>
            {state.bankInfo.difficulties.map(difficulty => (
              <SelectItem key={difficulty} value={difficulty}>
                {difficulty}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function QrCard({
  item,
  joinCode,
  teams,
}: {
  item: (typeof QR_ROLES)[number]
  joinCode: string
  teams: LettersState['teams']
}) {
  const [copied, setCopied] = useState(false)
  // Build the ABSOLUTE join URL in the browser, never on the server: behind
  // the sandbox/edge gateways the request arrives over plain HTTP, so a
  // server-resolved URL gets an http:// scheme the public HTTPS edge never
  // answers — scanned phones then spin forever. window.location always
  // carries the real, working origin (https on hosted platforms).
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setOrigin(window.location.origin), 0)
    return () => window.clearTimeout(id)
  }, [])
  const label = item.team ? teamLabel(teams, item.team) : item.label
  const target = `/?game=huruf&role=${item.role}&code=${joinCode}`
  const fullTarget = origin ? `${origin}${target}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullTarget || `${window.location.origin}${target}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable (non-secure context) — ignore silently
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-2.5 rounded-2xl border-2 bg-card/60 p-3 sm:p-4">
      <button
        type="button"
        onClick={copyLink}
        aria-label="نسخ الرابط"
        title="نسخ الرابط"
        className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>
      <div className={`rounded-2xl bg-white p-2 shadow-sm ring-4 ${item.tile}`}>
        {fullTarget ? (
          <img
            src={`/api/qr?text=${encodeURIComponent(fullTarget)}`}
            alt={`رمز QR لدخول ${label}`}
            className="size-24 sm:size-28 lg:size-32"
          />
        ) : (
          <div className="size-24 sm:size-28 lg:size-32" aria-hidden="true" />
        )}
      </div>
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-extrabold sm:text-sm ${item.chip}`}
      >
        {item.team ? (
          <TeamIcon icon={teamIcon(teams, item.team)} className="size-3.5 sm:size-4" />
        ) : (
          <item.icon className="size-3.5 sm:size-4" aria-hidden="true" />
        )}
        {label}
      </span>
      <span className="text-[10px] font-bold text-muted-foreground">امسح بالكاميرا للدخول</span>
    </div>
  )
}

function QrSection({
  joinCode,
  teams,
}: {
  joinCode: string
  teams: LettersState['teams']
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {QR_ROLES.map(item => (
        <QrCard key={item.role} item={item} joinCode={joinCode} teams={teams} />
      ))}
    </div>
  )
}

/** One team's identity editor: custom name + icon picker. */
function TeamIdentity({
  team,
  state,
  act,
}: {
  team: LettersTeam
  state: LettersState
  act: HostConsoleProps['act']
}) {
  const info = state.teams[team]

  // Uncontrolled input keyed by the server value: typing never fights the
  // broadcast, and a changed server value remounts with the fresh name.
  const commit = (event: FocusEvent<HTMLInputElement>) => {
    const trimmed = event.currentTarget.value.trim().slice(0, 24)
    if (trimmed !== info.name) {
      act('letters:team_info', { team, name: trimmed })
    }
  }

  return (
    <div className={`rounded-2xl border-2 p-3 ${TEAM_COLORS[team].chip}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold">
        <TeamIcon icon={teamIcon(state.teams, team)} className="size-4" />
        {TEAM_LABELS[team]}
      </p>
      <Input
        key={info.name}
        defaultValue={info.name}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        maxLength={24}
        placeholder="اسم الفريق (اختياري)"
        aria-label={`اسم ${TEAM_LABELS[team]}`}
        className="h-10 rounded-xl border-2 bg-white/80 text-sm font-extrabold"
      />
      <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label={`أيقونة ${TEAM_LABELS[team]}`}>
        {TEAM_ICON_KEYS.map(key => {
          const selected = info.icon === key
          return (
            <button
              key={key}
              type="button"
              aria-label={`أيقونة ${key}`}
              aria-pressed={selected}
              onClick={() => act('letters:team_info', { team, icon: key })}
              className={`flex h-9 items-center justify-center rounded-xl border-2 transition ${
                selected
                  ? 'border-current bg-white shadow-inner'
                  : 'border-transparent bg-white/60 text-muted-foreground hover:bg-white'
              }`}
            >
              <TeamIcon icon={key} className="size-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Session lock toggle + the join code (embedded in every QR/link). */
function LockBar({ state, act }: Pick<HostConsoleProps, 'state' | 'act'>) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.joinCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 bg-card/70 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`grid size-9 place-items-center rounded-xl ${
            state.sessionLocked ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'
          }`}
          aria-hidden="true"
        >
          {state.sessionLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight">قفل الجلسة</p>
          <p className="text-xs text-muted-foreground">
            {state.sessionLocked
              ? 'الفريق الجديد يحتاج الرمز للدخول'
              : 'الدخول مفتوح لأي فريق'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyCode}
          aria-label="نسخ رمز الجلسة"
          title="نسخ رمز الجلسة"
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 px-3 py-1.5 text-lg font-black tabular-nums text-purple-800 transition-colors hover:bg-purple-100"
          dir="ltr"
        >
          {state.joinCode}
          {copied ? (
            <Check className="size-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="size-4 text-purple-400" aria-hidden="true" />
          )}
        </button>
        <Switch
          checked={state.sessionLocked}
          onCheckedChange={checked => act('letters:toggle_lock', { locked: checked })}
          aria-label="قفل الجلسة برمز دخول"
        />
      </div>
    </div>
  )
}

/** Newest-first list of finished rounds (letters + outcomes). */
function RoundsLog({ state }: Pick<HostConsoleProps, 'state'>) {
  if (state.history.length === 0) return null
  return (
    <Card className="rounded-3xl border-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-purple-600" aria-hidden="true" />
          سجل الجولات
        </CardTitle>
        <CardDescription>آخر {state.history.length} جولة — الأحدث أولاً</CardDescription>
      </CardHeader>
      <CardContent className="max-h-48 overflow-y-auto">
        <ul className="flex flex-col gap-1.5">
          {state.history.map((entry, index) => (
            <li
              key={`${entry.at}-${index}`}
              className="flex items-center justify-between gap-2 rounded-xl border bg-card/60 px-3 py-1.5 text-xs font-bold"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`inline-block size-2.5 shrink-0 rounded-full ${
                    entry.team === 'A' ? 'bg-green-500' : entry.team === 'B' ? 'bg-orange-400' : 'bg-muted-foreground/40'
                  }`}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap text-muted-foreground">ج{entry.round}</span>
                {entry.letter && <span className="text-base font-black">{entry.letter}</span>}
              </span>
              <span
                className={
                  entry.outcome === 'correct'
                    ? `whitespace-nowrap ${entry.team === 'A' ? 'text-green-700' : 'text-orange-700'}`
                    : 'whitespace-nowrap text-muted-foreground'
                }
              >
                {entry.outcome === 'correct' && entry.team
                  ? `${teamLabel(state.teams, entry.team)} +${entry.points}`
                  : 'بلا إجابة صحيحة'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function HostConsole({ state, connected, remaining, act }: HostConsoleProps) {
  const [qrOpen, setQrOpen] = useState(false)
  const [muted, setMuted] = useState(areSoundsMuted())

  const answering = state.phase === 'team_turn' || state.phase === 'buzz_answer'

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      setSoundsMuted(next)
      return next
    })
  }, [])

  // Audio needs one user gesture before it can play — unlock on the first
  // interaction with the console.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Phase-transition sounds: chime when a turn opens, verdict sounds on the
  // round end, fanfare on a whole-game win.
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = state.phase
    if (prev === null || prev === state.phase) return
    if (state.phase === 'choosing' || state.phase === 'open') {
      playSound('bell')
    } else if (state.phase === 'round_end') {
      playSound(state.result?.outcome === 'correct' ? 'correct' : 'wrong')
    } else if (state.phase === 'game_over') {
      playSound('fanfare')
    }
  }, [state.phase, state.result?.outcome])

  // Countdown ticks for the last 5 seconds of any timed phase.
  const lastTickRef = useRef<number | null>(null)
  useEffect(() => {
    if (remaining === null || remaining <= 0 || remaining > 5) {
      lastTickRef.current = null
      return
    }
    if (lastTickRef.current !== remaining) {
      lastTickRef.current = remaining
      playSound('tick')
    }
  }, [remaining])

  // ---- Keyboard shortcuts -------------------------------------------------
  // Space = continue/open turn · 1/2 = open turn for a team · Y/N = judge
  // Z = undo · M = mute. Ignored while typing in inputs.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const lastTurnTeamRef = useRef<LettersTeam>('B')

  useEffect(() => {
    if (state.phase === 'choosing' && state.activeTeam) {
      lastTurnTeamRef.current = state.activeTeam
    }
  }, [state.phase, state.activeTeam])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.repeat) return

      const s = stateRef.current
      switch (event.code) {
        case 'Space': {
          event.preventDefault()
          if (s.phase === 'lobby') act('letters:start')
          else if (s.phase === 'idle') act('letters:open_turn', { team: OTHER_TEAM[lastTurnTeamRef.current] })
          else if (s.phase === 'choosing' && s.activeTeam) act('letters:open_turn', { team: s.activeTeam })
          else if (s.phase === 'round_end') act('letters:next')
          else if (s.phase === 'game_over') act('letters:new_game')
          break
        }
        case 'Digit1':
        case 'Numpad1':
          if (s.phase === 'idle' || s.phase === 'choosing' || s.phase === 'round_end') {
            act('letters:open_turn', { team: 'A' })
          }
          break
        case 'Digit2':
        case 'Numpad2':
          if (s.phase === 'idle' || s.phase === 'choosing' || s.phase === 'round_end') {
            act('letters:open_turn', { team: 'B' })
          }
          break
        case 'KeyY':
          if (answering && s.question) act('letters:judge', { correct: true })
          break
        case 'KeyN':
          if (answering && s.question) act('letters:judge', { correct: false })
          break
        case 'KeyZ':
          if (s.canUndo) act('letters:undo')
          break
        case 'KeyM':
          toggleMute()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, answering, toggleMute])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Session header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HurufLogo className="h-11 w-auto" />
          <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground">
            الجولة {Math.max(state.roundNumber, 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CandyButton
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'تشغيل الأصوات' : 'كتم الأصوات'}
          >
            {muted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
            {muted ? 'مكتوم' : 'الصوت'}
          </CandyButton>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild>
              <CandyButton variant="ghost" size="sm">
                <QrCode className="size-4" aria-hidden="true" />
                رموز QR
              </CandyButton>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] gap-5 sm:max-w-xl">
              <DialogHeader className="items-center text-center">
                <DialogTitle className="flex items-center justify-center gap-2 text-center">
                  <QrCode className="size-5 text-purple-600" aria-hidden="true" />
                  رموز QR للانضمام
                </DialogTitle>
                <DialogDescription className="text-center">
                  كل فريق يمسح رمزه من جواله، والمقدم يمسح رمز الجلسة، وشاشة العرض تفتح على التلفاز.
                </DialogDescription>
              </DialogHeader>
              <QrSection joinCode={state.joinCode} teams={state.teams} />
            </DialogContent>
          </Dialog>
          <CandyButton variant="ghostDanger" size="sm" onClick={() => act('letters:end_session')}>
            <LogOut className="size-4" aria-hidden="true" />
            إنهاء الجلسة
          </CandyButton>
        </div>
      </div>

      {/* Presence chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className={`rounded-full border px-2.5 py-1 ${state.online.A ? 'border-green-300 bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
          {teamLabel(state.teams, 'A')} {state.online.A ? 'متصل' : 'غير متصل'}
        </span>
        <span className={`rounded-full border px-2.5 py-1 ${state.online.B ? 'border-orange-300 bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
          {teamLabel(state.teams, 'B')} {state.online.B ? 'متصل' : 'غير متصل'}
        </span>
        <span className={`rounded-full border px-2.5 py-1 ${state.online.display ? 'border-purple-300 bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
          شاشة العرض {state.online.display ? 'مفتوحة' : 'مغلقة'}
        </span>
        {!connected && (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-amber-800">
            جاري الاتصال بالخادم...
          </span>
        )}
      </div>

      {/* Session lock + join code */}
      <LockBar state={state} act={act} />

      {/* Keyboard shortcuts hint */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-purple-50 px-3 py-2 text-[11px] font-bold text-purple-500">
        <span className="flex items-center gap-1">
          <Keyboard className="size-3.5 shrink-0" aria-hidden="true" />
          اختصارات:
        </span>
        <span>مسافة = متابعة / فتح الدور</span>
        <span dir="ltr">1 / 2</span>
        <span>= فتح دور فريق</span>
        <span dir="ltr">Y / N</span>
        <span>= صح / خطأ</span>
        <span dir="ltr">Z</span>
        <span>= تراجع</span>
        <span dir="ltr">M</span>
        <span>= كتم</span>
      </p>

      {/* Mission legend */}
      {state.phase !== 'lobby' && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1.5 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-green-800">
            <span className="inline-block size-3 rounded-sm bg-green-500" aria-hidden="true" />
            {teamLabel(state.teams, 'A')}: {TEAM_MISSIONS.A}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-orange-700">
            <span className="inline-block size-3 rounded-sm bg-orange-400" aria-hidden="true" />
            {teamLabel(state.teams, 'B')}: {TEAM_MISSIONS.B}
          </span>
        </div>
      )}

      {/* Lobby: setup */}
      {state.phase === 'lobby' ? (
        <Card className="rounded-3xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Dices className="size-5 text-purple-600" aria-hidden="true" />
              إعدادات الجلسة
            </CardTitle>
            <CardDescription>حدد مدة الإجابة ومدة اختيار الحرف قبل البدء.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-2 rounded-2xl bg-purple-50 px-3 py-2.5 text-sm font-extrabold text-purple-800">
              <BookOpen className="size-4 shrink-0" aria-hidden="true" />
              بنك الأسئلة: {state.bankInfo.totalQuestions.toLocaleString('ar')} سؤالاً —{' '}
              {state.bankInfo.letters} حرفاً × {state.bankInfo.questionsPerLetter} سؤالاً
            </div>

            {/* Team customization */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-extrabold">
                <Users className="size-4 text-purple-600" aria-hidden="true" />
                أسماء الفرق وأيقوناتها
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TeamIdentity team="A" state={state} act={act} />
                <TeamIdentity team="B" state={state} act={act} />
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 font-extrabold">
                <SlidersHorizontal className="size-4 text-purple-600" aria-hidden="true" />
                فئة الأسئلة ومستوى الصعوبة
              </p>
              <QuestionFilterControls state={state} act={act} />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-extrabold">
                <Hourglass className="size-4 text-purple-600" aria-hidden="true" />
                مدة وقت الإجابة
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ANSWER_TIME_OPTIONS.map(seconds => (
                  <CandyButton
                    key={seconds}
                    variant={state.answerTime === seconds ? 'purple' : 'ghost'}
                    className="h-12 text-base"
                    aria-pressed={state.answerTime === seconds}
                    onClick={() => act('letters:config', { answerTime: seconds })}
                  >
                    {seconds === 60 ? 'دقيقة' : `${seconds} ثانية`}
                  </CandyButton>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-extrabold">
                <Link2 className="size-4 text-purple-600" aria-hidden="true" />
                مدة اختيار الحرف
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CHOOSE_TIME_OPTIONS.map(seconds => (
                  <CandyButton
                    key={seconds}
                    variant={state.chooseTime === seconds ? 'purple' : 'ghost'}
                    className="h-12 text-base"
                    aria-pressed={state.chooseTime === seconds}
                    onClick={() => act('letters:config', { chooseTime: seconds })}
                  >
                    {seconds} ث
                  </CandyButton>
                ))}
              </div>
            </div>
            <CandyButton
              variant="yellow"
              size="lg"
              className="h-14"
              onClick={() => act('letters:start')}
            >
              <Play className="size-5" aria-hidden="true" />
              بدء الجلسة وترتيب الخلايا عشوائياً
            </CandyButton>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scores + timer + manual score correction + undo */}
          <Card className="rounded-3xl border-2">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              {(['A', 'B'] as LettersTeam[]).map(team => (
                <div key={team} className="flex items-center gap-2">
                  <HexBadge
                    fill={TEAM_COLORS[team].fill}
                    label={String(state.scores[team])}
                    className="size-12"
                  />
                  <div className="flex flex-col gap-0.5">
                    <p className="flex items-center gap-1 text-sm font-extrabold">
                      <TeamIcon icon={teamIcon(state.teams, team)} className="size-3.5 shrink-0" />
                      {teamLabel(state.teams, team)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state.activeTeam === team ? 'الدور عليه الآن' : `${state.answeredTeams.includes(team) ? 'أجاب هذه الجولة' : 'جاهز'}`}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <CandyButton
                        variant="ghost"
                        size="sm"
                        className="h-6 w-8 rounded-lg p-0 text-[11px]"
                        aria-label={`خصم نقطة من ${teamLabel(state.teams, team)}`}
                        onClick={() => act('letters:score_edit', { team, delta: -1 })}
                      >
                        <Minus className="size-3" aria-hidden="true" />
                        1
                      </CandyButton>
                      <CandyButton
                        variant="ghost"
                        size="sm"
                        className="h-6 w-8 rounded-lg p-0 text-[11px]"
                        aria-label={`إضافة نقطة لـ ${teamLabel(state.teams, team)}`}
                        onClick={() => act('letters:score_edit', { team, delta: 1 })}
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        1
                      </CandyButton>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1.5 text-center">
                {remaining !== null ? (
                  <p className={`text-4xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-600' : 'text-purple-800'}`}>
                    {remaining}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-muted-foreground">لا مؤقت</p>
                )}
                {state.canUndo && (
                  <CandyButton
                    variant="ghostDanger"
                    size="sm"
                    className="h-8"
                    onClick={() => act('letters:undo')}
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    تراجع عن التحكيم
                  </CandyButton>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status / actions */}
          {state.phase === 'idle' && (
            <Card className="rounded-3xl border-2">
              <CardHeader>
                <CardTitle className="text-lg">افتح الدور لأحد الفريقين</CardTitle>
                <CardDescription>{state.lastEvent}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <CandyButton
                    variant="green"
                    size="xl"
                    onClick={() => act('letters:open_turn', { team: 'A' })}
                  >
                    <Play className="size-5" aria-hidden="true" />
                    {teamLabel(state.teams, 'A')}
                  </CandyButton>
                  <CandyButton
                    variant="orange"
                    size="xl"
                    onClick={() => act('letters:open_turn', { team: 'B' })}
                  >
                    <Play className="size-5" aria-hidden="true" />
                    {teamLabel(state.teams, 'B')}
                  </CandyButton>
                </div>
                <HexGrid
                  layout={state.layout}
                  claimed={state.claimed}
                  selectable={null}
                  className="mx-auto h-auto w-full max-w-sm"
                />
                <div className="rounded-2xl border-2 border-dashed border-purple-200 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-purple-500">
                    <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                    فلترة الأسئلة (تُطبَّق على الجولة القادمة)
                  </p>
                  <QuestionFilterControls state={state} act={act} />
                </div>
              </CardContent>
            </Card>
          )}

          {state.phase === 'choosing' && (
            <Card className="rounded-3xl border-2">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <p className="text-lg font-extrabold">
                  {teamLabel(state.teams, state.activeTeam ?? 'A')} يختار حرفاً من اللوحة...
                </p>
                {remaining !== null && (
                  <p className={`text-5xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-600' : 'text-purple-800'}`}>
                    {remaining}
                  </p>
                )}
                <CandyButton
                  variant="ghost"
                  className="mt-2 gap-1.5"
                  onClick={() => act('letters:open_turn', { team: state.activeTeam })}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  إعادة فتح الدور
                </CandyButton>
              </CardContent>
            </Card>
          )}

          {answering && state.question && (
            <Card className="rounded-3xl border-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-lg">
                  <span className="flex items-center gap-2">
                    <HexBadge
                      fill={TEAM_COLORS[state.activeTeam ?? 'A'].fill}
                      label={state.activeLetter ?? ''}
                      className="size-12"
                      fontSize={40}
                    />
                    سؤال {teamLabel(state.teams, state.activeTeam ?? 'A')}
                  </span>
                  {remaining !== null && (
                    <span className={`text-2xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-600' : 'text-purple-800'}`}>
                      {remaining} ث
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="rounded-2xl bg-purple-50 p-4 text-xl font-extrabold leading-relaxed text-purple-900">
                  {state.question.q}
                </p>
                <p className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-xl font-black text-emerald-700">
                  الجواب: {state.question.a}
                </p>
                {state.lastAnswerText && (
                  <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800">
                    جواب الفريق المكتوب: «{state.lastAnswerText}»
                  </p>
                )}
                {state.locked && (
                  <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-extrabold text-amber-800">
                    الفريق ثبّت جوابه — قيّم الآن!
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <CandyButton
                    variant="emerald"
                    size="xl"
                    onClick={() => act('letters:judge', { correct: true })}
                  >
                    <Check className="size-6" aria-hidden="true" />
                    صح (+1)
                  </CandyButton>
                  <CandyButton
                    variant="red"
                    size="xl"
                    onClick={() => act('letters:judge', { correct: false })}
                  >
                    <X className="size-6" aria-hidden="true" />
                    خطأ
                  </CandyButton>
                </div>
              </CardContent>
            </Card>
          )}

          {state.phase === 'open' && (
            <Card className="rounded-3xl border-2 border-red-200">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="flex items-center gap-2 text-lg font-black text-red-600">
                  <Zap className="size-5 animate-pulse" aria-hidden="true" />
                  الأزرار مفتوحة عند الفريقين — أول من يضغط يجاوب
                </p>
                {state.question && (
                  <p className="rounded-2xl bg-purple-50 p-3 font-extrabold text-purple-900">
                    {state.question.q}
                  </p>
                )}
                <CandyButton variant="ghostDanger" onClick={() => act('letters:cancel_round')}>
                  إلغاء الجولة
                </CandyButton>
              </CardContent>
            </Card>
          )}

          {state.phase === 'game_over' && (
            <Card className="rounded-3xl border-4 border-emerald-300">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Trophy
                  className="size-12 text-amber-500 drop-shadow"
                  aria-hidden="true"
                />
                <p className="text-2xl font-black">
                  {teamLabel(state.teams, state.gameWinner ?? 'A')} يفوز باللعبة!
                </p>
                <p className="text-sm font-bold text-emerald-700">وصّل شريطيه بالخلايا — مبروك!</p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {state.winPath.map(letter => (
                    <HexBadge
                      key={letter}
                      fill={TEAM_COLORS[state.gameWinner ?? 'A'].fill}
                      label={letter}
                      className="size-9"
                      fontSize={38}
                    />
                  ))}
                </div>
                <CandyButton
                  variant="purple"
                  size="lg"
                  className="mt-1"
                  onClick={() => act('letters:new_game')}
                >
                  <RotateCcw className="size-5" aria-hidden="true" />
                  لعبة جديدة (لوحة وعشرات جديدة)
                </CandyButton>
              </CardContent>
            </Card>
          )}

          {state.phase === 'round_end' && (
            <Card className={`rounded-3xl border-2 ${state.result?.outcome === 'correct' ? 'border-emerald-300' : ''}`}>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-xl font-black">
                  {state.result?.outcome === 'correct'
                    ? `${teamLabel(state.teams, state.result.team ?? 'A')} أجاب صح — +1`
                    : 'انتهت الجولة دون إجابة صحيحة'}
                </p>
                {state.result?.answer && (
                  <p className="rounded-xl bg-emerald-50 px-4 py-2 font-extrabold text-emerald-700">
                    الجواب: {state.result.answer}
                  </p>
                )}
                <CandyButton
                  variant="purple"
                  size="lg"
                  className="mt-1"
                  onClick={() => act('letters:next')}
                >
                  <RotateCcw className="size-5" aria-hidden="true" />
                  الجولة التالية
                </CandyButton>
              </CardContent>
            </Card>
          )}

          {/* Round log */}
          <RoundsLog state={state} />
        </>
      )}

      {/* QR codes are always visible in the lobby */}
      {state.phase === 'lobby' && (
        <Card className="rounded-3xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="size-5 text-purple-600" aria-hidden="true" />
              رموز الدخول
            </CardTitle>
            <CardDescription>
              كل فريق يمسح رمزه، والمقدم يمسح رمز الجلسة، وشاشة العرض تفتح على التلفاز.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrSection joinCode={state.joinCode} teams={state.teams} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
