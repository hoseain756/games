'use client'

import {
  ArrowLeft,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  RotateCw,
  Smartphone,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PlayerAvatar } from '@/components/game/avatar'
import { ProgressDots } from '@/components/game/dots'
import type { PublicPlayer, TurnState } from '@/lib/game-types'

export function HostGame({
  turn,
  players,
  hostQuestion,
  peeking,
  onPeek,
  onHide,
  onNext,
  onReroll,
  onEnd,
}: {
  turn: TurnState
  players: PublicPlayer[]
  hostQuestion: string | null
  peeking: boolean
  onPeek: () => void
  onHide: () => void
  onNext: () => void
  onReroll: () => void
  onEnd: () => void
}) {
  const current = turn.currentPlayer
  if (!current) return null
  const connected = players.find(p => p.id === current.id)?.connected ?? true
  const isLast = turn.turnNo >= turn.total

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-bold">الجولة {turn.round}</span>
        <span>
          اللاعب {turn.turnNo} من {turn.total}
        </span>
      </div>
      <ProgressDots total={turn.total} current={turn.turnNo - 1} />

      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <span className="relative">
          <PlayerAvatar player={current} size={88} className="animate-pop" />
          {!connected && (
            <span className="absolute -bottom-1 -end-1 grid size-7 place-items-center rounded-full border-2 border-background bg-amber-500 text-white">
              <WifiOff className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </span>
        <small className="mt-2 text-sm text-muted-foreground">الدور على</small>
        <h2 key={current.id} className="animate-pop break-words text-3xl font-extrabold">
          {current.name}
        </h2>
      </div>

      <div className="relative overflow-hidden rounded-3xl border bg-card shadow-brand">
        <div className="brand-gradient h-1.5 w-full" aria-hidden="true" />
        <div className="grid min-h-44 place-items-center p-6 text-center">
          {hostQuestion ? (
            <div key={hostQuestion} className="animate-pop space-y-3">
              <Badge className="gap-1" variant="secondary">
                <Eye className="size-3" aria-hidden="true" />
                معاينة على شاشتك
              </Badge>
              <p className="break-words text-2xl font-bold leading-relaxed">{hostQuestion}</p>
            </div>
          ) : (
            <div className="space-y-3 text-muted-foreground">
              <EyeOff className="mx-auto size-8" aria-hidden="true" />
              <p className="text-lg font-bold text-foreground">السؤال مخفي</p>
              <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
                <Smartphone className="size-4" aria-hidden="true" />
                يظهر الآن على جوال
                <span className="font-extrabold text-foreground">{current.name}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        {peeking ? (
          <Button variant="ghost" onClick={onHide} className="gap-2 text-muted-foreground">
            <EyeOff className="size-4" aria-hidden="true" />
            إخفاء المعاينة
          </Button>
        ) : (
          <Button variant="ghost" onClick={onPeek} className="gap-2 text-muted-foreground">
            <Eye className="size-4" aria-hidden="true" />
            إظهار السؤال على شاشتك
          </Button>
        )}
      </div>

      <div className="mt-auto space-y-3 pb-2 pt-4">
        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <Button
            onClick={onNext}
            className="brand-gradient shadow-brand h-14 gap-2 rounded-2xl text-lg font-extrabold"
          >
            {isLast ? (
              <>
                جولة جديدة
                <RotateCw className="size-5" aria-hidden="true" />
              </>
            ) : (
              <>
                التالي
                <ArrowLeft className="size-5" aria-hidden="true" />
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onReroll}
            className="h-14 gap-2 rounded-2xl px-5 font-bold"
            title="بدّل السؤال الحالي بسؤال آخر"
          >
            <RefreshCw className="size-5" aria-hidden="true" />
            سؤال آخر
          </Button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="mx-auto flex gap-1.5 text-sm text-muted-foreground">
              <LogOut className="size-4" aria-hidden="true" />
              إنهاء اللعبة والعودة للاعبين
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تنهي الجولة الحالية؟</AlertDialogTitle>
              <AlertDialogDescription>
                يرجع الجميع لشاشة الانتظار ويبقون في الغرفة، وتقدر تبدأ جولة جديدة مباشرة.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={onEnd}>أنهي الجولة</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
