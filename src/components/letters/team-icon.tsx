'use client'

import {
  Crown,
  Flag,
  Flame,
  Heart,
  Rocket,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Maps the engine's icon keys (TEAM_ICON_KEYS in letters-types.ts) to Lucide
// icons. Unknown keys fall back to the flag.

const TEAM_ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  crown: Crown,
  star: Star,
  zap: Zap,
  rocket: Rocket,
  shield: Shield,
  flame: Flame,
  target: Target,
  trophy: Trophy,
  heart: Heart,
}

interface TeamIconProps {
  icon: string
  className?: string
}

export function TeamIcon({ icon, className }: TeamIconProps) {
  const Component = TEAM_ICONS[icon] ?? Flag
  return <Component className={className} aria-hidden="true" />
}
