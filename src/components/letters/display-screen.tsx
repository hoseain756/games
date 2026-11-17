'use client'

import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  Flame,
  Hourglass,
  Lightbulb,
  Maximize,
  Minimize,
  MonitorPlay,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { HexBadge, HexGrid } from '@/components/letters/hex-grid'
import { HurufLogo } from '@/components/letters/huruf-logo'
import { TeamIcon } from '@/components/letters/team-icon'
import {
  areSoundsMuted,
  playSound,
  setSoundsMuted,
  unlockAudio,
} from '@/lib/letters-sounds'
import {
  DIFFICULTY_STYLES,
  TEAM_COLORS,
  TEAM_MISSIONS,
  teamIcon,
  teamLabel,
  type LettersPhase,
  type LettersState,
  type LettersTeam,
} from '@/lib/letters-types'
import { useAnimatedNumber } from '@/hooks/use-animated-number'

// ---------------------------------------------------------------------------
// Big audience screen (TV): the shuffled hexagon board + purple sidebar with
// the title, live scores, countdown ring, current question (without the
// answer until the round ends), live stats and win celebrations. Background
// mimics the orange/yellow diagonal design.
// ---------------------------------------------------------------------------

interface DisplayScreenProps {
  state: LettersState
  remaining: number | null
  /** False while the socket is reconnecting — shows a pulsing warning pill. */
  connected: boolean
}

/** Countdown-ring geometry (SVG viewBox 120x120, r=52). */
const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Confetti palette per winning team (matches the hexagon fill colors). */
const TEAM_CONFETTI: Record<LettersTeam, string[]> = {
  A: ['#22c55e', '#16a34a', '#bbf7d0'],
  B: ['#fb923c', '#ea580c', '#fed7aa'],
}

/** Minimal Screen Wake Lock API shape we rely on (typed, no `any`). */
interface WakeLockSentinelLike {
  release: () => Promise<void>
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

function phaseBanner(state: LettersState): { text: string; className: string } {
  const team = state.activeTeam ? teamLabel(state.teams, state.activeTeam) : ''
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
            text: `إجابة صحيحة! ${teamLabel(state.teams, state.result.team)} يفوز بالخلية (+1)`,
            className: 'bg-emerald-600 text-white',
          }
        : { text: 'انتهت الجولة — شوفوا الجواب الصحيح', className: 'bg-purple-800 text-white' }
    case 'game_over':
      return {
        text: `${teamLabel(state.teams, state.gameWinner ?? 'A')} وصّل شريطيه — يفوز باللعبة!`,
        className: 'bg-emerald-600 text-white animate-pulse',
      }
  }
}

