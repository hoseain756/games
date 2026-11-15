'use client'

import { Repeat, QrCode, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { GameOptions } from '@/lib/game-types'

export function HostSetup({
  opts,
  onOptsChange,
  onCreate,
  busy,
}: {
  opts: GameOptions
  onOptsChange: (opts: GameOptions) => void
  onCreate: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold">غرفة جديدة</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أنشئ الغرفة وشارك رمز QR — كل لاعب يكتب أسئلته من جواله بعد الانضمام،
          وتبدأ الجولة تلقائياً لما يجهز الجميع
        </p>
      </div>

      <Card className="shadow-brand">
        <CardContent className="space-y-4 p-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-4">
            <Checkbox
              checked={opts.norepeat}
              onCheckedChange={checked => onOptsChange({ ...opts, norepeat: checked === true })}
              className="mt-0.5"
              aria-label="عدم تكرار السؤال"
            />
            <span className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Repeat className="size-4 text-primary" aria-hidden="true" />
                عدم تكرار السؤال
              </span>
              <span className="block text-xs text-muted-foreground">
                ما يتكرر السؤال حتى تنتهي كل أسئلة اللاعبين، بعدها نعيد خلطها.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-4">
            <Checkbox
              checked={opts.shuffle}
              onCheckedChange={checked => onOptsChange({ ...opts, shuffle: checked === true })}
              className="mt-0.5"
              aria-label="ترتيب اللاعبين عشوائي"
            />
            <span className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Shuffle className="size-4 text-primary" aria-hidden="true" />
                ترتيب الأدوار عشوائي
              </span>
              <span className="block text-xs text-muted-foreground">
                عند بدء الجولة تُخلط أدوار اللاعبين بدل ترتيب انضمامهم.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 safe-bottom mt-auto border-t bg-background pt-3">
        <Button
          onClick={onCreate}
          disabled={busy}
          className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
        >
          <QrCode className="size-5" aria-hidden="true" />
          أنشئ غرفة اللعب عبر QR
        </Button>
      </div>
    </div>
  )
}
