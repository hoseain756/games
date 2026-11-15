'use client'

import { DirectionProvider } from '@radix-ui/react-direction'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      {/* تلتزم كل مكوّنات Radix بالاتجاه العربي RTL (تبويبات، قوائم، نوافذ...) */}
      <DirectionProvider dir="rtl">{children}</DirectionProvider>
    </NextThemesProvider>
  )
}
