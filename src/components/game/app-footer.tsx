'use client'

import { Smartphone } from 'lucide-react'

export function AppFooter() {
  return (
    <footer
      className="mt-auto border-t bg-card/60"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 px-4 py-3 text-center text-xs text-muted-foreground">
        <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
        <span>لعبة عبر الجوالات — كل لاعب يشوف سؤاله على جواله أثناء الدور</span>
      </div>
    </footer>
  )
}
