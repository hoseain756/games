'use client'

import Link from 'next/link'
import {
  Camera,
  ChevronLeft,
  Hexagon,
  Images,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react'
import { AppFooter } from '@/components/game/app-footer'
import { HurufLogo } from '@/components/letters/huruf-logo'

// ---------------------------------------------------------------------------
// Home menu: lists every game. The first game (selfie QR questions) and the
// new "حروف مع حسين" hexagon letters game.
// ---------------------------------------------------------------------------

interface GameCard {
  href: string
  title: string
  subtitle: string
  description: string
  icon: typeof Camera
  badge: string
  classes: string
  chipClasses: string
  /** Render the retro lettering logo instead of the plain text title. */
  logo?: boolean
}

const GAMES: GameCard[] = [
  {
    href: '/?game=photo',
    title: 'لعبة الصور والأسئلة',
    subtitle: 'اللعبة الأولى',
    description:
      'كل لاعب يصور نفسه ويدخل اسمه عبر QR، ويظهر السؤال على جوال صاحب الدور أثناء اللعب.',
    icon: Camera,
    badge: 'QR + سيلفي',
    classes: 'from-amber-400 to-orange-500',
    chipClasses: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  {
    href: '/?game=huruf',
    title: 'حروف مع حسين',
    subtitle: 'اللعبة الجديدة',
    description:
      'فريقان وخلايا سداسية بحروف عشوائية: جاوب بسرعة لتلوين الخلايا، أول فريق يوصل شريطه يفوز — والزر الضخم لأسرع فريق!',
    icon: Hexagon,
    badge: 'فريقان + زر ضخم',
    classes: 'from-purple-500 to-purple-800',
    chipClasses: 'bg-purple-100 text-purple-700 border-purple-200',
    logo: true,
  },
]

export function AppHome() {
  return (
    <div
      className="flex min-h-screen flex-col bg-[linear-gradient(160deg,#fdf3e7_0%,#fbe8d3_55%,#f7e0c4_100%)]"
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
    >
      {/* Hero */}
      <header className="px-4 pt-10 text-center">
        <span className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border-2 border-purple-200 bg-white px-4 py-1.5 text-sm font-extrabold text-purple-700 shadow-sm">
          <Sparkles className="size-4 text-amber-500" aria-hidden="true" />
          منصة ألعاب جماعية عبر الجوالات
        </span>
        <h1 className="text-4xl font-black tracking-tight text-purple-950 drop-shadow-[3px_3px_0_rgba(251,191,36,0.55)] sm:text-5xl">
          اختاروا لعبتكم
        </h1>
        <p className="mx-auto mt-3 max-w-md font-bold text-purple-700/80">
          لعبتان جماعيتان: مسحوا رمز QR، افتحوا الشاشات، وابدؤوا التنافس!
        </p>
      </header>

      {/* Game cards */}
      <main className="mx-auto grid w-full max-w-3xl flex-1 grid-cols-1 gap-5 px-4 py-10 sm:grid-cols-2">
        {GAMES.map(game => (
          <Link
            key={game.href}
            href={game.href}
            className="group flex flex-col rounded-[2rem] border-4 border-white bg-white/70 p-5 shadow-[0_10px_30px_rgba(124,58,173,0.12)] backdrop-blur transition-all hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(124,58,173,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div
              className={`mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-lg ${game.classes}`}
            >
              <game.icon className="size-8" aria-hidden="true" />
            </div>
            <span
              className={`mb-2 w-fit rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${game.chipClasses}`}
            >
              {game.badge}
            </span>
            {game.logo ? (
              <HurufLogo className="mt-1 h-28 w-auto" />
            ) : (
              <h2 className="text-2xl font-black text-purple-950">{game.title}</h2>
            )}
            <p className="mt-1 text-sm font-bold text-purple-500">{game.subtitle}</p>
            <p className="mt-3 flex-1 text-sm font-bold leading-relaxed text-purple-900/75">
              {game.description}
            </p>
            <span className="mt-4 flex items-center gap-1 text-sm font-black text-purple-700">
              ابدأ اللعب
              <ChevronLeft className="size-5 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </main>

      {/* Quick how-to */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-6">
        <div className="grid grid-cols-1 gap-3 rounded-3xl border-2 border-purple-100 bg-white/60 p-5 text-sm font-bold text-purple-900/80 backdrop-blur sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <Users className="size-5 shrink-0 text-purple-500" aria-hidden="true" />
            فريقان أو لاعبون كثر حسب اللعبة
          </p>
          <p className="flex items-center gap-2">
            <Images className="size-5 shrink-0 text-purple-500" aria-hidden="true" />
            شاشة عرض كبيرة للجميع مع النتائج
          </p>
          <p className="flex items-center gap-2">
            <Timer className="size-5 shrink-0 text-purple-500" aria-hidden="true" />
            مؤقّتات مضبوطة مسبقاً من المقدم
          </p>
        </div>
      </section>

      <AppFooter />
    </div>
  )
}
