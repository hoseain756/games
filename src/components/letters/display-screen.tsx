'use client'

import { Hourglass, Lightbulb, MonitorPlay, Trophy, Users } from 'lucide-react'
import { HexBadge, HexGrid } from '@/components/letters/hex-grid'
import {
  TEAM_COLORS,
  TEAM_LABELS,
  TEAM_MISSIONS,
  type LettersState,
  type LettersTeam,
} from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Big audience screen: the shuffled hexagon board + purple sidebar with the
// title, live scores, timer and the current question (without the answer
// until the round ends). Background mimics the orange/yellow diagonal design.
// ---------------------------------------------------------------------------

interface DisplayScreenProps {
  state: LettersState
  remaining: number | null
}

function phaseBanner(state: LettersState): { text: string; className: string } {
  const team = state.activeTeam ? TEAM_LABELS[state.activeTeam] : ''
  switch (state.phase) {
    case 'lobby':
      return { text: 'بانتظار المقدم لبدء الجلسة...', className: 'bg-purple-800 text-white' }
    case 'idle':
      return { text: 'استعدوا — المقدم سيفتح الدور قريباً', className: 'bg-purple-800 text-white' }
    case 'choosing':
      return { text: `${team} يختار حرفاً من الخلايا...`, className: 'bg-purple-800 text-white' }
    case 'team_turn':
      return { text: `الدور على ${team} — جاوبوا!`, className: 'bg-purple-800 text-white' }
    case 'open':
      return { text: 'انفتحت الأزرار للجميع — أسرع فريق يضغط يجاوب!', className: 'bg-red-600 text-white animate-pulse' }
    case 'buzz_answer':
      return { text: `${team} ضغط أولاً — جاوبوا الآن!`, className: 'bg-red-600 text-white' }
    case 'round_end':
      return state.result?.outcome === 'correct' && state.result.team
        ? {
            text: `إجابة صحيحة! ${TEAM_LABELS[state.result.team]} يفوز بالخلية (+1)`,
            className: 'bg-emerald-600 text-white',
          }
        : { text: 'انتهت الجولة — شوفوا الجواب الصحيح', className: 'bg-purple-800 text-white' }
    case 'game_over':
      return {
        text: `${TEAM_LABELS[state.gameWinner ?? 'A']} وصّل شريطيه — يفوز باللعبة!`,
        className: 'bg-emerald-600 text-white animate-pulse',
      }
  }
}

