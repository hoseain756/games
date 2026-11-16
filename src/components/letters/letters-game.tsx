'use client'

import { Trophy, MonitorPlay, Sparkles, HelpCircle } from 'lucide-react'
import { useLettersSocket } from '@/hooks/use-letters-socket'
import { HostConsole } from '@/components/letters/host-console'
import { TeamScreen } from '@/components/letters/team-screen'
import { DisplayScreen } from '@/components/letters/display-screen'
import { ROLE_LABELS, type LettersRole } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Entry point of "حروف مع حسين" — routes the ?role= query to the matching
// screen. Unknown / missing roles get a chooser with big buttons.
// ---------------------------------------------------------------------------

const VALID_ROLES: LettersRole[] = ['host', 'teamA', 'teamB', 'display']

function parseRole(value: string | null | undefined): LettersRole | null {
  return value && VALID_ROLES.includes(value as LettersRole) ? (value as LettersRole) : null
}

function RoleChooser() {
  const roles: { role: LettersRole; label: string; hint: string; icon: typeof Trophy; classes: string }[] = [
    {
      role: 'host',
      label: 'المقدم',
      hint: 'يدير الجلسة ويفتح الدور ويحكم على الإجابات',
      icon: Sparkles,
      classes: 'bg-gradient-to-b from-purple-600 to-purple-800',
    },
    {
      role: 'teamA',
      label: 'الفريق الأول',
      hint: 'شاشة الفريق الأول مع الزر الضخم',
      icon: Trophy,
      classes: 'bg-gradient-to-b from-green-400 to-green-500 text-white',
    },
    {
      role: 'teamB',
      label: 'الفريق الثاني',
      hint: 'شاشة الفريق الثاني مع الزر الضخم',
      icon: Trophy,
      classes: 'bg-gradient-to-b from-orange-400 to-orange-500 text-orange-950',
    },
    {
      role: 'display',
      label: 'شاشة العرض',
      hint: 'تُعرض على التلفاز للجميع مع النتائج',
      icon: MonitorPlay,
      classes: 'bg-gradient-to-b from-purple-500 to-purple-700',
    },
  ]

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#fdf3e7] p-6"
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
    >
      <div className="text-center">
        <h1 className="text-[clamp(1.9rem,6vw,3rem)] font-black leading-[1.15] tracking-tight drop-shadow-[3px_3px_0_rgba(124,58,173,0.35)]">
          <span className="whitespace-nowrap">
            <span className="text-red-500">حروف</span> <span className="text-amber-500">مع حسين</span>
          </span>
        </h1>
        <p className="mt-2 text-sm font-bold text-purple-700 sm:text-base">فريقان، خلايا حروف، وأسرع زر يجيب!</p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        {roles.map(item => (
          <a
            key={item.role}
            href={`/?game=huruf&role=${item.role}`}
            className={`${item.classes} flex flex-col items-center gap-1 rounded-3xl p-[clamp(0.9rem,3vw,1.4rem)] text-center text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-95`}
          >
            <item.icon className="size-[clamp(1.6rem,5vw,2.1rem)]" aria-hidden="true" />
            <span className="text-[clamp(1.05rem,3.4vw,1.35rem)] font-black">{item.label}</span>
            <span className="text-[clamp(0.68rem,2.4vw,0.85rem)] font-bold opacity-90">{item.hint}</span>
          </a>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[clamp(0.68rem,2.4vw,0.85rem)] font-bold text-purple-400">
        <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
        كل شاشة لها رمز QR خاص يظهر عند المقدم
      </p>
    </div>
  )
}

function LettersScreen({ role }: { role: LettersRole }) {
  const { state, connected, remaining, act } = useLettersSocket(role)

  if (!state) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#fdf3e7] text-purple-700"
        style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      >
        <p className="animate-pulse text-lg font-extrabold sm:text-xl">
          {connected ? `جاري تحميل ${ROLE_LABELS[role]}...` : 'جاري الاتصال بالخادم...'}
        </p>
      </div>
    )
  }

  if (role === 'display') {
    return <DisplayScreen state={state} remaining={remaining} />
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
      onPick={letter => act('letters:pick', { letter })}
      onReady={() => act('letters:ready')}
      onBuzz={() => act('letters:buzz')}
    />
  )
}

export function LettersGame({ roleParam }: { roleParam: string | null }) {
  const role = parseRole(roleParam)
  if (!role) return <RoleChooser />
  return <LettersScreen role={role} />
}
