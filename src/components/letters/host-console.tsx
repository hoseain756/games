'use client'

import {
  BookOpen,
  Check,
  Copy,
  Dices,
  Hourglass,
  Link2,
  LogOut,
  MonitorPlay,
  Play,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HexBadge, HexGrid } from '@/components/letters/hex-grid'
import { HurufLogo } from '@/components/letters/huruf-logo'
import {
  ANSWER_TIME_OPTIONS,
  CHOOSE_TIME_OPTIONS,
  FILTER_ALL,
  TEAM_COLORS,
  TEAM_LABELS,
  TEAM_MISSIONS,
  type LettersState,
  type LettersTeam,
} from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Host console: session setup, QR codes for every screen, full control over
// turns, and judging (the host is the only one who sees the answer).
// ---------------------------------------------------------------------------

interface HostConsoleProps {
  state: LettersState
  connected: boolean
  remaining: number | null
  act: (event: string, payload?: Record<string, unknown>) => void
}

const QR_ROLES = [
  {
    role: 'teamA',
    label: 'الفريق الأول',
    icon: Trophy,
    chip: 'bg-green-100 text-green-800 border-green-300',
    tile: 'ring-green-300/70',
  },
  {
    role: 'teamB',
    label: 'الفريق الثاني',
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

function QrCard({ item }: { item: (typeof QR_ROLES)[number] }) {
  const [copied, setCopied] = useState(false)
  const target = `/?game=huruf&role=${item.role}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${target}`)
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
        <img
          src={`/api/qr?text=${encodeURIComponent(target)}`}
          alt={`رمز QR لدخول ${item.label}`}
          className="size-24 sm:size-28 lg:size-32"
        />
      </div>
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-extrabold sm:text-sm ${item.chip}`}
      >
        <item.icon className="size-3.5 sm:size-4" aria-hidden="true" />
        {item.label}
      </span>
      <span className="text-[10px] font-bold text-muted-foreground">امسح بالكاميرا للدخول</span>
    </div>
  )
}

function QrSection() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {QR_ROLES.map(item => (
        <QrCard key={item.role} item={item} />
      ))}
    </div>
  )
}

export function HostConsole({ state, connected, remaining, act }: HostConsoleProps) {
  const [qrOpen, setQrOpen] = useState(false)

  const answering = state.phase === 'team_turn' || state.phase === 'buzz_answer'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Session header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HurufLogo className="h-10 w-auto drop-shadow-[0_3px_0_rgba(124,58,173,0.18)]" />
          <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground">
            الجولة {Math.max(state.roundNumber, 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                <QrCode className="size-4" aria-hidden="true" />
                رموز QR
              </Button>
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
              <QrSection />
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => act('letters:end_session')}
          >
            <LogOut className="size-4" aria-hidden="true" />
            إنهاء الجلسة
          </Button>
        </div>
      </div>

      {/* Presence chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className={`rounded-full border px-2.5 py-1 ${state.online.A ? 'border-green-300 bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
          الفريق الأول {state.online.A ? 'متصل' : 'غير متصل'}
        </span>
        <span className={`rounded-full border px-2.5 py-1 ${state.online.B ? 'border-orange-300 bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
          الفريق الثاني {state.online.B ? 'متصل' : 'غير متصل'}
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

      {/* Mission legend */}
      {state.phase !== 'lobby' && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1.5 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-green-800">
            <span className="inline-block size-3 rounded-sm bg-green-500" aria-hidden="true" />
            الفريق الأول: {TEAM_MISSIONS.A}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-orange-700">
            <span className="inline-block size-3 rounded-sm bg-orange-400" aria-hidden="true" />
            الفريق الثاني: {TEAM_MISSIONS.B}
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
                  <Button
                    key={seconds}
                    type="button"
                    variant={state.answerTime === seconds ? 'default' : 'outline'}
                    className={`h-12 rounded-2xl text-base font-extrabold ${state.answerTime === seconds ? 'bg-purple-700 hover:bg-purple-800' : ''}`}
                    onClick={() => act('letters:config', { answerTime: seconds })}
                  >
                    {seconds === 60 ? 'دقيقة' : `${seconds} ثانية`}
                  </Button>
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
                  <Button
                    key={seconds}
                    type="button"
                    variant={state.chooseTime === seconds ? 'default' : 'outline'}
                    className={`h-12 rounded-2xl text-base font-extrabold ${state.chooseTime === seconds ? 'bg-purple-700 hover:bg-purple-800' : ''}`}
                    onClick={() => act('letters:config', { chooseTime: seconds })}
                  >
                    {seconds} ث
                  </Button>
                ))}
              </div>
            </div>
            <Button
              size="lg"
              className="h-14 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-800 text-lg font-black hover:from-purple-700 hover:to-purple-900"
              onClick={() => act('letters:start')}
            >
              <Play className="size-5" aria-hidden="true" />
              بدء الجلسة وترتيب الخلايا عشوائياً
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scores + timer */}
          <Card className="rounded-3xl border-2">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              {(['A', 'B'] as LettersTeam[]).map(team => (
                <div key={team} className="flex items-center gap-2">
                  <HexBadge
                    fill={TEAM_COLORS[team].fill}
                    label={String(state.scores[team])}
                    className="size-12"
                  />
                  <div>
                    <p className="text-sm font-extrabold">{TEAM_LABELS[team]}</p>
                    <p className="text-xs text-muted-foreground">
                      {state.activeTeam === team ? 'الدور عليه الآن' : `${state.answeredTeams.includes(team) ? 'أجاب هذه الجولة' : 'جاهز'}`}
                    </p>
                  </div>
                </div>
              ))}
              <div className="text-center">
                {remaining !== null ? (
                  <p className={`text-4xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-600' : 'text-purple-800'}`}>
                    {remaining}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-muted-foreground">لا مؤقت</p>
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
                  <Button
                    size="lg"
                    className="h-16 rounded-2xl bg-gradient-to-b from-green-500 to-green-600 text-lg font-black text-white shadow-[0_6px_0_#276b12] hover:from-green-400"
                    onClick={() => act('letters:open_turn', { team: 'A' })}
                  >
                    <Play className="size-5" aria-hidden="true" />
                    {TEAM_LABELS.A}
                  </Button>
                  <Button
                    size="lg"
                    className="h-16 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-500 text-lg font-black text-orange-950 shadow-[0_6px_0_#c2410c] hover:from-orange-300"
                    onClick={() => act('letters:open_turn', { team: 'B' })}
                  >
                    <Play className="size-5" aria-hidden="true" />
                    {TEAM_LABELS.B}
                  </Button>
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
                  {TEAM_LABELS[state.activeTeam ?? 'A']} يختار حرفاً من اللوحة...
                </p>
                {remaining !== null && (
                  <p className={`text-5xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-600' : 'text-purple-800'}`}>
                    {remaining}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="mt-2 gap-1.5 rounded-xl"
                  onClick={() => act('letters:open_turn', { team: state.activeTeam })}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  إعادة فتح الدور
                </Button>
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
                    سؤال {TEAM_LABELS[state.activeTeam ?? 'A']}
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
                {state.locked && (
                  <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-extrabold text-amber-800">
                    الفريق ثبّت جوابه — قيّم الآن!
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="h-16 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-lg font-black shadow-[0_6px_0_#065f46] hover:from-emerald-400"
                    onClick={() => act('letters:judge', { correct: true })}
                  >
                    <Check className="size-6" aria-hidden="true" />
                    صح (+1)
                  </Button>
                  <Button
                    size="lg"
                    className="h-16 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-lg font-black shadow-[0_6px_0_#7f1d1d] hover:from-red-400"
                    onClick={() => act('letters:judge', { correct: false })}
                  >
                    <X className="size-6" aria-hidden="true" />
                    خطأ
                  </Button>
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
                <Button variant="outline" className="rounded-xl" onClick={() => act('letters:cancel_round')}>
                  إلغاء الجولة
                </Button>
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
                  {TEAM_LABELS[state.gameWinner ?? 'A']} يفوز باللعبة!
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
                <Button
                  size="lg"
                  className="mt-1 h-14 rounded-2xl bg-purple-700 text-lg font-black hover:bg-purple-800"
                  onClick={() => act('letters:new_game')}
                >
                  <RotateCcw className="size-5" aria-hidden="true" />
                  لعبة جديدة (لوحة وعشرات جديدة)
                </Button>
              </CardContent>
            </Card>
          )}

          {state.phase === 'round_end' && (
            <Card className={`rounded-3xl border-2 ${state.result?.outcome === 'correct' ? 'border-emerald-300' : ''}`}>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-xl font-black">
                  {state.result?.outcome === 'correct'
                    ? `${TEAM_LABELS[state.result.team ?? 'A']} أجاب صح — +1`
                    : 'انتهت الجولة دون إجابة صحيحة'}
                </p>
                {state.result?.answer && (
                  <p className="rounded-xl bg-emerald-50 px-4 py-2 font-extrabold text-emerald-700">
                    الجواب: {state.result.answer}
                  </p>
                )}
                <Button
                  size="lg"
                  className="mt-1 h-14 rounded-2xl bg-purple-700 text-lg font-black hover:bg-purple-800"
                  onClick={() => act('letters:next')}
                >
                  <RotateCcw className="size-5" aria-hidden="true" />
                  الجولة التالية
                </Button>
              </CardContent>
            </Card>
          )}
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
            <QrSection />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
