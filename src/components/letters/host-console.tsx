'use client'

import {
  Check,
  Dices,
  Hourglass,
  Link2,
  LogOut,
  MonitorPlay,
  Play,
  QrCode,
  RotateCcw,
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
import { HexBadge } from '@/components/letters/hex-grid'
import {
  ANSWER_TIME_OPTIONS,
  CHOOSE_TIME_OPTIONS,
  TEAM_COLORS,
  TEAM_LABELS,
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
  { role: 'teamA', label: 'الفريق الأول', icon: Trophy },
  { role: 'teamB', label: 'الفريق الثاني', icon: Trophy },
  { role: 'host', label: 'المقدم (صاحب الجلسة)', icon: Sparkles },
  { role: 'display', label: 'شاشة العرض الكبيرة', icon: MonitorPlay },
]

function QrSection() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {QR_ROLES.map(item => {
        const target = `/?game=huruf&role=${item.role}`
        return (
          <div key={item.role} className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-2xl border-4 border-purple-200 bg-white p-2 shadow">
              <img
                src={`/api/qr?text=${encodeURIComponent(target)}`}
                alt={`رمز QR لدخول ${item.label}`}
                className="size-24 sm:size-28"
              />
            </div>
            <p className="flex items-center gap-1 text-sm font-extrabold text-purple-800">
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </p>
            <p className="max-w-full break-all text-[10px] leading-tight text-muted-foreground" dir="ltr">
              {target}
            </p>
          </div>
        )
      })}
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
          <span className="rounded-full bg-purple-800 px-3 py-1.5 text-sm font-extrabold text-amber-200">
            حروف مع حسين
          </span>
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-right">امسح للانضمام</DialogTitle>
                <DialogDescription className="text-right">
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
        <span className={`rounded-full border px-2.5 py-1 ${state.online.A ? 'border-amber-300 bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>
          الفريق الأول {state.online.A ? 'متصل' : 'غير متصل'}
        </span>
        <span className={`rounded-full border px-2.5 py-1 ${state.online.B ? 'border-red-300 bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
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
              <CardContent className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  className="h-16 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-lg font-black text-amber-950 shadow-[0_6px_0_#92400e] hover:from-amber-300"
                  onClick={() => act('letters:open_turn', { team: 'A' })}
                >
                  <Play className="size-5" aria-hidden="true" />
                  {TEAM_LABELS.A}
                </Button>
                <Button
                  size="lg"
                  className="h-16 rounded-2xl bg-gradient-to-b from-red-400 to-red-500 text-lg font-black text-white shadow-[0_6px_0_#991b1b] hover:from-red-300"
                  onClick={() => act('letters:open_turn', { team: 'B' })}
                >
                  <Play className="size-5" aria-hidden="true" />
                  {TEAM_LABELS.B}
                </Button>
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
