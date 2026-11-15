'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Card className="w-full max-w-sm text-center shadow-brand">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <span className="grid size-16 place-items-center rounded-full bg-amber-500/15 text-amber-500">
            <TriangleAlert className="size-8" aria-hidden="true" />
          </span>
          <p className="break-words font-bold leading-relaxed">{message}</p>
          <Button onClick={onRetry} className="brand-gradient shadow-brand h-12 w-full rounded-2xl font-bold">
            {retryLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
