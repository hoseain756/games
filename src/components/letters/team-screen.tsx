'use client'

import { useMemo } from 'react'
import {
  Bell,
  CheckCircle2,
  Hourglass,
  Lock,
  MoveHorizontal,
  MoveVertical,
  PencilLine,
  Volume2,
  Trophy,
  Zap,
} from 'lucide-react'
import { HexBadge, HexGrid } from '@/components/letters/hex-grid'
import { HurufLogo } from '@/components/letters/huruf-logo'
import {
  ARABIC_LETTERS,
  TEAM_COLORS,
  TEAM_LABELS,
  TEAM_MISSIONS,
  type LettersState,
  type LettersTeam,
} from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Team screen (phone): huge buzzer button, letter picker on the team's turn,
// the question WITHOUT the answer, and the live timer.
// ---------------------------------------------------------------------------

interface TeamScreenProps {
  state: LettersState
  team: LettersTeam
  remaining: number | null
  onPick: (letter: string) => void
  onReady: () => void
  onBuzz: () => void
}

function TimerPill({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-2xl font-black tabular-nums shadow ${
        remaining <= 5 ? 'animate-pulse bg-red-600 text-white' : 'bg-purple-800 text-amber-200'
      }`}
      role="timer"
      aria-label={`الوقت المتبقي ${remaining} ثانية`}
    >
      <Hourglass className="size-5" aria-hidden="true" />
      {remaining}
    </span>
  )
}

export function TeamScreen({ state, team, remaining, onPick, onReady, onBuzz }: TeamScreenProps) {
  const isMyTurn = state.activeTeam === team
  const otherTeam: LettersTeam = team === 'A' ? 'B' : 'A'
  const color = TEAM_COLORS[team]

  const selectable = useMemo(() => {
    if (state.phase !== 'choosing' || !isMyTurn) return null
    return new Set(state.layout.filter(letter => !state.claimed[letter]))
  }, [state.phase, state.layout, state.claimed, isMyTurn])

  const showQuestion =
    state.question !== null && ['team_turn', 'open', 'buzz_answer'].includes(state.phase)

  // ---- Huge button state machine ------------------------------------------
  let button: {
    label: string
    icon: typeof Zap
    enabled: boolean
    classes: string
    action?: () => void
  }

  if (state.phase === 'open') {
    button = {
      label: 'اضغط بسرعة!!',
      icon: Zap,
      enabled: true,
      classes: 'bg-gradient-to-b from-red-500 to-red-700 border-red-800 shadow-[0_10px_0_#7f1d1d] animate-pulse',
      action: onBuzz,
    }
  } else if (state.phase === 'team_turn' && isMyTurn) {
    button = state.locked
      ? {
          label: 'ثبّتوا الجواب! جاوبوا بصوت عالي',
          icon: CheckCircle2,
          enabled: false,
          classes: 'bg-emerald-600 border-emerald-800 shadow-[0_10px_0_#065f46]',
        }
      : {
          label: 'عرفنا الجواب!',
          icon: CheckCircle2,
          enabled: true,
          classes: `${team === 'A' ? 'bg-gradient-to-b from-green-400 to-green-500 border-green-600 shadow-[0_10px_0_#276b12]' : 'bg-gradient-to-b from-orange-400 to-orange-500 border-orange-600 shadow-[0_10px_0_#c2410c]'} animate-pulse`,
          action: onReady,
        }
  } else if (state.phase === 'buzz_answer' && isMyTurn) {
    button = {
      label: 'جاوبوا الآن بصوت عالٍ!',
      icon: Bell,
      enabled: false,
      classes: 'bg-emerald-600 border-emerald-800 shadow-[0_10px_0_#065f46]',
    }
  } else if (state.phase === 'buzz_answer') {
    button = {
      label: `${TEAM_LABELS[otherTeam]} سبقكم للضغط!`,
      icon: Lock,
      enabled: false,
      classes: 'bg-purple-300 border-purple-400 shadow-[0_10px_0_#6b21a8]',
    }
  } else if (state.phase === 'game_over') {
    button = {
      label: 'انتهت اللعبة',
      icon: Trophy,
      enabled: false,
      classes: 'bg-purple-300 border-purple-400 shadow-[0_10px_0_#6b21a8]',
    }
  } else if (state.phase === 'choosing') {
    button = isMyTurn
      ? {
          label: 'اختاروا خلية حرف من اللوحة',
          icon: PencilLine,
          enabled: false,
          classes: 'bg-gradient-to-b from-purple-500 to-purple-700 border-purple-800 shadow-[0_10px_0_#4c1d95]',
        }
      : {
          label: 'الدور على الفريق الآخر',
          icon: Lock,
          enabled: false,
          classes: 'bg-purple-300 border-purple-400 shadow-[0_10px_0_#6b21a8]',
        }
  } else {
    button = {
      label: 'استعدوا... بانتظار المقدم',
      icon: Lock,
      enabled: false,
      classes: 'bg-purple-300 border-purple-400 shadow-[0_10px_0_#6b21a8]',
    }
  }

  const ButtonIcon = button.icon

  const statusText = (() => {
    switch (state.phase) {
      case 'lobby':
        return 'بانتظار المقدم لبدء الجلسة...'
      case 'idle':
        return state.lastEvent ?? 'استعدوا!'
      case 'choosing':
        return isMyTurn ? 'دوركم! اختاروا حرفاً بسرعة' : `${TEAM_LABELS[state.activeTeam ?? 'A']} يختار حرفاً...`
      case 'team_turn':
        return isMyTurn ? 'دوركم — ناقشوا وجاوبوا!' : `دور ${TEAM_LABELS[state.activeTeam ?? 'A']} — استعدوا للسرقة!`
      case 'open':
        return 'انفتحت الأزرار! أول من يضغط يجاوب'
      case 'buzz_answer':
        return isMyTurn ? 'سبقتم الجميع — جاوبوا الآن!' : `${TEAM_LABELS[otherTeam]} يجيب الآن...`
      case 'round_end':
        return state.result?.outcome === 'correct'
          ? `${state.result.team === team ? 'أحسنتم! كسبتوا الخلية' : `${TEAM_LABELS[state.result.team ?? 'A']} كسب الخلية`}`
          : 'انتهت الجولة دون إجابة'
      case 'game_over':
        return state.gameWinner === team
          ? 'فزتم! وصّلتم شريط فريقكم — مبروك!'
          : `${TEAM_LABELS[state.gameWinner ?? 'A']} وصّل شريطه وفاز باللعبة`
    }
  })()

  return (
    <div
      className="flex min-h-screen flex-col bg-[#fdf3e7] text-purple-950"
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <div
          className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 font-extrabold ${color.chip}`}
        >
          <HexBadge
            fill={color.fill}
            label={String(state.scores[team])}
            className="size-8"
            fontSize={40}
          />
          <span>{TEAM_LABELS[team]}</span>
        </div>
        <HurufLogo className="h-12 w-auto" />
      </header>

      {/* Team mission on the connection board */}
      <div className="mt-2 flex justify-center px-4">
        <p
          className={`flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-1 text-center text-xs font-extrabold ${color.chip}`}
          role="note"
        >
          {team === 'A' ? (
            <MoveVertical className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <MoveHorizontal className="size-4 shrink-0" aria-hidden="true" />
          )}
          مهمتكم: {TEAM_MISSIONS[team]}
        </p>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-44 pt-3">
        {/* Status + timer */}
        <section className="flex items-center justify-between gap-2">
          <p className="text-base font-extrabold leading-snug" role="status">
            {statusText}
          </p>
          <TimerPill remaining={remaining} />
        </section>

        {/* Letter picking phase */}
        {state.phase === 'choosing' && (
          <section className="rounded-3xl border-4 border-purple-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-center text-sm font-extrabold text-purple-500">
              {isMyTurn ? 'اضغطوا على خلية الحرف المطلوب' : 'اللوحة مقفلة — الدور على الفريق الآخر'}
            </p>
            <HexGrid
              layout={state.layout}
              claimed={state.claimed}
              selectable={selectable}
              onPick={onPick}
              className="h-auto w-full"
            />
            {/* All 28 letters — off-board letters give a +1 bonus (no cell). */}
            <p className="mt-3 mb-1.5 text-center text-xs font-extrabold text-purple-400">
              كل الحروف الـ28 — المخططة خارج اللوحة (بونص +1)
            </p>
            <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="كل حروف العربية">
              {ARABIC_LETTERS.map(letter => {
                const onBoard = state.layout.includes(letter)
                const owner = state.claimed[letter]
                const pickable = isMyTurn && !owner
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!pickable}
                    onClick={() => onPick(letter)}
                    aria-label={onBoard ? `اختر حرف ${letter}` : `بونص — اختر حرف ${letter}`}
                    className={`flex size-9 items-center justify-center rounded-xl border-2 text-lg font-black transition-transform disabled:cursor-not-allowed ${
                      owner
                        ? `${owner === 'A' ? 'border-green-600 bg-green-500 text-white' : 'border-orange-600 bg-orange-400 text-white'}`
                        : onBoard
                          ? `border-purple-300 bg-purple-50 text-purple-800 ${pickable ? 'active:scale-90 hover:border-purple-500 hover:bg-purple-100' : 'opacity-50'}`
                          : `border-dashed border-purple-300 bg-white text-purple-500 ${pickable ? 'active:scale-90 hover:border-amber-400 hover:bg-amber-50' : 'opacity-40'}`
                    }`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Question (without the answer!) */}
        {showQuestion && state.question && (
          <section className="rounded-3xl border-4 border-purple-200 bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-extrabold text-purple-600">
                سؤال حرف {state.question.letter}
              </span>
              {state.activeLetter && (
                <HexBadge
                  fill={color.fill}
                  label={state.activeLetter}
                  className="size-10"
                  fontSize={36}
                />
              )}
            </div>
            <p className="text-2xl font-extrabold leading-relaxed">{state.question.q}</p>

            {/* Voice-answer guidance — no typing: discuss, lock, say it out loud */}
            {state.phase === 'team_turn' && (
              <p
                className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-sm font-extrabold ${
                  state.locked ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-50 text-purple-600'
                }`}
                role="note"
              >
                <Volume2 className="size-4 shrink-0" aria-hidden="true" />
                {state.locked
                  ? 'ثبّتتم! جاوبوا بصوت عالٍ — المقدم يحكم الآن'
                  : isMyTurn
                    ? 'ناقشوا ثم اضغطوا «عرفنا الجواب!» وجاوبوا بصوت عالٍ'
                    : 'استمعوا للسؤال واستعدوا للسرقة!'}
              </p>
            )}
            {state.phase === 'buzz_answer' && (
              <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-center text-sm font-extrabold text-emerald-700" role="note">
                <Volume2 className="size-4 shrink-0" aria-hidden="true" />
                {isMyTurn ? 'سبقتم الجميع — جاوبوا بصوت عالٍ الآن!' : 'الفريق الآخر يجيب بصوت عالٍ...'}
              </p>
            )}

            {state.phase === 'round_end' && state.question.a ? (
              <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-lg font-black text-emerald-700">
                الجواب: {state.question.a}
              </p>
            ) : null}
          </section>
        )}

        {/* Round result */}
        {state.phase === 'round_end' && state.result && (
          <section
            className={`rounded-3xl border-4 p-4 text-center shadow-lg ${
              state.result.outcome === 'correct' ? 'border-emerald-300 bg-emerald-50' : 'border-purple-200 bg-white'
            }`}
          >
            <p className="text-lg font-black">
              {state.result.outcome === 'correct'
                ? `${TEAM_LABELS[state.result.team ?? 'A']} أجاب صح — +1!`
                : 'لا أحد أجاب صح هذه الجولة'}
            </p>
            {state.result.answer && (
              <p className="mt-1 text-base font-bold text-purple-500">الجواب: {state.result.answer}</p>
            )}
            <p className="mt-2 text-sm font-bold text-purple-400">بانتظار المقدم لفتح الجولة التالية</p>
          </section>
        )}

        {/* Game over celebration */}
        {state.phase === 'game_over' && (
          <section
            className={`rounded-3xl border-4 p-5 text-center shadow-lg ${
              state.gameWinner === team
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-purple-200 bg-white'
            }`}
          >
            <Trophy
              className={`mx-auto size-12 ${state.gameWinner === team ? 'text-amber-500' : 'text-purple-300'}`}
              aria-hidden="true"
            />
            <p className="mt-2 text-xl font-black">
              {state.gameWinner === team ? 'فزتم باللعبة!' : `${TEAM_LABELS[state.gameWinner ?? 'A']} فاز باللعبة`}
            </p>
            <p className="mt-1 text-sm font-bold text-purple-500">
              {state.gameWinner === team ? 'وصّلتم شريط فريقكم بالخلايا' : 'وصّل شريطه قبلكم — حظاً أوفر المرة القادمة'}
            </p>
            {state.result?.answer && (
              <p className="mt-2 rounded-xl bg-purple-50 px-3 py-2 text-sm font-extrabold text-purple-700">
                آخر جواب: {state.result.answer}
              </p>
            )}
            <p className="mt-2 text-sm font-bold text-purple-400">المقدم يفتح لعبة جديدة</p>
          </section>
        )}
      </main>

      {/* Huge buzzer — pinned to the bottom */}
      <div className="fixed inset-x-0 bottom-0 border-t-4 border-purple-100 bg-[#fdf3e7]/95 p-4 backdrop-blur"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            disabled={!button.enabled}
            onClick={button.action}
            className={`flex h-32 w-full items-center justify-center gap-3 rounded-[2.5rem] border-4 text-2xl font-black text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 sm:h-36 ${button.classes}`}
          >
            <ButtonIcon className="size-10 shrink-0" aria-hidden="true" />
            {button.label}
          </button>
        </div>
      </div>
    </div>
  )
}
