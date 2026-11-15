'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  Loader2,
  Mic,
  PartyPopper,
  PenLine,
  Smartphone,
  Trophy,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/game/avatar'
import { ProgressDots } from '@/components/game/dots'
import type { PublicPlayer, TurnState } from '@/lib/game-types'

export function PlayerWait({
  name,
  selfie,
  players,
}: {
  name: string
  selfie: string
  players: PublicPlayer[]
}) {
  const readyCount = players.filter(p => p.ready).length
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <PlayerAvatar player={{ name, selfie }} size={96} className="animate-pop" />
      <div className="space-y-1">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-extrabold">
          <CheckCircle2 className="size-6 text-emerald-500" aria-hidden="true" />
          وصلت أسئلتك يا {name}!
        </h2>
        <p className="text-muted-foreground">ننتظر باقي اللاعبين يخلصون من كتابة أسئلتهم</p>
      </div>
      <p className="text-sm font-bold text-primary" aria-live="polite">
        جاهزون: {readyCount} من {players.length}
      </p>
      {players.length > 0 && (
        <Card className="w-full">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
              في الغرفة ({players.length})
            </p>
            <div className="flex flex-wrap items-end justify-center gap-3">
              {players.map(player => (
                <div key={player.id} className="flex w-16 flex-col items-center gap-1">
                  <span className="relative">
                    <PlayerAvatar player={player} size={44} />
                    {player.ready && (
                      <span className="absolute -bottom-1 -end-1 grid size-4.5 place-items-center rounded-full border-2 border-card bg-emerald-500 text-white">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-medium">
                    {player.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        تبدأ الجولة تلقائياً لما يجهز الجميع
      </p>
    </div>
  )
}

export function PlayerPlay({
  turn,
  isMyTurn,
  myName,
  mySelfie,
  myQuestion,
  onNext,
}: {
  turn: TurnState
  isMyTurn: boolean
  myName: string
  mySelfie: string
  myQuestion: string | null
  onNext: () => void
}) {
  // Two-tap confirm so an accidental tap never skips someone's turn.
  // Resets automatically on turn change because page.tsx remounts this
  // component with a new key for every round/turn.
  const [confirming, setConfirming] = useState(false)

  // Auto-cancel the confirm if the player hesitates.
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  const current = turn.currentPlayer
  if (!current) return null

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-bold">الجولة {turn.round}</span>
        <span>
          اللاعب {turn.turnNo} من {turn.total}
        </span>
      </div>
      <ProgressDots total={turn.total} current={turn.turnNo - 1} />

      {isMyTurn ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2 text-center">
          <PlayerAvatar player={{ name: myName, selfie: mySelfie }} size={72} className="animate-pop" />
          <div className="brand-gradient shadow-brand animate-pop flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-lg font-extrabold text-primary-foreground">
            <PartyPopper className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">جاء دورك يا {myName}</span>
          </div>
          <div className="relative w-full overflow-hidden rounded-3xl border bg-card shadow-brand">
            <div className="brand-gradient h-1.5 w-full" aria-hidden="true" />
            <div className="grid min-h-48 place-items-center p-6">
              {myQuestion ? (
                <p key={myQuestion} className="animate-pop break-words text-2xl font-bold leading-relaxed">
                  {myQuestion}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                  <span className="text-sm">جاري إحضار سؤالك...</span>
                </div>
              )}
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mic className="size-4" aria-hidden="true" />
            جاوب بصوت عالٍ وشارك الجميع إجابتك
          </p>
          <Button
            onClick={() => (confirming ? onNext() : setConfirming(true))}
            disabled={!myQuestion}
            variant={confirming ? 'destructive' : 'default'}
            className="btn-press h-14 w-full gap-2 rounded-2xl text-base font-extrabold"
          >
            <ArrowLeft className="size-5 shrink-0" aria-hidden="true" />
            {confirming ? 'متأكد؟ اضغط مرة ثانية' : 'التالي'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {confirming ? 'بينتقل الدور للاعب اللي بعده' : 'خلصت إجابتك؟ انتقل للاعب التالي'}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
          <small className="text-sm text-muted-foreground">الدور على</small>
          <PlayerAvatar player={current} size={80} className="animate-pop" />
          <h2 key={current.id} className="animate-pop break-words text-3xl font-extrabold">
            {current.name}
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="size-4" aria-hidden="true" />
            السؤال يظهر على جواله الآن
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <EyeOff className="size-3.5" aria-hidden="true" />
            استنى دورك، لما يخلص اللاعب الحالي ينتقل الدور
          </div>
        </div>
      )}
    </div>
  )
}

export function PlayerEnd({
  players,
  onNewRound,
}: {
  players: PublicPlayer[]
  onNewRound: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <span className="brand-gradient shadow-brand grid size-20 place-items-center rounded-full text-primary-foreground">
        <Trophy className="size-9" aria-hidden="true" />
      </span>
      <h2 className="text-3xl font-extrabold">انتهت الجولة!</h2>
      <p className="flex items-center gap-2 text-muted-foreground">
        <PartyPopper className="size-4" aria-hidden="true" />
        شكراً للعب، كان وقت ممتع
      </p>
      <Button
        onClick={onNewRound}
        className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
      >
        <PenLine className="size-5" aria-hidden="true" />
        اكتب أسئلتك للجولة الجديدة
      </Button>
      {players.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end justify-center gap-3">
          {players.map(player => (
            <PlayerAvatar key={player.id} player={player} size={40} />
          ))}
        </div>
      )}
    </div>
  )
}