export function DisplayScreen({ state, remaining }: DisplayScreenProps) {
  const banner = phaseBanner(state)

  const timerRatio =
    remaining !== null && state.phaseEndsAt
      ? Math.max(0, Math.min(1, remaining / Math.max(state.answerTime, state.chooseTime, 1)))
      : 0

  return (
    <div
      className="flex min-h-screen flex-col text-purple-950"
      style={{
        fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif',
        background: 'linear-gradient(160deg, #fdf3e7 0%, #faebd3 55%, #f7e3c4 100%)',
      }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-purple-800 px-4 py-2 text-lg font-extrabold text-white shadow-lg">
            <MonitorPlay className="size-5" aria-hidden="true" />
            شاشة العرض
          </span>
          <span className="hidden rounded-full bg-purple-100 px-3 py-1.5 text-sm font-bold text-purple-800 sm:inline">
            الجولة {Math.max(state.roundNumber, 1)}
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight drop-shadow-[3px_3px_0_rgba(124,58,173,0.25)] sm:text-4xl">
          <span className="text-red-500">حروف</span>{' '}
          <span className="text-purple-800">مع حسين</span>
        </h1>
      </header>

      {/* Banner */}
      <div className="px-5 pt-3">
        <p
          className={`mx-auto w-fit rounded-full px-6 py-2 text-center text-lg font-extrabold shadow-lg sm:text-xl ${banner.className}`}
          role="status"
        >
          {banner.text}
        </p>
      </div>

      {/* Main: board + sidebar */}
      <main className="flex flex-1 flex-col items-stretch gap-4 overflow-hidden p-4 lg:flex-row lg:items-center">
        <section className="flex min-w-0 flex-1 items-center justify-center">
          <HexGrid
            layout={state.layout}
            claimed={state.claimed}
            activeLetter={state.phase === 'choosing' ? null : state.activeLetter}
            selectable={null}
            winPath={
              state.phase === 'game_over' && state.winPath.length > 0
                ? new Set(state.winPath)
                : null
            }
            winTeam={state.phase === 'game_over' ? state.gameWinner : null}
            className="h-auto w-full max-w-4xl drop-shadow-[0_14px_20px_rgba(124,58,173,0.35)]"
          />
        </section>

        {/* Purple sidebar */}
        <aside className="flex w-full min-w-0 flex-col gap-4 rounded-[2rem] bg-purple-800 p-5 shadow-2xl lg:w-[340px] xl:w-[400px] lg:shrink-0">
          {/* Scores */}
          <div className="flex items-center justify-around gap-3">
            {(['A', 'B'] as LettersTeam[]).map(team => (
              <div key={team} className="flex flex-col items-center gap-1">
                <HexBadge
                  fill={TEAM_COLORS[team].fill}
                  label={String(state.scores[team])}
                  className="size-16 drop-shadow-md sm:size-20"
                />
                <span className="text-sm font-bold text-amber-200">{TEAM_LABELS[team]}</span>
              </div>
            ))}
          </div>

          {/* Timer */}
          {state.phase === 'game_over' ? (
            <div className="rounded-2xl bg-emerald-600 p-4 text-center shadow-lg">
              <Trophy className="mx-auto size-10 text-amber-300" aria-hidden="true" />
              <p className="mt-1 text-xl font-black">
                {TEAM_LABELS[state.gameWinner ?? 'A']} فاز!
              </p>
            </div>
          ) : remaining !== null ? (
            <div className="rounded-2xl bg-purple-900/60 p-4 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-purple-200">
                <Hourglass className="size-4" aria-hidden="true" />
                الوقت المتبقي
              </p>
              <p
                className={`text-6xl font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-400' : 'text-amber-200'}`}
              >
                {remaining}
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-purple-950">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${remaining <= 5 ? 'bg-red-400' : 'bg-amber-300'}`}
                  style={{ width: `${timerRatio * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-purple-900/60 p-4 text-center text-lg font-bold text-purple-200">
              {state.phase === 'open'
                ? 'الأزرار مفتوحة — استعداداً للضغط!'
                : 'لا وقت شغال حالياً'}
            </div>
          )}

          {/* Question */}
          {state.question ? (
            <div className="rounded-2xl bg-white p-4 text-purple-900 shadow-inner">
              <p className="flex items-center gap-2 text-sm font-extrabold text-purple-500">
                <Lightbulb className="size-4" aria-hidden="true" />
                السؤال — حرف {state.question.letter}
              </p>
              <p className="mt-1 text-xl font-extrabold leading-snug">{state.question.q}</p>
              {state.question.a && state.phase === 'round_end' ? (
                <p className="mt-2 rounded-xl bg-emerald-100 px-3 py-2 text-lg font-black text-emerald-700">
                  الجواب: {state.question.a}
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-purple-300">
                  <Users className="size-4" aria-hidden="true" />
                  الجواب عند المقدم فقط
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-purple-900/60 p-4 text-center text-purple-200">
              <p className="text-sm font-bold">
                {state.phase === 'choosing'
                  ? 'الفريق يختار خلية حرف الآن...'
                  : 'تظهر الأسئلة هنا بعد اختيار الحرف'}
              </p>
            </div>
          )}

          {/* Turn indicator */}
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-purple-900/60 p-3">
            {(['A', 'B'] as LettersTeam[]).map(team => (
              <span
                key={team}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-extrabold transition-colors ${
                  state.activeTeam === team
                    ? 'border-amber-300 bg-amber-300 text-purple-900'
                    : 'border-purple-600 text-purple-300'
                }`}
              >
                {TEAM_LABELS[team]} {state.scores[team]}
              </span>
            ))}
          </div>

          {/* Board legend: which bands belong to which team */}
          <div className="space-y-1.5 rounded-2xl bg-purple-900/60 p-3 text-xs font-bold text-purple-100">
            <p className="flex items-center gap-2">
              <span className="inline-block size-3 shrink-0 rounded-sm bg-green-500" aria-hidden="true" />
              الفريق الأول: {TEAM_MISSIONS.A}
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block size-3 shrink-0 rounded-sm bg-orange-400" aria-hidden="true" />
              الفريق الثاني: {TEAM_MISSIONS.B}
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
