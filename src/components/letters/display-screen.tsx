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
      className="flex min-h-screen flex-col text-purple-950 lg:h-screen lg:overflow-hidden"
      style={{
        fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif',
        background: 'linear-gradient(160deg, #fdf3e7 0%, #faebd3 55%, #f7e3c4 100%)',
      }}
    >
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-[clamp(0.4rem,1.5vmin,0.85rem)] px-fluid pt-[clamp(0.5rem,1.6vmin,1.25rem)]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-[clamp(0.3rem,1vmin,0.6rem)] whitespace-nowrap rounded-full bg-purple-800 px-fluid py-fluid-sm text-fluid-sm font-extrabold text-white shadow-lg">
            <MonitorPlay className="size-[clamp(0.95rem,2.4vmin,1.4rem)]" aria-hidden="true" />
            شاشة العرض
          </span>
          <span className="hidden rounded-full bg-purple-100 px-3 py-1.5 text-fluid-xs font-bold text-purple-800 sm:inline">
            الجولة {Math.max(state.roundNumber, 1)}
          </span>
        </div>
        <h1 className="text-fluid-2xl font-black leading-[1.15] tracking-tight drop-shadow-[3px_3px_0_rgba(124,58,173,0.25)]">
          <span className="whitespace-nowrap">
            <span className="text-red-500">حروف</span>{' '}
            <span className="text-purple-800">مع حسين</span>
          </span>
        </h1>
      </header>

      {/* Banner */}
      <div className="px-fluid pt-[clamp(0.4rem,1.2vmin,0.85rem)]">
        <p
          className={`mx-auto w-fit max-w-full rounded-full px-[clamp(1rem,3.2vmin,1.9rem)] py-fluid-sm text-center text-fluid-md font-extrabold shadow-lg ${banner.className}`}
          role="status"
        >
          {banner.text}
        </p>
      </div>

      {/* Main: board + sidebar */}
      <main className="flex min-h-0 flex-1 flex-col items-stretch gap-fluid overflow-hidden p-[clamp(0.6rem,2vmin,1.25rem)] lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
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
            className="h-auto max-h-full w-full max-w-4xl drop-shadow-[0_14px_20px_rgba(124,58,173,0.35)]"
          />
        </section>

        {/* Purple sidebar */}
        <aside className="scroll-thin flex w-full min-w-0 flex-col gap-fluid rounded-[2rem] bg-purple-800 p-[clamp(0.8rem,2.4vmin,1.5rem)] shadow-2xl lg:max-h-full lg:w-[clamp(280px,32vmin,420px)] lg:shrink-0 lg:overflow-y-auto">
          {/* Scores */}
          <div className="flex items-center justify-around gap-3">
            {(['A', 'B'] as LettersTeam[]).map(team => (
              <div key={team} className="flex flex-col items-center gap-1">
                <HexBadge
                  fill={TEAM_COLORS[team].fill}
                  label={String(state.scores[team])}
                  className="size-[clamp(3.25rem,10vmin,5rem)] drop-shadow-md"
                />
                <span className="text-fluid-xs font-bold text-amber-200">{TEAM_LABELS[team]}</span>
              </div>
            ))}
          </div>

          {/* Timer */}
          {state.phase === 'game_over' ? (
            <div className="rounded-2xl bg-emerald-600 p-[clamp(0.75rem,2vmin,1.25rem)] text-center shadow-lg">
              <Trophy className="mx-auto size-[clamp(1.75rem,5vmin,2.75rem)] text-amber-300" aria-hidden="true" />
              <p className="mt-1 text-fluid-lg font-black">
                {TEAM_LABELS[state.gameWinner ?? 'A']} فاز!
              </p>
            </div>
          ) : remaining !== null ? (
            <div className="rounded-2xl bg-purple-900/60 p-[clamp(0.75rem,2vmin,1.25rem)] text-center">
              <p className="flex items-center justify-center gap-2 text-fluid-xs font-bold text-purple-200">
                <Hourglass className="size-[clamp(0.85rem,2vmin,1.15rem)]" aria-hidden="true" />
                الوقت المتبقي
              </p>
              <p
                className={`text-fluid-timer font-black tabular-nums ${remaining <= 5 ? 'animate-pulse text-red-400' : 'text-amber-200'}`}
              >
                {remaining}
              </p>
              <div className="mt-2 h-[clamp(0.45rem,1.1vmin,0.8rem)] overflow-hidden rounded-full bg-purple-950">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${remaining <= 5 ? 'bg-red-400' : 'bg-amber-300'}`}
                  style={{ width: `${timerRatio * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-purple-900/60 p-[clamp(0.75rem,2vmin,1.25rem)] text-center text-fluid-sm font-bold text-purple-200">
              {state.phase === 'open'
                ? 'الأزرار مفتوحة — استعداداً للضغط!'
                : 'لا وقت شغال حالياً'}
            </div>
          )}

          {/* Question */}
          {state.question ? (
            <div className="rounded-2xl bg-white p-[clamp(0.75rem,2vmin,1.25rem)] text-purple-900 shadow-inner">
              <p className="flex items-center gap-2 text-fluid-xs font-extrabold text-purple-500">
                <Lightbulb className="size-[clamp(0.85rem,2vmin,1.15rem)] shrink-0" aria-hidden="true" />
                السؤال — حرف {state.question.letter}
              </p>
              <p className="mt-1 text-fluid-md font-extrabold leading-snug">{state.question.q}</p>
              {state.question.a && state.phase === 'round_end' ? (
                <p className="mt-2 rounded-xl bg-emerald-100 px-3 py-2 text-fluid-sm font-black text-emerald-700">
                  الجواب: {state.question.a}
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-fluid-xs font-bold text-purple-300">
                  <Users className="size-[clamp(0.85rem,2vmin,1.15rem)] shrink-0" aria-hidden="true" />
                  الجواب عند المقدم فقط
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-purple-900/60 p-[clamp(0.75rem,2vmin,1.25rem)] text-center text-purple-200">
              <p className="text-fluid-xs font-bold">
                {state.phase === 'choosing'
                  ? 'الفريق يختار خلية حرف الآن...'
                  : 'تظهر الأسئلة هنا بعد اختيار الحرف'}
              </p>
            </div>
          )}

          {/* Turn indicator */}
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-purple-900/60 p-[clamp(0.55rem,1.5vmin,1rem)]">
            {(['A', 'B'] as LettersTeam[]).map(team => (
              <span
                key={team}
                className={`rounded-full border-2 px-[clamp(0.55rem,1.6vmin,1rem)] py-[clamp(0.3rem,0.9vmin,0.6rem)] text-fluid-xs font-extrabold transition-colors ${
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
          <div className="space-y-1.5 rounded-2xl bg-purple-900/60 p-[clamp(0.55rem,1.5vmin,1rem)] text-fluid-2xs font-bold text-purple-100">
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
