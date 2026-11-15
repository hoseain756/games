'use client'

import {
  EyeOff,
  Loader2,
  Mic,
  PartyPopper,
  Smartphone,
  Trophy,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <PlayerAvatar player={{ name, selfie }} size={96} className="animate-pop" />
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">أهلاً {name}!</h2>
        <p className="text-muted-foreground">تم الانضمام، استنى المضيف يبدأ اللعبة</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        بانتظار بدء المضيف
      </div>
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
                    <span
                      className={`absolute -bottom-0.5 -end-0.5 size-3 rounded-full border-2 border-card ${
                        player.connected ? 'bg-emerald-500' : 'bg-muted-foreground'
                      }`}
                    />
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
    </div>
  )
}

export function PlayerPlay({
  turn,
  isMyTurn,
  myName,
  mySelfie,
  myQuestion,
}: {
  turn: TurnState
  isMyTurn: boolean
  myName: string
  mySelfie: string
  myQuestion: string | null
}) {
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
          <div className="space-y-1">
            <Badge className="brand-gradient gap-1.5 border-0 text-white shadow-brand">
              <PartyPopper className="size-3.5" aria-hidden="true" />
              جاء دورك يا {myName}
            </Badge>
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
            استنى دورك، والمضيف ينتقل للاعب التالي
          </div>
        </div>
      )}
    </div>
  )
}

export function PlayerEnd({ players }: { players: PublicPlayer[] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <span className="brand-gradient shadow-brand grid size-20 place-items-center rounded-full text-white">
        <Trophy className="size-9" aria-hidden="true" />
      </span>
      <h2 className="text-3xl font-extrabold">انتهت اللعبة!</h2>
      <p className="flex items-center gap-2 text-muted-foreground">
        <PartyPopper className="size-4" aria-hidden="true" />
        شكراً للعب، كان وقت ممتع
      </p>
      <p className="text-sm text-muted-foreground/80">
        إذا المضيف بدأ جولة جديدة بتنقل تلقائياً لشاشة اللعب
      </p>
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