export function DisplayScreen({ state, remaining, connected }: DisplayScreenProps) {
  const banner = phaseBanner(state)

  // Animated score counters — points visibly count up instead of jumping.
  const scoreA = useAnimatedNumber(state.scores.A)
  const scoreB = useAnimatedNumber(state.scores.B)

  // Floating fullscreen + mute controls (TV-friendly).
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [muted, setMuted] = useState(() => areSoundsMuted())

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      } else if (document.fullscreenEnabled) {
        void document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {
      // best-effort only — some TVs/embedded browsers lack fullscreen
    }
  }

  const toggleMuted = () => {
    const next = !muted
    setMuted(next)
    setSoundsMuted(next)
  }

  // Track fullscreen changes (Esc / TV remote can exit without our button).
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Keep the TV awake while this screen is mounted (Screen Wake Lock API).
  useEffect(() => {
    let sentinel: WakeLockSentinelLike | null = null
    const acquire = async () => {
      try {
        const wakeLock = (navigator as WakeLockNavigator).wakeLock
        if (!wakeLock) return
        sentinel = await wakeLock.request('screen')
      } catch {
        // silent — wake lock is a progressive enhancement
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      const held = sentinel
      sentinel = null
      if (held) {
        try {
          void held.release().catch(() => {})
        } catch {
          // silent
        }
      }
    }
  }, [])

  // Audio needs one user gesture before it can play (phones / smart TVs).
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Phase transitions: celebration confetti + phase jingles.
  const prevPhaseRef = useRef<LettersPhase | null>(null)
  const confettiTimersRef = useRef<number[]>([])

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = state.phase
    if (prev === null || prev === state.phase) return

    // Sounds on entering a phase.
    if (state.phase === 'choosing' || state.phase === 'open') {
      playSound('bell')
    } else if (state.phase === 'round_end') {
      playSound(state.result?.outcome === 'correct' ? 'correct' : 'wrong')
    } else if (state.phase === 'game_over') {
      playSound('fanfare')
    }

    // Confetti on wins.
    if (state.phase === 'round_end' && state.result?.outcome === 'correct' && state.result.team) {
      const colors = TEAM_CONFETTI[state.result.team]
      void confetti({ particleCount: 80, spread: 70, gravity: 0.9, origin: { x: 0, y: 1 }, colors })
      void confetti({ particleCount: 80, spread: 70, gravity: 0.9, origin: { x: 1, y: 1 }, colors })
    }
    if (state.phase === 'game_over') {
      const colors = TEAM_CONFETTI[state.gameWinner ?? 'A']
      void confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, colors })
      confettiTimersRef.current.push(
        window.setTimeout(() => {
          void confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 }, colors })
        }, 250),
      )
      confettiTimersRef.current.push(
        window.setTimeout(() => {
          void confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 }, colors })
        }, 250),
      )
    }
  }, [state.phase, state.result, state.gameWinner])

  // Clear any pending confetti bursts on unmount.
  useEffect(() => {
    const timers = confettiTimersRef.current
    return () => {
      for (const id of timers) window.clearTimeout(id)
      timers.length = 0
    }
  }, [])

  // Countdown ticks for the final five seconds.
  const lastTickRef = useRef<number | null>(null)
  useEffect(() => {
    if (remaining === null || remaining < 1 || remaining > 5) {
      lastTickRef.current = null
      return
    }
    if (lastTickRef.current !== remaining) {
      lastTickRef.current = remaining
      playSound('tick')
    }
  }, [remaining])

  // Countdown-ring math — the choosing window uses its own duration.
  const totalSeconds = state.phase === 'choosing' ? state.chooseTime : state.answerTime
  const timerRatio =
    remaining !== null ? Math.max(0, Math.min(1, remaining / Math.max(totalSeconds, 1))) : 0
  const timeDanger = remaining !== null && remaining <= 5

  // Live stats strip (fastest buzz + streaks); renders nothing without data.
  const statChip =
    'flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-fluid-2xs font-bold text-amber-100'
  const streakTeams = (['A', 'B'] as LettersTeam[]).filter(team => state.streaks[team] >= 2)
  const showStats = state.fastest !== null || streakTeams.length > 0

  return (
    <div
      className="flex min-h-screen flex-col text-purple-950 lg:h-screen lg:overflow-hidden"
      style={{
        fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif',
        background: 'linear-gradient(160deg, #fdf3e7 0%, #faebd3 55%, #f7e3c4 100%)',
      }}
    >
      {/* Top bar — logo anchors the RTL start (right), status pills + controls at the end */}
      <header className="flex flex-wrap items-center justify-between gap-[clamp(0.4rem,1.5vmin,0.85rem)] px-fluid pt-[clamp(0.5rem,1.6vmin,1.25rem)]">
        <h1 className="leading-none">
          <HurufLogo className="h-[clamp(4.25rem,12vmin,7rem)] w-auto" />
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-[clamp(0.3rem,1vmin,0.6rem)] whitespace-nowrap rounded-full bg-purple-800 px-fluid py-fluid-sm text-fluid-sm font-extrabold text-white shadow-lg">
            <MonitorPlay className="size-[clamp(0.95rem,2.4vmin,1.4rem)]" aria-hidden="true" />
            شاشة العرض
          </span>
          {!connected && (
            <span
              role="status"
              aria-live="polite"
              className="animate-pulse whitespace-nowrap rounded-full bg-amber-400 px-[clamp(0.55rem,1.6vmin,1rem)] py-[clamp(0.3rem,0.9vmin,0.6rem)] text-fluid-xs font-extrabold text-purple-950 shadow-lg"
            >
              انقطع الاتصال — جارٍ إعادة الاتصال...
            </span>
          )}
          <span className="hidden whitespace-nowrap rounded-full bg-purple-100 px-3 py-1.5 text-fluid-xs font-bold text-purple-800 sm:inline">
            الجولة {Math.max(state.roundNumber, 1)}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            className="flex size-[clamp(2rem,5vmin,2.75rem)] items-center justify-center rounded-full bg-white text-purple-800 shadow-lg transition hover:bg-purple-100 active:scale-95"
          >
            {isFullscreen ? (
              <Minimize className="size-[clamp(1rem,2.6vmin,1.4rem)]" aria-hidden="true" />
            ) : (
              <Maximize className="size-[clamp(1rem,2.6vmin,1.4rem)]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            aria-pressed={muted}
            className="flex size-[clamp(2rem,5vmin,2.75rem)] items-center justify-center rounded-full bg-white text-purple-800 shadow-lg transition hover:bg-purple-100 active:scale-95"
          >
            {muted ? (
              <VolumeX className="size-[clamp(1rem,2.6vmin,1.4rem)]" aria-hidden="true" />
            ) : (
              <Volume2 className="size-[clamp(1rem,2.6vmin,1.4rem)]" aria-hidden="true" />
            )}
          </button>
        </div>
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

      {/* Main: sidebar (RTL start, right) + board */}
      <main className="flex min-h-0 flex-1 flex-col items-stretch gap-fluid overflow-hidden p-[clamp(0.6rem,2vmin,1.25rem)] lg:flex-row-reverse">
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
        <aside className="scrollbar-none flex w-full min-w-0 flex-col gap-fluid rounded-[2rem] bg-purple-800 p-[clamp(0.8rem,2.4vmin,1.5rem)] shadow-2xl lg:max-h-full lg:w-[clamp(300px,36vmin,460px)] lg:shrink-0 lg:overflow-y-auto">
          {/* Scores */}
          <div className="flex items-center justify-around gap-3">
            {(['A', 'B'] as LettersTeam[]).map(team => (
              <div key={team} className="flex flex-col items-center gap-1">
                <HexBadge
                  fill={TEAM_COLORS[team].fill}
                  label={String(team === 'A' ? scoreA : scoreB)}
                  className="size-[clamp(3.25rem,10vmin,5rem)] drop-shadow-md"
                />
                <span className="flex items-center gap-1 text-fluid-xs font-bold text-amber-200">
                  <TeamIcon
                    icon={teamIcon(state.teams, team)}
                    className="size-[clamp(0.85rem,1.9vmin,1.15rem)]"
                  />
                  {teamLabel(state.teams, team)}
                </span>
              </div>
            ))}
          </div>

          {/* Timer */}
          {state.phase === 'game_over' ? (
            <div className="rounded-2xl bg-emerald-600 p-[clamp(0.75rem,2vmin,1.25rem)] text-center shadow-lg">
              <Trophy className="mx-auto size-[clamp(1.75rem,5vmin,2.75rem)] text-amber-300" aria-hidden="true" />
              <p className="mt-1 text-fluid-lg font-black">
                {teamLabel(state.teams, state.gameWinner ?? 'A')} فاز!
              </p>
            </div>
          ) : remaining !== null ? (
            <div className="rounded-2xl bg-purple-900/60 p-[clamp(0.75rem,2vmin,1.25rem)] text-center">
              <p className="flex items-center justify-center gap-2 text-fluid-xs font-bold text-purple-200">
                <Hourglass className="size-[clamp(0.85rem,2vmin,1.15rem)]" aria-hidden="true" />
                الوقت المتبقي
              </p>
              <div className="relative mx-auto mt-1 size-[clamp(6.25rem,17vmin,8.5rem)]">
                <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
                  <circle
                    cx="60"
                    cy="60"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="#581c87"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={RING_RADIUS}
                    fill="none"
                    stroke={timeDanger ? '#f87171' : '#fcd34d'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - timerRatio)}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 300ms linear' }}
                  />
                </svg>
                <p
                  className={`absolute inset-0 flex items-center justify-center text-[clamp(2rem,7vmin,3.5rem)] font-black tabular-nums ${
                    timeDanger ? 'animate-pulse text-red-400' : 'text-amber-200'
                  }`}
                >
                  {remaining}
                </p>
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
              <div className="flex flex-wrap items-center gap-[clamp(0.35rem,1vmin,0.6rem)]">
                <p className="flex items-center gap-2 text-fluid-xs font-extrabold text-purple-500">
                  <Lightbulb className="size-[clamp(0.85rem,2vmin,1.15rem)] shrink-0" aria-hidden="true" />
                  السؤال — حرف {state.question.letter}
                </p>
                {state.question.category && (
                  <span className="rounded-full bg-purple-100 px-[clamp(0.4rem,1.2vmin,0.7rem)] py-[clamp(0.1rem,0.4vmin,0.25rem)] text-fluid-2xs font-extrabold text-purple-700">
                    {state.question.category}
                  </span>
                )}
                {state.question.difficulty && (
                  <span
                    className={`rounded-full border px-[clamp(0.4rem,1.2vmin,0.7rem)] py-[clamp(0.1rem,0.4vmin,0.25rem)] text-fluid-2xs font-extrabold ${
                      DIFFICULTY_STYLES[state.question.difficulty] ?? 'bg-purple-100 text-purple-700 border-purple-300'
                    }`}
                  >
                    {state.question.difficulty}
                  </span>
                )}
              </div>
              <p className="mt-1 text-fluid-md font-extrabold leading-relaxed">{state.question.q}</p>
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
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 px-[clamp(0.55rem,1.6vmin,1rem)] py-[clamp(0.3rem,0.9vmin,0.6rem)] text-fluid-xs font-extrabold tabular-nums transition-colors ${
                  state.activeTeam === team
                    ? 'border-amber-300 bg-amber-300 text-purple-900'
                    : 'border-purple-600 text-purple-300'
                }`}
              >
                <TeamIcon
                  icon={teamIcon(state.teams, team)}
                  className="size-[clamp(0.85rem,1.9vmin,1.15rem)] shrink-0"
                />
                {teamLabel(state.teams, team)} {state.scores[team]}
              </span>
            ))}
          </div>

          {/* Live stats: fastest buzz + active streaks */}
          {showStats && (
            <div className="flex flex-wrap items-center justify-center gap-[clamp(0.3rem,0.9vmin,0.55rem)]">
              {state.fastest && (
                <span className={statChip}>
                  <Zap className="size-[clamp(0.8rem,1.8vmin,1.05rem)] shrink-0 text-amber-300" aria-hidden="true" />
                  أسرع إجابة: {state.fastest.seconds}ث — {teamLabel(state.teams, state.fastest.team)}
                </span>
              )}
              {streakTeams.map(team => (
                <span key={team} className={statChip}>
                  <Flame className="size-[clamp(0.8rem,1.8vmin,1.05rem)] shrink-0 text-orange-400" aria-hidden="true" />
                  سلسلة {teamLabel(state.teams, team)}: {state.streaks[team]} متتالية
                </span>
              ))}
            </div>
          )}

          {/* Board legend: which bands belong to which team */}
          <div className="space-y-1.5 rounded-2xl bg-purple-900/60 p-[clamp(0.55rem,1.5vmin,1rem)] text-fluid-2xs font-bold text-purple-100">
            <p className="flex items-start gap-2">
              <span className="mt-[0.3em] inline-block size-3 shrink-0 rounded-sm bg-green-500" aria-hidden="true" />
              {teamLabel(state.teams, 'A')}: {TEAM_MISSIONS.A}
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-[0.3em] inline-block size-3 shrink-0 rounded-sm bg-orange-400" aria-hidden="true" />
              {teamLabel(state.teams, 'B')}: {TEAM_MISSIONS.B}
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
