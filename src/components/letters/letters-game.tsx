'use client'

import { useEffect, useState } from 'react'
import { HelpCircle, Lock, MonitorPlay, RefreshCw, Sparkles, TriangleAlert, Trophy } from 'lucide-react'
import { useLettersSocket } from '@/hooks/use-letters-socket'
import { HostConsole } from '@/components/letters/host-console'
import { TeamScreen } from '@/components/letters/team-screen'
import { DisplayScreen } from '@/components/letters/display-screen'
import { CandyButton, candyClasses, type CandyVariant } from '@/components/letters/candy-button'
import { ROLE_LABELS, type LettersRole } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Entry point of "حروف مع حسين" — routes the ?role= query to the matching
// screen. Unknown / missing roles get a chooser with big buttons.
// Sessions can be locked by the host: team roles then need the join code.
// ---------------------------------------------------------------------------

const VALID_ROLES: LettersRole[] = ['host', 'teamA', 'teamB', 'display']

function parseRole(value: string | null | undefined): LettersRole | null {
  return value && VALID_ROLES.includes(value as LettersRole) ? (value as LettersRole) : null
}

function RoleChooser() {
  const roles: { role: LettersRole; label: string; hint: string; icon: typeof Trophy; variant: CandyVariant }[] = [
    {
      role: 'host',
      label: 'المقدم',
      hint: 'يدير الجلسة ويفتح الدور ويحكم على الإجابات',
      icon: Sparkles,
      variant: 'purple',
    },
    {
      role: 'teamA',
      label: 'الفريق الأول',
      hint: 'شاشة الفريق الأول مع الزر الضخم',
      icon: Trophy,
      variant: 'green',
    },
    {
      role: 'teamB',
      label: 'الفريق الثاني',
      hint: 'شاشة الفريق الثاني مع الزر الضخم',
      icon: Trophy,
      variant: 'orange',
    },
    {
      role: 'display',
      label: 'شاشة العرض',
      hint: 'تُعرض على التلفاز للجميع مع النتائج',
      icon: MonitorPlay,
      variant: 'cyan',
    },
  ]

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#fdf3e7] p-6"
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
    >
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight drop-shadow-[3px_3px_0_rgba(124,58,173,0.35)]">
          <span className="whitespace-nowrap">
            <span className="text-red-500">حروف</span> <span className="text-amber-500">مع حسين</span>
          </span>
        </h1>
        <p className="mt-2 font-bold text-purple-700">فريقان، خلايا حروف، وأسرع زر يجيب!</p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        {roles.map(item => (
          <a
            key={item.role}
            href={`/?game=huruf&role=${item.role}`}
            className={candyClasses(item.variant, 'md', 4, "h-auto flex-col gap-1 rounded-3xl p-5 text-center [&_svg:not([class*='size-'])]:size-8")}
          >
            <item.icon aria-hidden="true" />
            <span className="text-lg font-black">{item.label}</span>
            <span className="text-xs font-bold opacity-90">{item.hint}</span>
          </a>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
        <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
        كل شاشة لها رمز QR خاص يظهر عند المقدم
      </p>
    </div>
  )
}

/** Shown when the session is locked and the team has no (or a wrong) code. */
function JoinCodeGate({
  wrongAttempt,
  onSubmit,
}: {
  wrongAttempt: boolean
  onSubmit: (code: string) => void
}) {
  const [value, setValue] = useState('')

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fdf3e7] p-6 text-center text-purple-800"
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
    >
      <span className="grid size-16 place-items-center rounded-full bg-purple-100 text-purple-600">
        <Lock className="size-8" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-black">الجلسة مقفلة برمز دخول</h1>
        <p className="mt-1 text-sm font-bold text-purple-500">
          اطلب رمز الجلسة الرباعي من المقدم ثم أدخله للمتابعة
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <input
          value={value}
          onChange={event => setValue(event.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={event => {
            if (event.key === 'Enter' && value.length === 4) onSubmit(value)
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          dir="ltr"
          aria-label="رمز الجلسة"
          placeholder="----"
          className="h-16 rounded-2xl border-2 border-purple-300 bg-white text-center text-3xl font-black tracking-[0.5em] text-purple-800 outline-none focus:border-purple-500"
        />
        {wrongAttempt && (
          <p role="alert" className="text-sm font-extrabold text-red-600">
            الرمز غير صحيح — تأكد منه مع المقدم وحاول مجدداً
          </p>
        )}
        <CandyButton
          variant="purple"
          size="lg"
          className="h-14"
          disabled={value.length !== 4}
          onClick={() => onSubmit(value)}
        >
          دخول الجلسة
        </CandyButton>
      </div>
    </div>
  )
}

function LettersScreen({ role, initialCode }: { role: LettersRole; initialCode: string | null }) {
  const [code, setCode] = useState(initialCode ?? '')
  const [triedCode, setTriedCode] = useState(false)
  const { state, connected, denied, remaining, act } = useLettersSocket(role, code || undefined)

  // Watchdog: never leave a phone hanging on the spinner forever. After 12s
  // without game state we surface a clear error + retry, while the socket
  // keeps retrying in the background — if the server comes back the game
  // replaces this card automatically (no reload needed). One-way latch: the
  // render gate `stuck && !state` hides it again as soon as state arrives.
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (state) return
    const timer = window.setTimeout(() => setStuck(true), 12000)
    return () => window.clearTimeout(timer)
  }, [state, connected])

  if (denied) {
    return <JoinCodeGate wrongAttempt={triedCode} onSubmit={next => { setTriedCode(true); setCode(next) }} />
  }

  if (!state) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fdf3e7] p-6 text-center text-purple-700"
        style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      >
        {stuck ? (
          <>
            <span className="grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600">
              <TriangleAlert className="size-8" aria-hidden="true" />
            </span>
            <p className="text-xl font-black text-purple-800">
              ما قدرنا نوصل للخادم
            </p>
            <p className="max-w-xs text-sm font-bold text-purple-500">
              {connected
                ? 'الاتصال تم لكن ما وصلتنا بيانات اللعبة — تأكدوا من الشبكة وجربوا مرة ثانية.'
                : 'تأكدوا من اتصال الجوال بالشبكة، أو أن الخادم يعاد تشغيله الآن.'}
            </p>
            <CandyButton
              variant="purple"
              size="lg"
              className="h-12 text-base"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="size-5" aria-hidden="true" />
              إعادة المحاولة
            </CandyButton>
            <p className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
              <span className="inline-block size-2 animate-pulse rounded-full bg-purple-400" aria-hidden="true" />
              ما زلنا نحاول الاتصال تلقائياً...
            </p>
          </>
        ) : (
          <p className="animate-pulse text-xl font-extrabold">
            {connected ? `جاري تحميل ${ROLE_LABELS[role]}...` : 'جاري الاتصال بالخادم...'}
          </p>
        )}
      </div>
    )
  }

  if (role === 'display') {
    return <DisplayScreen state={state} remaining={remaining} connected={connected} />
  }

  if (role === 'host') {
    return (
      <div
        className="flex min-h-screen flex-col bg-[#fdf3e7] px-4 py-5"
        style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      >
        <HostConsole state={state} connected={connected} remaining={remaining} act={act} />
      </div>
    )
  }

  const team = role === 'teamA' ? 'A' : 'B'
  return (
    <TeamScreen
      state={state}
      team={team}
      remaining={remaining}
      connected={connected}
      onPick={letter => act('letters:pick', { letter })}
      onReady={() => act('letters:ready')}
      onBuzz={() => act('letters:buzz')}
    />
  )
}

export function LettersGame({ roleParam, codeParam }: { roleParam: string | null; codeParam?: string | null }) {
  const role = parseRole(roleParam)
  if (!role) return <RoleChooser />
  return <LettersScreen role={role} initialCode={codeParam ?? null} />
}
