'use client'

import { Camera, Loader2, LogIn, QrCode, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelfieCamera } from '@/components/game/selfie-camera'

/** Controlled join screen: the page owns the draft name/selfie so retries keep them. */
export function PlayerJoin({
  code,
  name,
  selfie,
  cameraFailed,
  joining,
  onNameChange,
  onSelfieChange,
  onCameraFailed,
  onJoin,
}: {
  code: string
  name: string
  selfie: string | null
  cameraFailed: boolean
  joining: boolean
  onNameChange: (name: string) => void
  onSelfieChange: (selfie: string | null) => void
  onCameraFailed: () => void
  onJoin: (name: string, selfie: string) => void
}) {
  const canJoin = Boolean(name.trim()) && (Boolean(selfie) || cameraFailed) && !joining

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <Card className="shadow-brand">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="brand-gradient grid size-12 shrink-0 place-items-center rounded-2xl text-primary-foreground">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold">انضم إلى الغرفة</h2>
            <p className="text-sm text-muted-foreground">
              رمز الغرفة:{' '}
              <span className="font-mono font-bold tracking-widest text-foreground" dir="ltr">
                {code}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4 text-primary" aria-hidden="true" />
            صورة اللاعب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SelfieCamera
            value={selfie}
            onChange={onSelfieChange}
            onCameraFailed={onCameraFailed}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <label htmlFor="player-name" className="flex items-center gap-2 text-sm font-bold">
            <User className="size-4 text-primary" aria-hidden="true" />
            اسم اللاعب
          </label>
          <Input
            id="player-name"
            value={name}
            onChange={event => onNameChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && canJoin) onJoin(name.trim(), selfie ?? '')
            }}
            placeholder="اكتب اسمك اللي يبان للجميع"
            maxLength={30}
            className="h-12 rounded-2xl bg-background text-base"
          />
          <Button
            onClick={() => onJoin(name.trim(), selfie ?? '')}
            disabled={!canJoin}
            className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
          >
            {joining ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                جاري الانضمام...
              </>
            ) : (
              <>
                <LogIn className="size-5" aria-hidden="true" />
                انضم للغرفة
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
