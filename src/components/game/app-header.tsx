'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Dices, Moon, Sun, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(id)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-10 rounded-xl"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'التبديل للمظهر الفاتح' : 'التبديل للمظهر الداكن'}
    >
      {mounted ? (
        isDark ? <Sun className="size-5" /> : <Moon className="size-5" />
      ) : (
        <Moon className="size-5 opacity-0" />
      )}
    </Button>
  )
}

export function AppHeader({ connected }: { connected: boolean }) {
  return (
    <header className="mx-auto w-full max-w-xl px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="brand-gradient shadow-brand grid size-10 place-items-center rounded-2xl text-white">
            <Dices className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">لعبة الأسئلة</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
            title={connected ? 'متصل بالخادم' : 'جاري الاتصال بالخادم'}
          >
            {connected ? (
              <Wifi className="size-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
              <WifiOff className="size-3.5 text-amber-500" aria-hidden="true" />
            )}
            {connected ? 'متصل' : 'اتصال...'}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
