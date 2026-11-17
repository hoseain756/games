'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// "Candy" buttons — the pressable 3D style lifted from sahamstudio.com/horoof:
// a flat bright fill sitting on a hard darker bottom edge (box-shadow
// `0 4px 0 0 <edge>`) plus a soft ambient shadow. Pressing sinks the button
// into its shadow: translateY(3px) + shadow collapse, over a 0.1s transition.
// Radius 16px (rounded-2xl), bold label, icon inline — exactly like the
// reference. Yellow / cyan / red are the reference's own colors; purple /
// green / orange / emerald map the game's palette onto the same recipe.
// ---------------------------------------------------------------------------

export type CandyVariant =
  | 'purple'
  | 'green'
  | 'orange'
  | 'red'
  | 'emerald'
  | 'yellow'
  | 'cyan'
  | 'ghost'
  | 'ghostDanger'

export type CandySize = 'sm' | 'md' | 'lg' | 'xl'

const CANDY_BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-extrabold leading-none outline-none transition-all duration-100 focus-visible:ring-4 focus-visible:ring-purple-300/60 disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-5'

// Fill + hard bottom edge + soft ambient shadow + press (reference formula:
// `0 4px 0 0 <edge>, 0 8px 15px rgba(0,0,0,.3)` → active sinks 3px).
const SOLID: Record<Exclude<CandyVariant, 'ghost' | 'ghostDanger'>, { fill: string; edge4: string; edge8: string }> = {
  purple: {
    fill: 'bg-purple-700 text-white hover:bg-purple-600',
    edge4: 'shadow-[0_4px_0_0_#4c1d95,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#4c1d95,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  green: {
    fill: 'bg-green-500 text-white hover:bg-green-400',
    edge4: 'shadow-[0_4px_0_0_#276b12,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#276b12,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  orange: {
    fill: 'bg-orange-400 text-orange-950 hover:bg-orange-300',
    edge4: 'shadow-[0_4px_0_0_#c2410c,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#c2410c,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  red: {
    fill: 'bg-red-500 text-white hover:bg-red-400',
    edge4: 'shadow-[0_4px_0_0_#c62828,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#c62828,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  emerald: {
    fill: 'bg-emerald-600 text-white hover:bg-emerald-500',
    edge4: 'shadow-[0_4px_0_0_#065f46,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#065f46,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  // Exact reference colors (btn-buy / btn-download on sahamstudio.com/horoof).
  yellow: {
    fill: 'bg-[#ffdd00] text-[#3e1b52] hover:bg-[#ffe34d]',
    edge4: 'shadow-[0_4px_0_0_#c7a000,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#c7a000,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
  cyan: {
    fill: 'bg-[#26c6da] text-[#0f3d44] hover:bg-[#48d2e3]',
    edge4: 'shadow-[0_4px_0_0_#008ba3,0_8px_15px_rgba(0,0,0,0.3)] active:translate-y-[3px] active:shadow-none',
    edge8: 'shadow-[0_8px_0_0_#008ba3,0_16px_24px_rgba(0,0,0,0.35)] active:translate-y-[6px] active:shadow-none',
  },
}

// Ghost buttons (like the reference's btn-leaderboard): tinted border + soft
// tinted background, no 3D edge, a small 2px press.
const GHOST: Record<'ghost' | 'ghostDanger', string> = {
  ghost:
    'border-2 border-purple-300 bg-white/70 text-purple-700 hover:bg-purple-100 active:translate-y-[2px]',
  ghostDanger:
    'border-2 border-red-300 bg-white/70 text-red-600 hover:bg-red-50 active:translate-y-[2px]',
}

const SIZES: Record<CandySize, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3.5 text-xs [&_svg:not([class*=\'size-\'])]:size-4',
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-6 text-lg font-black',
  xl: 'h-16 px-6 text-lg font-black [&_svg:not([class*=\'size-\'])]:size-6',
}

export function candyClasses(
  variant: CandyVariant = 'purple',
  size: CandySize = 'md',
  depth: 4 | 8 = 4,
  className?: string,
): string {
  const solid = SOLID[variant as Exclude<CandyVariant, 'ghost' | 'ghostDanger'>]
  return cn(
    CANDY_BASE,
    SIZES[size],
    solid ? cn(solid.fill, depth === 8 ? solid.edge8 : solid.edge4) : GHOST[variant as 'ghost' | 'ghostDanger'],
    className,
  )
}

export interface CandyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CandyVariant
  size?: CandySize
  /** 4 = standard candy edge (reference), 8 = chunky edge for huge buttons. */
  depth?: 4 | 8
}

export const CandyButton = forwardRef<HTMLButtonElement, CandyButtonProps>(function CandyButton(
  { variant = 'purple', size = 'md', depth = 4, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={candyClasses(variant, size, depth, className)}
      {...props}
    />
  )
})
