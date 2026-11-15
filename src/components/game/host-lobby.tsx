'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Play, QrCode, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { PublicPlayer } from '@/lib/game-types'

export function HostLobby({
  code,
  players,
  questionsCount,
  onStart,
  onClose,
}: {
  code: string
  players: PublicPlayer[]
  questionsCount: number
  onStart: () => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setOrigin(window.location.origin), 0)
    return () => window.clearTimeout(id)
  }, [])

  const joinUrl = useMemo(() => (origin ? `${origin}/?room=${code}` : ''), [origin, code])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const canStart = players.length >= 2 && questionsCount >= 1

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <Card className="shadow-brand overflow-hidden">
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <QrCode className="size-4" aria-hidden="true" />
            امسح الرمز بكاميرا الجوال للانضمام
          </div>

          <div className="rounded-3xl bg-white p-3 shadow-brand ring-1 ring-black/5">
            {joinUrl ? (
              <img
                src={`/api/qr?text=${encodeURIComponent(joinUrl)}`}
                alt={`رمز QR للانضمام إلى الغرفة ${code}`}
                width={200}
                height={200}
                className="size-[200px]"
              />
            ) : (
              <div className="size-[200px] animate-pulse rounded-2xl bg-secondary" />
            )}
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">رمز الغرفة</p>
            <p className="font-mono text-4xl font-black tracking-[0.35em] text-primary" dir="ltr">
              {code}
            </p>
          </div>

          {joinUrl && (
            <div className="flex w-full items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-xl border bg-background px-3 py-2.5 text-center text-xs text-muted-foreground"
              >
                {joinUrl}
              </code>
              <Button variant="outline" size="icon" className="size-11 shrink-0 rounded-xl" onClick={copyLink} aria-label="نسخ رابط الغرفة">
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" aria-hidden="true" />
            اللاعبون
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-bold text-foreground">
              {players.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed py-8 text-center">
              <QrCode className="size-8 animate-pulse text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">بانتظار اللاعبين... شارك الرمز معهم</p>
            </div>
          ) : (
            <ul className="scroll-thin grid max-h-60 grid-cols-2 gap-2.5 overflow-y-auto pe-1 sm:grid-cols-3">
              {players.map(player => (
                <li
                  key={player.id}
                  className="animate-fadein flex items-center gap-2 rounded-2xl bg-background p-2.5"
                >
                  <span className="relative shrink-0">
                    <PlayerAvatar player={player} size={40} />
                    <span
                      className={`absolute -bottom-0.5 -end-0.5 size-3 rounded-full border-2 border-card ${
                        player.connected ? 'bg-emerald-500' : 'bg-muted-foreground'
                      }`}
                      title={player.connected ? 'متصل' : 'غير متصل'}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{player.name}</span>
                    {!player.connected && (
                      <span className="block text-[10px] text-muted-foreground">غير متصل</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {players.length < 2 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              تحتاج لاعبين اثنين على الأقل لبدء اللعبة
            </p>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 safe-bottom mt-auto space-y-2 border-t bg-background pt-3">
        <Button
          onClick={onStart}
          disabled={!canStart}
          className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
        >
          <Play className="size-5" aria-hidden="true" />
          ابدأ اللعبة
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-muted-foreground">
              إغلاق الغرفة وإلغاء كل شيء
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تغلق الغرفة نهائياً؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيخرج جميع اللاعبون ويلغى رمز QR الحالي. تقدر تنشئ غرفة جديدة في أي وقت.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={onClose}>أغلق الغرفة</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
